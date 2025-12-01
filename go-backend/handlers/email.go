package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/gmail/v1"
	"google.golang.org/api/option"
)

var gmailOAuthConfig *oauth2.Config

func init() {
	// Initialize OAuth config - will be properly set when env vars are available
	gmailOAuthConfig = &oauth2.Config{
		Scopes: []string{
			gmail.GmailSendScope,
			gmail.GmailReadonlyScope,
			"https://www.googleapis.com/auth/userinfo.email",
		},
		Endpoint: google.Endpoint,
	}
}

func getGmailConfig() *oauth2.Config {
	if gmailOAuthConfig.ClientID == "" {
		gmailOAuthConfig.ClientID = os.Getenv("GOOGLE_CLIENT_ID")
		gmailOAuthConfig.ClientSecret = os.Getenv("GOOGLE_CLIENT_SECRET")
		baseURL := os.Getenv("GO_BACKEND_URL")
		if baseURL == "" {
			baseURL = "http://localhost:8080"
		}
		gmailOAuthConfig.RedirectURL = baseURL + "/api/v1/email/oauth/callback"
	}
	return gmailOAuthConfig
}

// GetGmailAuthURL generates the OAuth URL for connecting Gmail
func GetGmailAuthURL(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	userID := c.Query("user_id")
	
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	config := getGmailConfig()
	if config.ClientID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gmail OAuth not configured"})
		return
	}

	// State includes workspace and user ID
	state := workspaceID
	if userID != "" {
		state = workspaceID + ":" + userID
	}
	url := config.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.ApprovalForce)

	c.JSON(http.StatusOK, gin.H{"auth_url": url})
}

// HandleGmailCallback processes the OAuth callback
func HandleGmailCallback(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state") // Format: workspaceID:userID
	errorParam := c.Query("error")

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	if errorParam != "" {
		c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/gmail-connected?error=cancelled")
		return
	}

	if code == "" || state == "" {
		c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/gmail-connected?error=invalid_callback")
		return
	}

	// Parse state - format: workspaceID:userID
	parts := strings.Split(state, ":")
	workspaceID, err := uuid.Parse(parts[0])
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/gmail-connected?error=invalid_workspace")
		return
	}
	
	userID := ""
	if len(parts) > 1 {
		userID = parts[1]
	}

	config := getGmailConfig()
	token, err := config.Exchange(context.Background(), code)
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/gmail-connected?error=token_exchange_failed")
		return
	}

	// Get user's email address
	client := config.Client(context.Background(), token)
	gmailService, err := gmail.NewService(context.Background(), option.WithHTTPClient(client))
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/gmail-connected?error=gmail_service_failed")
		return
	}

	profile, err := gmailService.Users.GetProfile("me").Do()
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/gmail-connected?error=profile_fetch_failed")
		return
	}

	// Check if this email is already connected to this workspace
	var existingConnection models.GmailConnection
	if err := database.DB.Where("workspace_id = ? AND email = ?", workspaceID, profile.EmailAddress).First(&existingConnection).Error; err == nil {
		// Update existing connection
		existingConnection.AccessToken = token.AccessToken
		existingConnection.RefreshToken = token.RefreshToken
		existingConnection.TokenExpiry = token.Expiry
		database.DB.Save(&existingConnection)
	} else {
		// Create new connection
		scopesJSON, _ := json.Marshal(config.Scopes)
		
		// Check if this is the first account (make it default)
		var count int64
		database.DB.Model(&models.GmailConnection{}).Where("workspace_id = ?", workspaceID).Count(&count)
		
		connection := models.GmailConnection{
			WorkspaceID:    workspaceID,
			UserID:         userID,
			Email:          profile.EmailAddress,
			DisplayName:    profile.EmailAddress, // Default to email
			AccessToken:    token.AccessToken,
			RefreshToken:   token.RefreshToken,
			TokenExpiry:    token.Expiry,
			Scopes:         scopesJSON,
			SendPermission: "myself",
			IsDefault:      count == 0, // First account is default
		}

		if err := database.DB.Create(&connection).Error; err != nil {
			c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/gmail-connected?error=save_failed")
			return
		}
	}

	c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/gmail-connected?success=true")
}

