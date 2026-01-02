package handlers

import (
	"crypto/rand"
	"encoding/hex"
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
	"github.com/resend/resend-go/v2"
)

// generateRecommendationToken creates a secure random token for recommendation links
func generateRecommendationToken() string {
	bytes := make([]byte, 24)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// GetRecommendationRequests returns all recommendation requests for a submission
func GetRecommendationRequests(c *gin.Context) {
	submissionID := c.Query("submission_id")
	if submissionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "submission_id is required"})
		return
	}

	var requests []models.RecommendationRequest
	if err := database.DB.Where("submission_id = ?", submissionID).
		Order("created_at ASC").
		Find(&requests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recommendation requests"})
		return
	}

	c.JSON(http.StatusOK, requests)
}

// GetRecommendationRequest returns a single recommendation request by ID
func GetRecommendationRequest(c *gin.Context) {
	id := c.Param("id")

	var request models.RecommendationRequest
	if err := database.DB.First(&request, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recommendation request not found"})
		return
	}

	c.JSON(http.StatusOK, request)
}

// GetRecommendationByToken returns a recommendation request by its token (public endpoint)
func GetRecommendationByToken(c *gin.Context) {
	token := c.Param("token")

	var request models.RecommendationRequest
	if err := database.DB.First(&request, "token = ?", token).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recommendation request not found or link has expired"})
		return
	}

	// Check if expired
	if request.ExpiresAt != nil && time.Now().After(*request.ExpiresAt) {
		c.JSON(http.StatusGone, gin.H{"error": "This recommendation request has expired"})
		return
	}

	// Check if already submitted
	if request.Status == "submitted" {
		c.JSON(http.StatusGone, gin.H{"error": "This recommendation has already been submitted"})
		return
	}

	// Get submission data for context
	var submission models.Row
	database.DB.First(&submission, "id = ?", request.SubmissionID)

	// Get form info
	var form models.Table
	database.DB.First(&form, "id = ?", request.FormID)

	// Get applicant info from submission data
	applicantName := ""
	applicantEmail := ""
	if submission.Data != nil {
		var data map[string]interface{}
		json.Unmarshal(submission.Data, &data)

		// Try to find name and email fields
		for key, value := range data {
			keyLower := strings.ToLower(key)
			if str, ok := value.(string); ok {
				if strings.Contains(keyLower, "name") && applicantName == "" {
					applicantName = str
				}
				if strings.Contains(keyLower, "email") && applicantEmail == "" {
					applicantEmail = str
				}
			}
		}
	}

	// Get field config for questions
	var fieldConfig models.RecommendationFieldConfig
	var field models.Field
	if err := database.DB.Where("table_id = ? AND id = ?", request.FormID, request.FieldID).First(&field).Error; err == nil {
		if field.Config != nil {
			json.Unmarshal(field.Config, &fieldConfig)
		}
	}

	response := gin.H{
		"request":         request,
		"applicant_name":  applicantName,
		"applicant_email": applicantEmail,
		"form_title":      form.Name,
		"questions":       fieldConfig.Questions,
		"instructions":    fieldConfig.Instructions,
	}

	c.JSON(http.StatusOK, response)
}

