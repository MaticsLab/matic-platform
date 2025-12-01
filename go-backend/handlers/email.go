package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"sort"
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
	"gorm.io/datatypes"
)

var gmailOAuthConfig *oauth2.Config

// stripHTMLTags removes HTML tags from a string to create plain text version
func stripHTMLTags(html string) string {
	// Remove script and style content
	reScript := regexp.MustCompile(`<script[^>]*>[\s\S]*?</script>`)
	html = reScript.ReplaceAllString(html, "")
	reStyle := regexp.MustCompile(`<style[^>]*>[\s\S]*?</style>`)
	html = reStyle.ReplaceAllString(html, "")

	// Replace br and p tags with newlines
	html = strings.ReplaceAll(html, "<br>", "\n")
	html = strings.ReplaceAll(html, "<br/>", "\n")
	html = strings.ReplaceAll(html, "<br />", "\n")
	html = strings.ReplaceAll(html, "</p>", "\n\n")
	html = strings.ReplaceAll(html, "</div>", "\n")

	// Remove all remaining HTML tags
	reTags := regexp.MustCompile(`<[^>]*>`)
	html = reTags.ReplaceAllString(html, "")

	// Decode common HTML entities
	html = strings.ReplaceAll(html, "&nbsp;", " ")
	html = strings.ReplaceAll(html, "&amp;", "&")
	html = strings.ReplaceAll(html, "&lt;", "<")
	html = strings.ReplaceAll(html, "&gt;", ">")
	html = strings.ReplaceAll(html, "&quot;", "\"")

	// Trim excessive whitespace
	reSpaces := regexp.MustCompile(`[ \t]+`)
	html = reSpaces.ReplaceAllString(html, " ")
	reNewlines := regexp.MustCompile(`\n{3,}`)
	html = reNewlines.ReplaceAllString(html, "\n\n")

	return strings.TrimSpace(html)
}

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
			fmt.Printf("❌ Failed to save Gmail connection: %v\n", err)
			c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/gmail-connected?error=save_failed&details="+err.Error())
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