// GetGmailConnection returns the current Gmail connection status
func GetGmailConnection(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var connections []models.GmailConnection
	database.DB.Where("workspace_id = ?", workspaceID).Find(&connections)
	
	if len(connections) == 0 {
		c.JSON(http.StatusOK, gin.H{"connected": false, "accounts": []interface{}{}})
		return
	}

	// Find the default or first account
	var defaultEmail string
	for _, conn := range connections {
		if conn.IsDefault {
			defaultEmail = conn.Email
			break
		}
	}
	if defaultEmail == "" && len(connections) > 0 {
		defaultEmail = connections[0].Email
	}

	c.JSON(http.StatusOK, gin.H{
		"connected":      true,
		"email":          defaultEmail,
		"accounts_count": len(connections),
		"accounts":       connections,
	})
}

// DisconnectGmail removes the Gmail connection
func DisconnectGmail(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	if err := database.DB.Where("workspace_id = ?", workspaceID).Delete(&models.GmailConnection{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to disconnect Gmail"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// SendEmailRequest represents the request body for sending emails
type SendEmailRequest struct {
	FormID       string   `json:"form_id"`
	Recipients   []string `json:"recipients"` // Can be email addresses or "all", "submitted", "approved", "rejected"
	Subject      string   `json:"subject" binding:"required"`
	Body         string   `json:"body" binding:"required"`
	BodyHTML     string   `json:"body_html"`
	MergeTags    bool     `json:"merge_tags"`
	TrackOpens   bool     `json:"track_opens"`
	SaveTemplate bool     `json:"save_template"`
	TemplateName string   `json:"template_name"`
}

// SendEmail sends emails via Gmail API
func SendEmail(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var req SendEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get Gmail connection
	var connection models.GmailConnection
	if err := database.DB.Where("workspace_id = ?", workspaceID).First(&connection).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gmail not connected. Please connect your Gmail account first."})
		return
	}

	// Create OAuth token
	token := &oauth2.Token{
		AccessToken:  connection.AccessToken,
		RefreshToken: connection.RefreshToken,
		Expiry:       connection.TokenExpiry,
	}

	config := getGmailConfig()
	client := config.Client(context.Background(), token)
	gmailService, err := gmail.NewService(context.Background(), option.WithHTTPClient(client))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Gmail service"})
		return
	}

	// Get recipients based on filter
	recipients, err := getRecipients(req.FormID, req.Recipients)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(recipients) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No recipients found"})
		return
	}

	// Create campaign if sending to multiple recipients
	var campaign *models.EmailCampaign
	wsUUID, _ := uuid.Parse(workspaceID)
	
	if len(recipients) > 1 {
		campaign = &models.EmailCampaign{
			WorkspaceID: wsUUID,
			Subject:     req.Subject,
			Body:        req.Body,
			BodyHTML:    req.BodyHTML,
			SenderEmail: connection.Email,
			Status:      "sending",
		}
		if req.FormID != "" {
			formUUID, _ := uuid.Parse(req.FormID)
			campaign.FormID = &formUUID
		}
		database.DB.Create(campaign)
	}

	// Save template if requested
	if req.SaveTemplate && req.TemplateName != "" {
		template := models.EmailTemplate{
			WorkspaceID: wsUUID,
			Name:        req.TemplateName,
			Subject:     req.Subject,
			Body:        req.Body,
			BodyHTML:    req.BodyHTML,
			Type:        "manual",
		}
		if req.FormID != "" {
			formUUID, _ := uuid.Parse(req.FormID)
			template.FormID = &formUUID
		}
		database.DB.Create(&template)
	}

	// Send emails
	var sentEmails []models.SentEmail
	var errors []string
	backendURL := os.Getenv("GO_BACKEND_URL")
	if backendURL == "" {
		backendURL = "http://localhost:8080"
	}

	for _, recipient := range recipients {
		// Generate tracking ID
		trackingID := uuid.New().String()

		// Process merge tags if enabled
		subject := req.Subject
		body := req.Body
		bodyHTML := req.BodyHTML

		if req.MergeTags && recipient.SubmissionData != nil {
			subject = processMergeTags(subject, recipient.SubmissionData)
			body = processMergeTags(body, recipient.SubmissionData)
			bodyHTML = processMergeTags(bodyHTML, recipient.SubmissionData)
		}

		// Add tracking pixel if enabled
		if req.TrackOpens {
			trackingPixel := fmt.Sprintf(`<img src="%s/api/v1/email/track/%s" width="1" height="1" style="display:none" />`, backendURL, trackingID)
			if bodyHTML != "" {
				bodyHTML += trackingPixel
			} else {
				bodyHTML = body + trackingPixel
			}
		}

		// Create MIME message
		var message gmail.Message
		rawMessage := createMIMEMessage(connection.Email, recipient.Email, recipient.Name, subject, body, bodyHTML)
		message.Raw = base64.URLEncoding.EncodeToString([]byte(rawMessage))

		// Send via Gmail
		sentMessage, err := gmailService.Users.Messages.Send("me", &message).Do()
		
		sentEmail := models.SentEmail{
			WorkspaceID:    wsUUID,
			RecipientEmail: recipient.Email,
			RecipientName:  recipient.Name,
			Subject:        subject,
			Body:           body,
			BodyHTML:       bodyHTML,
			SenderEmail:    connection.Email,
			TrackingID:     trackingID,
			Status:         "sent",
			SentAt:         time.Now(),
		}

		if campaign != nil {
			sentEmail.CampaignID = &campaign.ID
		}
		if recipient.SubmissionID != "" {
			subUUID, _ := uuid.Parse(recipient.SubmissionID)
			sentEmail.SubmissionID = &subUUID
		}
		if req.FormID != "" {
			formUUID, _ := uuid.Parse(req.FormID)
			sentEmail.FormID = &formUUID
		}

		if err != nil {
			sentEmail.Status = "failed"
			errors = append(errors, fmt.Sprintf("Failed to send to %s: %v", recipient.Email, err))
		} else {
			sentEmail.GmailMessageID = sentMessage.Id
			sentEmail.GmailThreadID = sentMessage.ThreadId
		}

		database.DB.Create(&sentEmail)
		sentEmails = append(sentEmails, sentEmail)
	}

	// Update campaign status
	if campaign != nil {
		campaign.Status = "sent"
		now := time.Now()
		campaign.SentAt = &now
		database.DB.Save(campaign)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     len(errors) == 0,
		"sent_count":  len(sentEmails) - len(errors),
		"total":       len(recipients),
		"errors":      errors,
		"campaign_id": campaign,
	})
}