// CreateRecommendationRequest creates a new recommendation request and sends email
func CreateRecommendationRequest(c *gin.Context) {
	var input models.CreateRecommendationRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate submission exists
	var submission models.Row
	if err := database.DB.First(&submission, "id = ?", input.SubmissionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Validate form exists
	var form models.Table
	if err := database.DB.First(&form, "id = ?", input.FormID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	// Get field config
	var fieldConfig models.RecommendationFieldConfig
	var field models.Field
	if err := database.DB.Where("table_id = ? AND id = ?", input.FormID, input.FieldID).First(&field).Error; err == nil {
		if field.Config != nil {
			json.Unmarshal(field.Config, &fieldConfig)
		}
	}

	// Set defaults if not configured
	if fieldConfig.MaxRecommenders == 0 {
		fieldConfig.MaxRecommenders = 3
	}
	if fieldConfig.DeadlineDays == 0 {
		fieldConfig.DeadlineDays = 14
	}

	// Check max recommenders
	var existingCount int64
	database.DB.Model(&models.RecommendationRequest{}).
		Where("submission_id = ? AND field_id = ? AND status != ?", input.SubmissionID, input.FieldID, "cancelled").
		Count(&existingCount)

	if int(existingCount) >= fieldConfig.MaxRecommenders {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Maximum of %d recommenders allowed", fieldConfig.MaxRecommenders)})
		return
	}

	// Check for duplicate email
	var existingRequest models.RecommendationRequest
	if err := database.DB.Where("submission_id = ? AND field_id = ? AND recommender_email = ? AND status != ?",
		input.SubmissionID, input.FieldID, input.RecommenderEmail, "cancelled").
		First(&existingRequest).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A recommendation request has already been sent to this email"})
		return
	}

	// Calculate expiry date
	var expiresAt *time.Time
	if fieldConfig.DeadlineDays > 0 {
		expiry := time.Now().AddDate(0, 0, fieldConfig.DeadlineDays)
		expiresAt = &expiry
	}

	// Create the request
	submissionUUID, _ := uuid.Parse(input.SubmissionID)
	formUUID, _ := uuid.Parse(input.FormID)

	request := models.RecommendationRequest{
		SubmissionID:            submissionUUID,
		FormID:                  formUUID,
		FieldID:                 input.FieldID,
		RecommenderName:         input.RecommenderName,
		RecommenderEmail:        input.RecommenderEmail,
		RecommenderRelationship: input.RecommenderRelationship,
		RecommenderOrganization: input.RecommenderOrganization,
		Token:                   generateRecommendationToken(),
		Status:                  "pending",
		ExpiresAt:               expiresAt,
	}

	if err := database.DB.Create(&request).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create recommendation request"})
		return
	}

	fmt.Printf("[Recommendations] Created recommendation request ID: %s for email: %s\n", request.ID.String(), request.RecommenderEmail)

	// Send email asynchronously
	go func() {
		if err := sendRecommendationRequestEmail(&request, &submission, &form, &fieldConfig); err != nil {
			fmt.Printf("[Recommendations] Email send failed: %v\n", err)
		}
	}()

	c.JSON(http.StatusCreated, request)
}