// RecipientWithData represents a recipient with their submission data for merge tags
// SendEmailRequest represents the request body for sending emails
type SendEmailRequest struct {
	FormID          string   `json:"form_id"`
	Recipients      []string `json:"recipients"`       // Can be "all", "submitted", "approved", "rejected"
	RecipientEmails []string `json:"recipient_emails"` // Direct list of emails to send to
	SubmissionIDs   []string `json:"submission_ids"`   // List of submission IDs - backend looks up data (secure)
	EmailField      string   `json:"email_field"`      // Which field to use as the email address
	Subject         string   `json:"subject" binding:"required"`
	Body            string   `json:"body" binding:"required"`
	BodyHTML        string   `json:"body_html"`
	IsHTML          bool     `json:"is_html"` // If true, Body is HTML content
	MergeTags       bool     `json:"merge_tags"`
	TrackOpens      bool     `json:"track_opens"`
	SaveTemplate    bool     `json:"save_template"`
	TemplateName    string   `json:"template_name"`
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

	// Debug logging
	fmt.Printf("[Email] SendEmail called - FormID: %s, SubmissionIDs: %d, EmailField: %s, MergeTags: %v\n",
		req.FormID, len(req.SubmissionIDs), req.EmailField, req.MergeTags)

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

	// Get recipients - prioritize submission_ids (secure server-side lookup)
	var recipients []Recipient
	if len(req.SubmissionIDs) > 0 {
		// Look up submission data server-side (secure - doesn't expose data to frontend)
		recipients = getRecipientsFromSubmissions(req.FormID, req.SubmissionIDs, req.EmailField)
		fmt.Printf("[Email] Got %d recipients from submission IDs\n", len(recipients))
	} else if len(req.RecipientEmails) > 0 {
		// Direct email list provided - look up submission data for merge tags
		recipients = getRecipientsWithData(req.FormID, req.RecipientEmails)
	} else {
		// Use filter-based recipients
		recipients, err = getRecipients(req.FormID, req.Recipients)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	if len(recipients) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No recipients found"})
		return
	}

	// Handle HTML content - if IsHTML is true, use Body as HTML
	initialBodyHTML := req.BodyHTML
	initialBodyPlain := req.Body
	if req.IsHTML {
		initialBodyHTML = req.Body
		// Create plain text version by stripping tags (basic)
		initialBodyPlain = stripHTMLTags(req.Body)
	}

	// Create campaign if sending to multiple recipients
	var campaign *models.EmailCampaign
	wsUUID, _ := uuid.Parse(workspaceID)

	if len(recipients) > 1 {
		campaign = &models.EmailCampaign{
			WorkspaceID: wsUUID,
			Subject:     req.Subject,
			Body:        initialBodyPlain,
			BodyHTML:    initialBodyHTML,
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
			Body:        initialBodyPlain,
			BodyHTML:    initialBodyHTML,
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
		body := initialBodyPlain
		bodyHTML := initialBodyHTML

		fmt.Printf("[Email] Processing recipient %s, MergeTags=%v, SubmissionData=%v\n",
			recipient.Email, req.MergeTags, recipient.SubmissionData != nil)

		if req.MergeTags && recipient.SubmissionData != nil {
			fmt.Printf("[Email] Applying merge tags for %s with data: %v\n", recipient.Email, getKeys(recipient.SubmissionData))
			subject = processMergeTags(subject, recipient.SubmissionData)
			body = processMergeTags(body, recipient.SubmissionData)
			bodyHTML = processMergeTags(bodyHTML, recipient.SubmissionData)
			fmt.Printf("[Email] After merge - Subject: %s\n", subject)
		} else if req.MergeTags {
			fmt.Printf("[Email] MergeTags enabled but no SubmissionData for %s\n", recipient.Email)
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

// getRecipientsFromSubmissions looks up submission data by submission IDs (secure server-side lookup)
func getRecipientsFromSubmissions(formID string, submissionIDs []string, emailField string) []Recipient {
	var recipients []Recipient

	fmt.Printf("[Email] getRecipientsFromSubmissions called with formID=%s, %d submissionIDs, emailField=%s\n", formID, len(submissionIDs), emailField)

	if len(submissionIDs) == 0 {
		return recipients
	}

	// Query submissions by their IDs
	var rows []models.Row
	if err := database.DB.Where("id IN ?", submissionIDs).Find(&rows).Error; err != nil {
		fmt.Printf("[Email] Error querying rows by IDs: %v\n", err)
		return recipients
	}

	fmt.Printf("[Email] Found %d rows\n", len(rows))

	for _, row := range rows {
		var rowData map[string]interface{}
		if err := json.Unmarshal(row.Data, &rowData); err != nil {
			fmt.Printf("[Email] Error unmarshaling row data for %s: %v\n", row.ID, err)
			continue
		}

		// Find email - use specified emailField if provided, otherwise auto-detect
		var email string
		if emailField != "" {
			// Use the specified field
			if val, ok := rowData[emailField]; ok {
				email = fmt.Sprintf("%v", val)
			}
			fmt.Printf("[Email] Using specified field '%s': %s\n", emailField, email)
		} else {
			// Auto-detect email field
			email = findEmailInData(rowData)
			fmt.Printf("[Email] Auto-detected email: %s\n", email)
		}

		if email == "" || !strings.Contains(email, "@") {
			fmt.Printf("[Email] No valid email found for submission %s\n", row.ID)
			continue
		}

		// Find name from data
		name := findNameInData(rowData)

		recipients = append(recipients, Recipient{
			Email:          email,
			Name:           name,
			SubmissionID:   row.ID.String(),
			SubmissionData: rowData,
		})

		fmt.Printf("[Email] Added recipient: %s <%s> with %d data fields\n", name, email, len(rowData))
	}

	return recipients
}

// getRecipientsWithData looks up submission data for a list of email addresses
func getRecipientsWithData(formID string, emails []string) []Recipient {
	var recipients []Recipient

	fmt.Printf("[Email] getRecipientsWithData called with formID=%s, emails=%v\n", formID, emails)

	// If no formID, we can't look up submission data
	if formID == "" {
		fmt.Println("[Email] No formID provided, returning emails without data")
		for _, email := range emails {
			if strings.Contains(email, "@") {
				recipients = append(recipients, Recipient{Email: email})
			}
		}
		return recipients
	}

	// Query all submissions for this form
	var rows []models.Row
	if err := database.DB.Where("table_id = ?", formID).Find(&rows).Error; err != nil {
		fmt.Printf("[Email] Error querying rows: %v\n", err)
		// If query fails, just return emails without data
		for _, email := range emails {
			if strings.Contains(email, "@") {
				recipients = append(recipients, Recipient{Email: email})
			}
		}
		return recipients
	}

	fmt.Printf("[Email] Found %d rows for form %s\n", len(rows), formID)

	// Create a map of email -> submission data
	emailToData := make(map[string]struct {
		rowID string
		data  map[string]interface{}
		name  string
	})

	for _, row := range rows {
		var rowData map[string]interface{}
		if err := json.Unmarshal(row.Data, &rowData); err != nil {
			fmt.Printf("[Email] Error unmarshaling row data: %v\n", err)
			continue
		}

		fmt.Printf("[Email] Row %s data keys: %v\n", row.ID, getKeys(rowData))

		// Find email in this row
		rowEmail := findEmailInData(rowData)
		if rowEmail == "" {
			fmt.Printf("[Email] No email found in row %s\n", row.ID)
			continue
		}

		fmt.Printf("[Email] Found email %s in row %s\n", rowEmail, row.ID)

		// Store the mapping (lowercase for case-insensitive match)
		emailToData[strings.ToLower(rowEmail)] = struct {
			rowID string
			data  map[string]interface{}
			name  string
		}{
			rowID: row.ID.String(),
			data:  rowData,
			name:  findNameInData(rowData),
		}
	}

	fmt.Printf("[Email] Email to data map has %d entries\n", len(emailToData))

	// Build recipients with their data
	for _, email := range emails {
		if !strings.Contains(email, "@") {
			continue
		}

		recipient := Recipient{Email: email}

		// Look up submission data by email (case-insensitive)
		if subData, found := emailToData[strings.ToLower(email)]; found {
			fmt.Printf("[Email] Found data for %s: %v\n", email, getKeys(subData.data))
			recipient.Name = subData.name
			recipient.SubmissionID = subData.rowID
			recipient.SubmissionData = subData.data
		} else {
			fmt.Printf("[Email] No data found for email %s\n", email)
		}

		recipients = append(recipients, recipient)
	}

	return recipients
}

// Helper to get map keys for logging
func getKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// findAllEmailsInData returns ALL email addresses found in the submission data
func findAllEmailsInData(data map[string]interface{}) []string {
	emails := make(map[string]bool) // Use map to deduplicate

	// Common email field names - check _applicant_email first (stored by form submission)
	emailFields := []string{"_applicant_email", "email", "Email", "EMAIL", "email_address", "emailAddress", "contact_email", "applicant_email", "work_email", "workEmail", "personal_email", "personalEmail", "secondary_email", "alternate_email"}
	for _, field := range emailFields {
		if val, ok := data[field]; ok {
			if email, ok := val.(string); ok && strings.Contains(email, "@") {
				emails[strings.ToLower(strings.TrimSpace(email))] = true
			}
		}
	}

	// Check nested personal.personalEmail
	if personal, ok := data["personal"].(map[string]interface{}); ok {
		if email, ok := personal["personalEmail"].(string); ok && strings.Contains(email, "@") {
			emails[strings.ToLower(strings.TrimSpace(email))] = true
		}
		if email, ok := personal["email"].(string); ok && strings.Contains(email, "@") {
			emails[strings.ToLower(strings.TrimSpace(email))] = true
		}
	}

	// Search all fields for email-like values
	for _, val := range data {
		if str, ok := val.(string); ok && strings.Contains(str, "@") && strings.Contains(str, ".") {
			// Basic email validation
			str = strings.TrimSpace(str)
			if len(str) > 5 && len(str) < 255 {
				emails[strings.ToLower(str)] = true
			}
		}
		// Check if value is a nested object that might contain emails
		if nested, ok := val.(map[string]interface{}); ok {
			for _, nestedVal := range nested {
				if str, ok := nestedVal.(string); ok && strings.Contains(str, "@") && strings.Contains(str, ".") {
					str = strings.TrimSpace(str)
					if len(str) > 5 && len(str) < 255 {
						emails[strings.ToLower(str)] = true
					}
				}
			}
		}
	}

	// Convert map to slice
	result := make([]string, 0, len(emails))
	for email := range emails {
		result = append(result, email)
	}
	return result
}

func findEmailInData(data map[string]interface{}) string {
	// Common email field names - check _applicant_email first (stored by form submission)
	emailFields := []string{"_applicant_email", "email", "Email", "EMAIL", "email_address", "emailAddress", "contact_email", "applicant_email"}
	for _, field := range emailFields {
		if val, ok := data[field]; ok {
			if email, ok := val.(string); ok && strings.Contains(email, "@") {
				fmt.Printf("[Email] Found email in field %s: %s\n", field, email)
				return email
			}
		}
	}

	// Check nested personal.personalEmail
	if personal, ok := data["personal"].(map[string]interface{}); ok {
		if email, ok := personal["personalEmail"].(string); ok && strings.Contains(email, "@") {
			fmt.Printf("[Email] Found email in personal.personalEmail: %s\n", email)
			return email
		}
	}

	// Search all fields for email-like values
	for key, val := range data {
		if str, ok := val.(string); ok && strings.Contains(str, "@") && strings.Contains(str, ".") {
			fmt.Printf("[Email] Found email-like value in field %s: %s\n", key, str)
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
	fmt.Printf("[Email] processMergeTags called with content length=%d, data keys=%v\n", len(content), getKeys(data))

	// First, try exact key matches
	for key, val := range data {
		tag := fmt.Sprintf("{{%s}}", key)
		if str, ok := val.(string); ok {
			if strings.Contains(content, tag) {
				fmt.Printf("[Email] Replacing %s with %s\n", tag, str)
			}
			content = strings.ReplaceAll(content, tag, str)
		} else if val != nil {
			valStr := fmt.Sprintf("%v", val)
			content = strings.ReplaceAll(content, tag, valStr)
		}
	}

	// Also try matching with normalized keys (replace spaces/underscores)
	// This handles cases like {{First Name}} matching first_name or firstName
	tagRegex := regexp.MustCompile(`\{\{([^}]+)\}\}`)
	matches := tagRegex.FindAllStringSubmatch(content, -1)

	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		tagName := match[1] // e.g., "First Name"
		fullTag := match[0] // e.g., "{{First Name}}"

		// Try to find a matching key in data
		normalizedTagName := normalizeFieldName(tagName)

		for key, val := range data {
			normalizedKey := normalizeFieldName(key)

			if normalizedTagName == normalizedKey {
				var valStr string
				if str, ok := val.(string); ok {
					valStr = str
				} else if val != nil {
					valStr = fmt.Sprintf("%v", val)
				}
				fmt.Printf("[Email] Fuzzy match: %s -> %s = %s\n", fullTag, key, valStr)
				content = strings.ReplaceAll(content, fullTag, valStr)
				break
			}
		}
	}

	return content
}

// normalizeFieldName converts field names to a standard format for comparison
func normalizeFieldName(name string) string {
	// Convert to lowercase
	name = strings.ToLower(name)
	// Remove spaces, underscores, dashes
	name = strings.ReplaceAll(name, " ", "")
	name = strings.ReplaceAll(name, "_", "")
	name = strings.ReplaceAll(name, "-", "")
	return name
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

// ==================== SUBMISSION EMAIL HISTORY ====================

// GmailEmail represents an email from Gmail API
type GmailEmail struct {
	ID             string    `json:"id"`
	GmailMessageID string    `json:"gmail_message_id"`
	Subject        string    `json:"subject"`
	RecipientEmail string    `json:"recipient_email"`
	SenderEmail    string    `json:"sender_email"`
	Body           string    `json:"body"`
	BodyHTML       string    `json:"body_html,omitempty"`
	Status         string    `json:"status"`
	SentAt         time.Time `json:"sent_at"`
	Source         string    `json:"source"` // "database" or "gmail"
}

// searchGmailForRecipient searches Gmail for emails sent to a specific recipient
func searchGmailForRecipient(workspaceID string, recipientEmail string) ([]GmailEmail, error) {
	if recipientEmail == "" {
		return nil, nil
	}

	// Get Gmail connection for this workspace
	var connection models.GmailConnection
	if err := database.DB.Where("workspace_id = ?", workspaceID).First(&connection).Error; err != nil {
		fmt.Printf("[Gmail Search] No Gmail connection for workspace %s\n", workspaceID)
		return nil, nil // No connection, just return empty
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
		fmt.Printf("[Gmail Search] Failed to create Gmail service: %v\n", err)
		return nil, err
	}

	// Search for emails sent to this recipient
	query := fmt.Sprintf("to:%s in:sent", recipientEmail)
	fmt.Printf("[Gmail Search] Searching with query: %s\n", query)

	result, err := gmailService.Users.Messages.List("me").Q(query).MaxResults(50).Do()
	if err != nil {
		fmt.Printf("[Gmail Search] Search failed: %v\n", err)
		return nil, err
	}

	fmt.Printf("[Gmail Search] Found %d messages\n", len(result.Messages))

	var emails []GmailEmail
	for _, msg := range result.Messages {
		// Get full message details
		fullMsg, err := gmailService.Users.Messages.Get("me", msg.Id).Format("full").Do()
		if err != nil {
			fmt.Printf("[Gmail Search] Failed to get message %s: %v\n", msg.Id, err)
			continue
		}

		email := GmailEmail{
			ID:             msg.Id,
			GmailMessageID: msg.Id,
			RecipientEmail: recipientEmail,
			SenderEmail:    connection.Email,
			Status:         "sent",
			Source:         "gmail",
		}

		// Parse headers
		for _, header := range fullMsg.Payload.Headers {
			switch header.Name {
			case "Subject":
				email.Subject = header.Value
			case "Date":
				if t, err := time.Parse(time.RFC1123Z, header.Value); err == nil {
					email.SentAt = t
				} else if t, err := time.Parse("Mon, 2 Jan 2006 15:04:05 -0700", header.Value); err == nil {
					email.SentAt = t
				} else if t, err := time.Parse("Mon, 2 Jan 2006 15:04:05 -0700 (MST)", header.Value); err == nil {
					email.SentAt = t
				}
			}
		}

		// Get snippet as body preview
		email.Body = fullMsg.Snippet

		emails = append(emails, email)
	}

	return emails, nil
}

// GetSubmissionEmailHistory returns all emails sent to a specific submission/applicant
func GetSubmissionEmailHistory(c *gin.Context) {
	submissionID := c.Param("id")
	workspaceID := c.Query("workspace_id")

	if submissionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "submission_id is required"})
		return
	}

	fmt.Printf("[Email History] Looking up emails for submission: %s, workspace: %s\n", submissionID, workspaceID)

	// First get the submission to find the recipient email and workspace
	var submission struct {
		ID          string         `gorm:"column:id"`
		Data        datatypes.JSON `gorm:"column:data"`
		WorkspaceID *string        `gorm:"column:workspace_id"`
		TableID     *string        `gorm:"column:table_id"`
	}
	if err := database.DB.Table("table_rows").Select("id, data, workspace_id, table_id").Where("id = ?", submissionID).First(&submission).Error; err != nil {
		fmt.Printf("[Email History] Submission not found: %s, error: %v\n", submissionID, err)
		c.JSON(http.StatusOK, []interface{}{})
		return
	}

	// Use workspace_id from query or submission
	if workspaceID == "" && submission.WorkspaceID != nil {
		workspaceID = *submission.WorkspaceID
	}
	// If still no workspace_id, try to get it from the table
	if workspaceID == "" && submission.TableID != nil {
		var table struct {
			WorkspaceID string `gorm:"column:workspace_id"`
		}
		database.DB.Table("data_tables").Select("workspace_id").Where("id = ?", *submission.TableID).First(&table)
		workspaceID = table.WorkspaceID
	}

	// Parse the data to find email
	var data map[string]interface{}
	if err := json.Unmarshal(submission.Data, &data); err != nil {
		fmt.Printf("[Email History] Failed to parse submission data: %v\n", err)
		c.JSON(http.StatusOK, []interface{}{})
		return
	}

	// Find ALL emails in the submission data (supports multiple email fields)
	recipientEmails := findAllEmailsInData(data)
	fmt.Printf("[Email History] Found %d recipient emails: %v\n", len(recipientEmails), recipientEmails)

	// Query database for emails - search by submission_id OR any of the recipient emails
	var dbEmails []models.SentEmail
	if len(recipientEmails) > 0 {
		database.DB.Where("submission_id = ? OR recipient_email IN ?", submissionID, recipientEmails).
			Order("sent_at DESC").
			Find(&dbEmails)
	} else {
		database.DB.Where("submission_id = ?", submissionID).
			Order("sent_at DESC").
			Find(&dbEmails)
	}

	fmt.Printf("[Email History] Found %d emails in database\n", len(dbEmails))

	// Also search Gmail for each recipient email
	var gmailEmails []GmailEmail
	if workspaceID != "" && len(recipientEmails) > 0 {
		for _, email := range recipientEmails {
			emails, _ := searchGmailForRecipient(workspaceID, email)
			gmailEmails = append(gmailEmails, emails...)
		}
		fmt.Printf("[Email History] Found %d emails in Gmail\n", len(gmailEmails))
	}

	// Combine results, deduplicating by gmail_message_id
	seenMessageIDs := make(map[string]bool)
	var combinedEmails []interface{}

	// Add database emails first (they have more metadata)
	for _, email := range dbEmails {
		if email.GmailMessageID != "" {
			seenMessageIDs[email.GmailMessageID] = true
		}
		combinedEmails = append(combinedEmails, email)
	}

	// Add Gmail emails that aren't in database
	for _, email := range gmailEmails {
		if !seenMessageIDs[email.GmailMessageID] {
			combinedEmails = append(combinedEmails, email)
		}
	}

	fmt.Printf("[Email History] Returning %d total emails\n", len(combinedEmails))

	c.JSON(http.StatusOK, combinedEmails)
}

// GetSubmissionActivity returns activity log for a specific submission
func GetSubmissionActivity(c *gin.Context) {
	submissionID := c.Param("id")

	if submissionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "submission_id is required"})
		return
	}

	fmt.Printf("[Email Activity] Looking up activity for submission: %s\n", submissionID)

	// First get the submission to find the recipient email
	var submission struct {
		ID   string         `gorm:"column:id"`
		Data datatypes.JSON `gorm:"column:data"`
	}
	if err := database.DB.Table("table_rows").Select("id, data").Where("id = ?", submissionID).First(&submission).Error; err != nil {
		fmt.Printf("[Email Activity] Submission not found: %s\n", submissionID)
		c.JSON(http.StatusOK, []interface{}{}) // Return empty array instead of error
		return
	}

	// Parse the data to find email
	var data map[string]interface{}
	if err := json.Unmarshal(submission.Data, &data); err != nil {
		fmt.Printf("[Email Activity] Failed to parse submission data: %v\n", err)
		c.JSON(http.StatusOK, []interface{}{})
		return
	}

	// Find ALL emails in the submission data
	recipientEmails := findAllEmailsInData(data)
	fmt.Printf("[Email Activity] Found %d recipient emails: %v\n", len(recipientEmails), recipientEmails)

	// Get emails sent to this submission (by submission_id OR any email address)
	var emails []models.SentEmail
	if len(recipientEmails) > 0 {
		database.DB.Where("submission_id = ? OR recipient_email IN ?", submissionID, recipientEmails).
			Order("sent_at DESC").
			Limit(50).
			Find(&emails)
	} else {
		database.DB.Where("submission_id = ?", submissionID).
			Order("sent_at DESC").
			Limit(50).
			Find(&emails)
	}

	fmt.Printf("[Email Activity] Found %d emails\n", len(emails))

	// Build activity items from emails
	type ActivityItem struct {
		Type        string      `json:"type"`
		Title       string      `json:"title"`
		Description string      `json:"description"`
		Timestamp   time.Time   `json:"timestamp"`
		Data        interface{} `json:"data,omitempty"`
	}

	var activities []ActivityItem

	for _, email := range emails {
		activity := ActivityItem{
			Type:        "email_sent",
			Title:       "Email Sent",
			Description: email.Subject,
			Timestamp:   email.SentAt,
			Data: map[string]interface{}{
				"email_id":   email.ID,
				"recipient":  email.RecipientEmail,
				"status":     email.Status,
				"opened_at":  email.OpenedAt,
				"open_count": email.OpenCount,
			},
		}

		// Add opened event if email was opened
		if email.OpenedAt != nil {
			activities = append(activities, ActivityItem{
				Type:        "email_opened",
				Title:       "Email Opened",
				Description: email.Subject,
				Timestamp:   *email.OpenedAt,
				Data: map[string]interface{}{
					"email_id":   email.ID,
					"open_count": email.OpenCount,
				},
			})
		}

		activities = append(activities, activity)
	}

	// Sort by timestamp descending
	sort.Slice(activities, func(i, j int) bool {
		return activities[i].Timestamp.After(activities[j].Timestamp)
	})

	c.JSON(http.StatusOK, activities)
}