// Recipient represents an email recipient with optional submission data
type Recipient struct {
	Email          string
	Name           string
	SubmissionID   string
	SubmissionData map[string]interface{}
}

func getRecipients(formID string, recipientFilters []string) ([]Recipient, error) {
	var recipients []Recipient

	// Check if we have explicit email addresses
	for _, r := range recipientFilters {
		if strings.Contains(r, "@") {
			// It's an email address
			recipients = append(recipients, Recipient{Email: r})
		}
	}

	// If we have explicit emails, return them
	if len(recipients) > 0 {
		return recipients, nil
	}

	// Otherwise, query based on filters
	if formID == "" {
		return nil, fmt.Errorf("form_id is required when using filters")
	}

	// Determine status filter
	var statusFilter string
	for _, r := range recipientFilters {
		switch r {
		case "submitted":
			statusFilter = "submitted"
		case "approved":
			statusFilter = "approved"
		case "rejected":
			statusFilter = "rejected"
		case "all":
			statusFilter = ""
		}
	}

	// Query submissions with their data
	var rows []models.Row
	query := database.DB.Where("table_id = ?", formID)
	if statusFilter != "" {
		query = query.Where("status = ?", statusFilter)
	}
	if err := query.Find(&rows).Error; err != nil {
		return nil, err
	}

	for _, row := range rows {
		var rowData map[string]interface{}
		if err := json.Unmarshal(row.Data, &rowData); err != nil {
			continue
		}

		// Try to find email field
		email := findEmailInData(rowData)
		if email == "" {
			continue
		}

		name := findNameInData(rowData)

		recipients = append(recipients, Recipient{
			Email:          email,
			Name:           name,
			SubmissionID:   row.ID.String(),
			SubmissionData: rowData,
		})
	}

	return recipients, nil
}

func findEmailInData(data map[string]interface{}) string {
	// Common email field names
	emailFields := []string{"email", "Email", "EMAIL", "email_address", "emailAddress", "contact_email", "applicant_email"}
	for _, field := range emailFields {
		if val, ok := data[field]; ok {
			if email, ok := val.(string); ok && strings.Contains(email, "@") {
				return email
			}
		}
	}

	// Search all fields for email-like values
	for _, val := range data {
		if str, ok := val.(string); ok && strings.Contains(str, "@") && strings.Contains(str, ".") {
			return str
		}
	}

	return ""
}

func findNameInData(data map[string]interface{}) string {
	// Common name field patterns
	nameFields := []string{"name", "Name", "NAME", "full_name", "fullName", "applicant_name", "first_name", "firstName"}
	for _, field := range nameFields {
		if val, ok := data[field]; ok {
			if name, ok := val.(string); ok && name != "" {
				return name
			}
		}
	}
	return ""
}