// sendRecommendationRequestEmail sends the recommendation request email via Resend
func sendRecommendationRequestEmail(request *models.RecommendationRequest, submission *models.Row, form *models.Table, config *models.RecommendationFieldConfig) error {
	fmt.Printf("[Recommendations] Starting to send email to: %s\n", request.RecommenderEmail)

	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		fmt.Println("[Recommendations] ERROR: RESEND_API_KEY not configured, skipping email")
		return fmt.Errorf("RESEND_API_KEY not configured")
	}

	fmt.Printf("[Recommendations] RESEND_API_KEY found (length: %d)\n", len(apiKey))

	client := resend.NewClient(apiKey)

	// Get applicant info
	applicantName := "the applicant"
	if submission.Data != nil {
		var data map[string]interface{}
		json.Unmarshal(submission.Data, &data)
		for key, value := range data {
			keyLower := strings.ToLower(key)
			if strings.Contains(keyLower, "name") {
				if str, ok := value.(string); ok && str != "" {
					applicantName = str
					break
				}
			}
		}
	}

	// Build the recommendation link
	baseURL := os.Getenv("NEXT_PUBLIC_APP_URL")
	if baseURL == "" {
		baseURL = "http://localhost:3000"
	}
	recommendationLink := fmt.Sprintf("%s/recommend/%s", baseURL, request.Token)

	// Format deadline
	deadline := "No deadline"
	if request.ExpiresAt != nil {
		deadline = request.ExpiresAt.Format("January 2, 2006")
	}

	// Use custom template or default
	subject := config.EmailTemplate.Subject
	if subject == "" {
		subject = fmt.Sprintf("Recommendation Request for %s", applicantName)
	}

	body := config.EmailTemplate.Body
	if body == "" {
		body = fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Recommendation Request</h1>
    </div>
    <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Dear %s,</p>
        <p><strong>%s</strong> has listed you as a recommender for their application to <strong>%s</strong>.</p>
        <p>Please click the button below to submit your recommendation:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="%s" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Submit Recommendation</a>
        </div>
        <p style="font-size: 14px; color: #6b7280;">Or copy this link: <a href="%s" style="color: #667eea;">%s</a></p>
        <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin-top: 20px;">
            <p style="margin: 0; font-size: 14px;"><strong>Deadline:</strong> %s</p>
        </div>
        <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">Thank you for taking the time to support this applicant.</p>
    </div>
</body>
</html>
`, request.RecommenderName, applicantName, form.Name, recommendationLink, recommendationLink, recommendationLink, deadline)
	} else {
		// Replace merge tags
		body = strings.ReplaceAll(body, "{{recommender_name}}", request.RecommenderName)
		body = strings.ReplaceAll(body, "{{applicant_name}}", applicantName)
		body = strings.ReplaceAll(body, "{{form_title}}", form.Name)
		body = strings.ReplaceAll(body, "{{link}}", recommendationLink)
		body = strings.ReplaceAll(body, "{{deadline}}", deadline)

		subject = strings.ReplaceAll(subject, "{{recommender_name}}", request.RecommenderName)
		subject = strings.ReplaceAll(subject, "{{applicant_name}}", applicantName)
		subject = strings.ReplaceAll(subject, "{{form_title}}", form.Name)
	}

	fromEmail := os.Getenv("RESEND_FROM_EMAIL")
	if fromEmail == "" {
		fromEmail = "Matic <noreply@notifications.maticsapp.com>"
	}

	fmt.Printf("[Recommendations] Sending email from: %s to: %s, subject: %s\n", fromEmail, request.RecommenderEmail, subject)

	params := &resend.SendEmailRequest{
		From:    fromEmail,
		To:      []string{request.RecommenderEmail},
		Subject: subject,
		Html:    body,
	}

	fmt.Printf("[Recommendations] Calling Resend API...\n")
	sent, err := client.Emails.Send(params)
	if err != nil {
		fmt.Printf("[Recommendations] ERROR: Failed to send email via Resend: %v\n", err)
		return err
	}

	fmt.Printf("[Recommendations] SUCCESS: Email sent to %s, Resend ID: %s\n", request.RecommenderEmail, sent.Id)
	return nil
}

// SubmitRecommendation handles the recommender submitting their recommendation
func SubmitRecommendation(c *gin.Context) {
	token := c.Param("token")

	var input struct {
		Response map[string]interface{} `json:"response" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var request models.RecommendationRequest
	if err := database.DB.First(&request, "token = ?", token).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recommendation request not found"})
		return
	}

	// Check if already submitted
	if request.Status == "submitted" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This recommendation has already been submitted"})
		return
	}

	// Check if expired
	if request.ExpiresAt != nil && time.Now().After(*request.ExpiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This recommendation request has expired"})
		return
	}

	// Update the request
	responseJSON, _ := json.Marshal(input.Response)
	now := time.Now()

	request.Response = responseJSON
	request.Status = "submitted"
	request.SubmittedAt = &now

	if err := database.DB.Save(&request).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save recommendation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Recommendation submitted successfully",
		"request": request,
	})
}

// SendRecommendationReminder sends a reminder email
func SendRecommendationReminder(c *gin.Context) {
	id := c.Param("id")

	var request models.RecommendationRequest
	if err := database.DB.First(&request, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recommendation request not found"})
		return
	}

	if request.Status == "submitted" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Recommendation has already been submitted"})
		return
	}

	// Get form and submission for email
	var submission models.Row
	database.DB.First(&submission, "id = ?", request.SubmissionID)

	var form models.Table
	database.DB.First(&form, "id = ?", request.FormID)

	// Get field config
	var fieldConfig models.RecommendationFieldConfig
	var field models.Field
	if err := database.DB.Where("table_id = ? AND id = ?", request.FormID, request.FieldID).First(&field).Error; err == nil {
		if field.Config != nil {
			json.Unmarshal(field.Config, &fieldConfig)
		}
	}

	// Send reminder email
	if err := sendRecommendationReminderEmail(&request, &submission, &form, &fieldConfig); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send reminder email"})
		return
	}

	// Update reminder tracking
	now := time.Now()
	request.RemindedAt = &now
	request.ReminderCount++
	database.DB.Save(&request)

	c.JSON(http.StatusOK, gin.H{"message": "Reminder sent successfully"})
}