func processMergeTags(content string, data map[string]interface{}) string {
	for key, val := range data {
		tag := fmt.Sprintf("{{%s}}", key)
		if str, ok := val.(string); ok {
			content = strings.ReplaceAll(content, tag, str)
		} else {
			valStr := fmt.Sprintf("%v", val)
			content = strings.ReplaceAll(content, tag, valStr)
		}
	}
	return content
}

func createMIMEMessage(from, to, toName, subject, textBody, htmlBody string) string {
	boundary := "boundary_" + uuid.New().String()

	var sb strings.Builder
	
	// Headers
	if toName != "" {
		sb.WriteString(fmt.Sprintf("To: %s <%s>\r\n", toName, to))
	} else {
		sb.WriteString(fmt.Sprintf("To: %s\r\n", to))
	}
	sb.WriteString(fmt.Sprintf("From: %s\r\n", from))
	sb.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	sb.WriteString("MIME-Version: 1.0\r\n")
	sb.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=%s\r\n", boundary))
	sb.WriteString("\r\n")

	// Plain text part
	sb.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	sb.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	sb.WriteString("\r\n")
	sb.WriteString(textBody)
	sb.WriteString("\r\n")

	// HTML part
	if htmlBody != "" {
		sb.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		sb.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
		sb.WriteString("\r\n")
		sb.WriteString(htmlBody)
		sb.WriteString("\r\n")
	}

	sb.WriteString(fmt.Sprintf("--%s--\r\n", boundary))

	return sb.String()
}

// TrackEmailOpen handles the tracking pixel request
func TrackEmailOpen(c *gin.Context) {
	trackingID := c.Param("tracking_id")
	if trackingID == "" {
		// Return 1x1 transparent GIF regardless
		c.Data(http.StatusOK, "image/gif", transparentGIF)
		return
	}

	// Update the email record
	var email models.SentEmail
	if err := database.DB.Where("tracking_id = ?", trackingID).First(&email).Error; err == nil {
		now := time.Now()
		if email.OpenedAt == nil {
			email.OpenedAt = &now
			email.Status = "opened"
		}
		email.OpenCount++
		database.DB.Save(&email)
	}

	// Return 1x1 transparent GIF
	c.Data(http.StatusOK, "image/gif", transparentGIF)
}

// 1x1 transparent GIF
var transparentGIF = []byte{
	0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
	0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
	0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
	0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
	0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
	0x01, 0x00, 0x3b,
}

// GetEmailHistory returns sent emails for a workspace/form
func GetEmailHistory(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	formID := c.Query("form_id")

	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var emails []models.SentEmail
	query := database.DB.Where("workspace_id = ?", workspaceID)
	if formID != "" {
		query = query.Where("form_id = ?", formID)
	}
	query.Order("sent_at DESC").Limit(100).Find(&emails)

	c.JSON(http.StatusOK, emails)
}

// GetEmailCampaigns returns email campaigns for a workspace
func GetEmailCampaigns(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	formID := c.Query("form_id")

	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var campaigns []models.EmailCampaign
	query := database.DB.Where("workspace_id = ?", workspaceID)
	if formID != "" {
		query = query.Where("form_id = ?", formID)
	}
	query.Order("created_at DESC").Limit(50).Find(&campaigns)

	// Get stats for each campaign
	for i := range campaigns {
		var stats struct {
			Total  int
			Opened int
		}
		database.DB.Model(&models.SentEmail{}).
			Select("COUNT(*) as total, SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened").
			Where("campaign_id = ?", campaigns[i].ID).
			Scan(&stats)
		campaigns[i].TotalRecipients = stats.Total
		campaigns[i].OpenedCount = stats.Opened
	}

	c.JSON(http.StatusOK, campaigns)
}

// GetEmailTemplates returns email templates for a workspace
func GetEmailTemplates(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	formID := c.Query("form_id")

	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var templates []models.EmailTemplate
	query := database.DB.Where("workspace_id = ?", workspaceID)
	if formID != "" {
		query = query.Where("form_id = ? OR form_id IS NULL", formID)
	}
	query.Order("created_at DESC").Find(&templates)

	c.JSON(http.StatusOK, templates)
}

// CreateEmailTemplate creates a new email template
func CreateEmailTemplate(c *gin.Context) {
	var template models.EmailTemplate
	if err := c.ShouldBindJSON(&template); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Create(&template).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create template"})
		return
	}

	c.JSON(http.StatusCreated, template)
}