func sendRecommendationReminderEmail(request *models.RecommendationRequest, submission *models.Row, form *models.Table, config *models.RecommendationFieldConfig) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("RESEND_API_KEY not configured")
	}

	client := resend.NewClient(apiKey)

	// Get applicant info
	applicantName := "the applicant"
	if submission.Data != nil {
		var data map[string]interface{}
		json.Unmarshal(submission.Data, &data)
		for key, value := range data {
			keyLower := strings.ToLower(key)
			if strings.Contains(keyLower, "name") {
				if str, ok := value.(string); ok && str != "" {
					applicantName = str
					break
				}
			}
		}
	}

	// Build the recommendation link
	baseURL := os.Getenv("NEXT_PUBLIC_APP_URL")
	if baseURL == "" {
		baseURL = "http://localhost:3000"
	}
	recommendationLink := fmt.Sprintf("%s/recommend/%s", baseURL, request.Token)

	// Format deadline
	deadline := "No deadline"
	if request.ExpiresAt != nil {
		deadline = request.ExpiresAt.Format("January 2, 2006")
	}

	subject := config.EmailTemplate.ReminderSubject
	if subject == "" {
		subject = fmt.Sprintf("Reminder: Recommendation Request for %s", applicantName)
	}

	body := config.EmailTemplate.ReminderBody
	if body == "" {
		body = fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #f59e0b 0%%, #d97706 100%%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Reminder: Recommendation Request</h1>
    </div>
    <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Dear %s,</p>
        <p>This is a friendly reminder that <strong>%s</strong> is waiting for your recommendation for their application to <strong>%s</strong>.</p>
        <p>Please click the button below to submit your recommendation:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="%s" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #f59e0b 0%%, #d97706 100%%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Submit Recommendation</a>
        </div>
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border: 1px solid #fcd34d; margin-top: 20px;">
            <p style="margin: 0; font-size: 14px; color: #92400e;"><strong>⚠️ Deadline:</strong> %s</p>
        </div>
        <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">Thank you for your time.</p>
    </div>
</body>
</html>
`, request.RecommenderName, applicantName, form.Name, recommendationLink, deadline)
	} else {
		body = strings.ReplaceAll(body, "{{recommender_name}}", request.RecommenderName)
		body = strings.ReplaceAll(body, "{{applicant_name}}", applicantName)
		body = strings.ReplaceAll(body, "{{form_title}}", form.Name)
		body = strings.ReplaceAll(body, "{{link}}", recommendationLink)
		body = strings.ReplaceAll(body, "{{deadline}}", deadline)

		subject = strings.ReplaceAll(subject, "{{recommender_name}}", request.RecommenderName)
		subject = strings.ReplaceAll(subject, "{{applicant_name}}", applicantName)
		subject = strings.ReplaceAll(subject, "{{form_title}}", form.Name)
	}

	fromEmail := os.Getenv("RESEND_FROM_EMAIL")
	if fromEmail == "" {
		fromEmail = "Matic <noreply@notifications.maticsapp.com>"
	}

	params := &resend.SendEmailRequest{
		From:    fromEmail,
		To:      []string{request.RecommenderEmail},
		Subject: subject,
		Html:    body,
	}

	_, err := client.Emails.Send(params)
	return err
}

// CancelRecommendationRequest cancels a pending recommendation request
func CancelRecommendationRequest(c *gin.Context) {
	id := c.Param("id")

	var request models.RecommendationRequest
	if err := database.DB.First(&request, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recommendation request not found"})
		return
	}

	if request.Status == "submitted" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot cancel a submitted recommendation"})
		return
	}

	request.Status = "cancelled"
	database.DB.Save(&request)

	c.JSON(http.StatusOK, gin.H{"message": "Recommendation request cancelled"})
}

// GetRecommendationsForReview returns all recommendations for a submission (for reviewers)
func GetRecommendationsForReview(c *gin.Context) {
	submissionID := c.Param("submissionId")

	var requests []models.RecommendationRequest
	if err := database.DB.Where("submission_id = ?", submissionID).
		Order("created_at ASC").
		Find(&requests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recommendations"})
		return
	}

	c.JSON(http.StatusOK, requests)
}