// UpdateEmailTemplate updates an email template
func UpdateEmailTemplate(c *gin.Context) {
	id := c.Param("id")
	
	var template models.EmailTemplate
	if err := database.DB.First(&template, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	if err := c.ShouldBindJSON(&template); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Save(&template)
	c.JSON(http.StatusOK, template)
}

// DeleteEmailTemplate deletes an email template
func DeleteEmailTemplate(c *gin.Context) {
	id := c.Param("id")
	
	if err := database.DB.Delete(&models.EmailTemplate{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete template"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ==================== EMAIL ACCOUNTS ====================

// ListEmailAccounts returns all Gmail connections for a workspace
func ListEmailAccounts(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var connections []models.GmailConnection
	database.DB.Where("workspace_id = ?", workspaceID).Order("created_at DESC").Find(&connections)

	c.JSON(http.StatusOK, connections)
}

// UpdateEmailAccount updates an email account's settings (display name, permissions)
func UpdateEmailAccount(c *gin.Context) {
	id := c.Param("id")

	var connection models.GmailConnection
	if err := database.DB.First(&connection, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Email account not found"})
		return
	}

	var updates struct {
		DisplayName    string   `json:"display_name"`
		SendPermission string   `json:"send_permission"`
		AllowedUserIDs []string `json:"allowed_user_ids"`
		IsDefault      bool     `json:"is_default"`
	}

	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// If setting as default, unset other defaults in this workspace
	if updates.IsDefault {
		database.DB.Model(&models.GmailConnection{}).
			Where("workspace_id = ? AND id != ?", connection.WorkspaceID, connection.ID).
			Update("is_default", false)
	}

	connection.DisplayName = updates.DisplayName
	connection.SendPermission = updates.SendPermission
	connection.IsDefault = updates.IsDefault
	if updates.AllowedUserIDs != nil {
		allowedJSON, _ := json.Marshal(updates.AllowedUserIDs)
		connection.AllowedUserIDs = allowedJSON
	}

	database.DB.Save(&connection)
	c.JSON(http.StatusOK, connection)
}

// DeleteEmailAccount removes a Gmail connection
func DeleteEmailAccount(c *gin.Context) {
	id := c.Param("id")

	if err := database.DB.Delete(&models.GmailConnection{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete email account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ==================== EMAIL SIGNATURES ====================

// ListSignatures returns all signatures for a user in a workspace
func ListSignatures(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	userID := c.Query("user_id")

	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var signatures []models.EmailSignature
	query := database.DB.Where("workspace_id = ?", workspaceID)
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	query.Order("created_at DESC").Find(&signatures)

	c.JSON(http.StatusOK, signatures)
}

// CreateSignature creates a new email signature
func CreateSignature(c *gin.Context) {
	var signature models.EmailSignature
	if err := c.ShouldBindJSON(&signature); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// If this is set as default, unset other defaults for this user
	if signature.IsDefault {
		database.DB.Model(&models.EmailSignature{}).
			Where("workspace_id = ? AND user_id = ?", signature.WorkspaceID, signature.UserID).
			Update("is_default", false)
	}

	if err := database.DB.Create(&signature).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create signature"})
		return
	}

	c.JSON(http.StatusCreated, signature)
}

// UpdateSignature updates an email signature
func UpdateSignature(c *gin.Context) {
	id := c.Param("id")

	var signature models.EmailSignature
	if err := database.DB.First(&signature, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Signature not found"})
		return
	}

	var updates struct {
		Name        string `json:"name"`
		Content     string `json:"content"`
		ContentHTML string `json:"content_html"`
		IsHTML      bool   `json:"is_html"`
		IsDefault   bool   `json:"is_default"`
	}

	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// If setting as default, unset other defaults
	if updates.IsDefault && !signature.IsDefault {
		database.DB.Model(&models.EmailSignature{}).
			Where("workspace_id = ? AND user_id = ? AND id != ?", signature.WorkspaceID, signature.UserID, signature.ID).
			Update("is_default", false)
	}

	signature.Name = updates.Name
	signature.Content = updates.Content
	signature.ContentHTML = updates.ContentHTML
	signature.IsHTML = updates.IsHTML
	signature.IsDefault = updates.IsDefault

	database.DB.Save(&signature)
	c.JSON(http.StatusOK, signature)
}

// DeleteSignature deletes an email signature
func DeleteSignature(c *gin.Context) {
	id := c.Param("id")

	if err := database.DB.Delete(&models.EmailSignature{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete signature"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
