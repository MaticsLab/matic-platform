package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
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

// rewriteLocalhostURLs fixes old localhost URLs in recommendation response JSONB
func rewriteLocalhostURLs(response []byte) ([]byte, error) {
	if len(response) == 0 {
		return response, nil
	}

	var responseData map[string]interface{}
	if err := json.Unmarshal(response, &responseData); err != nil {
		return response, nil // Return original if can't parse
	}

	// Check if uploaded_document exists and has a url
	if uploadedDoc, ok := responseData["uploaded_document"].(map[string]interface{}); ok {
		if url, ok := uploadedDoc["url"].(string); ok {
			// Rewrite localhost URLs
			if strings.Contains(url, "localhost:8080") || strings.Contains(url, "localhost:8000") {
				url = strings.ReplaceAll(url, "http://localhost:8080", "https://backend.maticslab.com")
				url = strings.ReplaceAll(url, "http://localhost:8000", "https://backend.maticslab.com")
				url = strings.ReplaceAll(url, "https://localhost:8080", "https://backend.maticslab.com")
				uploadedDoc["url"] = url
				responseData["uploaded_document"] = uploadedDoc
			}
		}
	}

	return json.Marshal(responseData)
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

	// Rewrite localhost URLs in responses
	for i := range requests {
		if len(requests[i].Response) > 0 {
			rewritten, err := rewriteLocalhostURLs(requests[i].Response)
			if err == nil {
				requests[i].Response = rewritten
			}
		}
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

	// Rewrite localhost URLs in response
	if len(request.Response) > 0 {
		rewritten, err := rewriteLocalhostURLs(request.Response)
		if err == nil {
			request.Response = rewritten
		}
	}

	c.JSON(http.StatusOK, request)
}

// GetRecommendationByToken returns a recommendation request by its token (public endpoint)
func GetRecommendationByToken(c *gin.Context) {
	token := c.Param("token")

	fmt.Printf("[Recommendations] GetByToken called with token: %s\n", token)

	var request models.RecommendationRequest
	if err := database.DB.First(&request, "token = ?", token).Error; err != nil {
		fmt.Printf("[Recommendations] Token not found in database: %s\n", token)
		c.JSON(http.StatusNotFound, gin.H{"error": "Recommendation request not found or link has expired"})
		return
	}

	fmt.Printf("[Recommendations] Found request ID: %s, Status: %s, SubmissionID: %s\n",
		request.ID.String(), request.Status, request.SubmissionID.String())

	// Check if expired
	if request.ExpiresAt != nil && time.Now().After(*request.ExpiresAt) {
		c.JSON(http.StatusGone, gin.H{"error": "This recommendation request has expired"})
		return
	}

	// Check if already submitted - but provide helpful context
	if request.Status == "submitted" {
		// Get applicant info to help user understand which submission this was for
		var submission models.Row
		database.DB.First(&submission, "id = ?", request.SubmissionID)

		applicantName := "the applicant"
		if submission.Data != nil {
			var data map[string]interface{}
			json.Unmarshal(submission.Data, &data)

			// Try to get applicant name from common fields
			for key, value := range data {
				keyLower := strings.ToLower(key)
				if str, ok := value.(string); ok && str != "" {
					if keyLower == "full_name" || keyLower == "fullname" || keyLower == "name" ||
						keyLower == "first_name" || keyLower == "firstname" {
						applicantName = str
						break
					}
				}
			}
		}

		submittedAt := ""
		if request.SubmittedAt != nil {
			submittedAt = request.SubmittedAt.Format("January 2, 2006")
		}

		fmt.Printf("[Recommendations] Request already submitted for applicant: %s on %s\n", applicantName, submittedAt)
		c.JSON(http.StatusGone, gin.H{
			"error":   "This recommendation has already been submitted",
			"details": fmt.Sprintf("You submitted a recommendation for %s on %s. If you received a new request for a different applicant, please check your email for the correct link.", applicantName, submittedAt),
		})
		return
	}

	// Get submission data for context
	var submission models.Row
	database.DB.First(&submission, "id = ?", request.SubmissionID)

	// Get form info
	var form models.Table
	database.DB.First(&form, "id = ?", request.FormID)

	// Get field config for questions and merge tag mappings
	var fieldConfig models.RecommendationFieldConfig
	var field models.Field
	if err := database.DB.Where("table_id = ? AND id = ?", request.FormID, request.FieldID).First(&field).Error; err == nil {
		if field.Config != nil {
			json.Unmarshal(field.Config, &fieldConfig)
		}
	}

	// Get applicant info from submission data using configured field mappings or auto-detection
	applicantName := ""
	applicantEmail := ""

	if submission.Data != nil {
		var data map[string]interface{}
		json.Unmarshal(submission.Data, &data)

		// Check for configured field mappings first
		if fieldConfig.MergeTagFields.ApplicantName != "" {
			if val, ok := data[fieldConfig.MergeTagFields.ApplicantName]; ok {
				if str, ok := val.(string); ok && str != "" {
					applicantName = str
				}
			}
		}

		if fieldConfig.MergeTagFields.ApplicantEmail != "" {
			if val, ok := data[fieldConfig.MergeTagFields.ApplicantEmail]; ok {
				if str, ok := val.(string); ok && str != "" {
					applicantEmail = str
				}
			}
		}

		// Fall back to auto-detection for applicant name if not configured or not found
		if applicantName == "" {
			firstName := ""
			lastName := ""

			for key, value := range data {
				keyLower := strings.ToLower(key)
				if str, ok := value.(string); ok && str != "" {
					// Check for full name first
					if keyLower == "full_name" || keyLower == "fullname" || keyLower == "applicant_name" || keyLower == "name" {
						applicantName = str
					}
					// Track first/last name for fallback
					if keyLower == "first_name" || keyLower == "firstname" {
						firstName = str
					}
					if keyLower == "last_name" || keyLower == "lastname" {
						lastName = str
					}
				}
			}

			// If no full name found, try to combine first + last
			if applicantName == "" && (firstName != "" || lastName != "") {
				applicantName = strings.TrimSpace(firstName + " " + lastName)
			}

			// Final fallback - look for any field containing "name" (but not "recommender")
			if applicantName == "" {
				for key, value := range data {
					keyLower := strings.ToLower(key)
					if strings.Contains(keyLower, "name") && !strings.Contains(keyLower, "recommender") {
						if str, ok := value.(string); ok && str != "" {
							applicantName = str
							break
						}
					}
				}
			}
		}

		// Fall back to auto-detection for applicant email if not configured or not found
		if applicantEmail == "" {
			for key, value := range data {
				keyLower := strings.ToLower(key)
				if strings.Contains(keyLower, "email") && !strings.Contains(keyLower, "recommender") {
					if str, ok := value.(string); ok && str != "" {
						applicantEmail = str
						break
					}
				}
			}
		}
	}

	// Rewrite localhost URLs in response before returning
	if len(request.Response) > 0 {
		rewritten, err := rewriteLocalhostURLs(request.Response)
		if err == nil {
			request.Response = rewritten
		}
	}

	response := gin.H{
		"request":              request,
		"applicant_name":       applicantName,
		"applicant_email":      applicantEmail,
		"form_title":           form.Name,
		"questions":            fieldConfig.Questions,
		"instructions":         fieldConfig.Instructions,
		"require_relationship": fieldConfig.RequireRelationship,
		"show_file_upload":     fieldConfig.ShowFileUpload,
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
			fmt.Printf("[Recommendations] Raw field.Config: %s\n", string(field.Config))
			if err := json.Unmarshal(field.Config, &fieldConfig); err != nil {
				fmt.Printf("[Recommendations] Failed to unmarshal field config: %v\n", err)
			}
		} else {
			fmt.Printf("[Recommendations] Field config is nil\n")
		}
	} else {
		fmt.Printf("[Recommendations] Could not find field: %v\n", err)
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

	// Check for duplicate email - if exists and pending, send reminder instead
	var existingRequest models.RecommendationRequest
	if err := database.DB.Where("submission_id = ? AND field_id = ? AND recommender_email = ? AND status != ?",
		input.SubmissionID, input.FieldID, input.RecommenderEmail, "cancelled").
		First(&existingRequest).Error; err == nil {
		// Request already exists - send a reminder if still pending
		if existingRequest.Status == "pending" {
			// Send reminder email
			if err := sendRecommendationReminderEmail(&existingRequest, &submission, &form, &fieldConfig); err != nil {
				fmt.Printf("[Recommendations] Failed to send reminder email: %v\n", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send reminder email"})
				return
			}

			// Update reminder count and timestamp
			now := time.Now()
			existingRequest.ReminderCount++
			existingRequest.RemindedAt = &now
			database.DB.Save(&existingRequest)

			fmt.Printf("[Recommendations] Sent reminder for existing request ID: %s\n", existingRequest.ID.String())
			c.JSON(http.StatusOK, gin.H{
				"message":     "Reminder sent successfully",
				"request":     existingRequest,
				"is_reminder": true,
			})
			return
		} else {
			// Request exists but already submitted
			c.JSON(http.StatusBadRequest, gin.H{"error": "A recommendation has already been submitted by this email"})
			return
		}
	}

	// Calculate expiry date - support both fixed and relative deadlines
	var expiresAt *time.Time

	// Debug: Log the field config to see what we're getting
	configJSON, _ := json.Marshal(fieldConfig)
	fmt.Printf("[Recommendations] Field config: %s\n", string(configJSON))
	fmt.Printf("[Recommendations] DeadlineType: '%s', FixedDeadline: '%s'\n", fieldConfig.DeadlineType, fieldConfig.FixedDeadline)

	if fieldConfig.DeadlineType == "fixed" && fieldConfig.FixedDeadline != "" {
		// Parse the fixed deadline (ISO format from datetime-local input)
		// Handle both formats: with and without seconds
		fmt.Printf("[Recommendations] Using fixed deadline: %s\n", fieldConfig.FixedDeadline)
		parsed, err := time.Parse("2006-01-02T15:04", fieldConfig.FixedDeadline)
		if err != nil {
			fmt.Printf("[Recommendations] Failed to parse with format 2006-01-02T15:04: %v\n", err)
			parsed, err = time.Parse("2006-01-02T15:04:05", fieldConfig.FixedDeadline)
		}
		if err == nil {
			expiresAt = &parsed
			fmt.Printf("[Recommendations] Parsed deadline: %v\n", expiresAt)
		} else {
			fmt.Printf("[Recommendations] Failed to parse fixed deadline: %v\n", err)
		}
	} else {
		fmt.Printf("[Recommendations] Using relative deadline\n")
		// Relative deadline (days from now)
		deadlineDays := fieldConfig.DeadlineDays
		if deadlineDays == 0 {
			deadlineDays = fieldConfig.DeadlineDaysFE // Try frontend field name
		}
		if deadlineDays > 0 {
			expiry := time.Now().AddDate(0, 0, deadlineDays)
			expiresAt = &expiry
		}
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

	// Get applicant info using configured field mappings or auto-detection
	applicantName := ""
	applicantEmail := ""

	if submission.Data != nil {
		var data map[string]interface{}
		json.Unmarshal(submission.Data, &data)

		// Check for configured field mappings first
		if config.MergeTagFields.ApplicantName != "" {
			// Try to get value from configured field ID
			if val, ok := data[config.MergeTagFields.ApplicantName]; ok {
				if str, ok := val.(string); ok && str != "" {
					applicantName = str
				}
			}
		}

		if config.MergeTagFields.ApplicantEmail != "" {
			if val, ok := data[config.MergeTagFields.ApplicantEmail]; ok {
				if str, ok := val.(string); ok && str != "" {
					applicantEmail = str
				}
			}
		}

		// Fall back to auto-detection for applicant name if not configured or not found
		if applicantName == "" {
			firstName := ""
			lastName := ""

			// Look for full name fields first
			for key, value := range data {
				keyLower := strings.ToLower(key)
				if str, ok := value.(string); ok && str != "" {
					// Check for full name
					if keyLower == "full_name" || keyLower == "fullname" || keyLower == "applicant_name" || keyLower == "name" {
						applicantName = str
						break
					}
					// Track first/last name for fallback
					if keyLower == "first_name" || keyLower == "firstname" {
						firstName = str
					}
					if keyLower == "last_name" || keyLower == "lastname" {
						lastName = str
					}
				}
			}

			// If no full name found, try to combine first + last
			if applicantName == "" && (firstName != "" || lastName != "") {
				applicantName = strings.TrimSpace(firstName + " " + lastName)
			}

			// Final fallback - look for any field containing "name"
			if applicantName == "" {
				for key, value := range data {
					keyLower := strings.ToLower(key)
					if strings.Contains(keyLower, "name") && !strings.Contains(keyLower, "recommender") {
						if str, ok := value.(string); ok && str != "" {
							applicantName = str
							break
						}
					}
				}
			}
		}

		// Fall back to auto-detection for applicant email if not configured or not found
		if applicantEmail == "" {
			for key, value := range data {
				keyLower := strings.ToLower(key)
				if strings.Contains(keyLower, "email") && !strings.Contains(keyLower, "recommender") {
					if str, ok := value.(string); ok && str != "" {
						applicantEmail = str
						break
					}
				}
			}
		}
	}

	// Default if nothing found
	if applicantName == "" {
		applicantName = "the applicant"
	}

	// Build the recommendation link - use APP_URL for production
	baseURL := os.Getenv("APP_URL")
	if baseURL == "" {
		baseURL = os.Getenv("NEXT_PUBLIC_APP_URL")
	}
	if baseURL == "" {
		baseURL = "https://www.maticsapp.com" // Production default
	}
	recommendationLink := fmt.Sprintf("%s/recommend/%s", baseURL, request.Token)

	// Format deadline with date and time
	deadline := "No deadline"
	if request.ExpiresAt != nil {
		deadline = request.ExpiresAt.Format("January 2, 2006 at 3:04 PM")
	}

	// Use custom template or default - check both backend and frontend field names
	subject := config.EmailTemplate.Subject
	if subject == "" {
		subject = config.EmailSubject // Frontend field name
	}
	if subject == "" {
		subject = fmt.Sprintf("Recommendation Request for %s", applicantName)
	}

	// Check for custom email body
	customBody := config.EmailTemplate.Body
	if customBody == "" {
		customBody = config.EmailMessage // Frontend field name
	}

	var body string
	if customBody != "" {
		// Use custom body with merge tags
		body = customBody
		body = strings.ReplaceAll(body, "{{recommender_name}}", request.RecommenderName)
		body = strings.ReplaceAll(body, "{{applicant_name}}", applicantName)
		body = strings.ReplaceAll(body, "{{applicant_email}}", applicantEmail)
		body = strings.ReplaceAll(body, "{{form_title}}", form.Name)
		body = strings.ReplaceAll(body, "{{link}}", recommendationLink)
		body = strings.ReplaceAll(body, "{{deadline}}", deadline)

		// Replace dynamic field references like {{field_id}} with submission data
		if submission.Data != nil {
			var submissionData map[string]interface{}
			json.Unmarshal(submission.Data, &submissionData)

			// Find all {{field_id}} patterns and replace with actual values
			re := regexp.MustCompile(`\{\{([^}]+)\}\}`)
			body = re.ReplaceAllStringFunc(body, func(match string) string {
				fieldId := strings.Trim(match, "{}")
				// Skip standard merge tags (already handled above)
				if fieldId == "recommender_name" || fieldId == "applicant_name" ||
					fieldId == "applicant_email" || fieldId == "form_title" ||
					fieldId == "link" || fieldId == "deadline" {
					return match // These are already replaced
				}
				// Look up field value in submission data
				if val, ok := submissionData[fieldId]; ok {
					switch v := val.(type) {
					case string:
						return v
					case float64:
						return fmt.Sprintf("%.0f", v)
					case bool:
						if v {
							return "Yes"
						}
						return "No"
					default:
						return fmt.Sprintf("%v", v)
					}
				}
				return match // Keep original if not found
			})
		}

		// Wrap plain text in HTML if it doesn't contain HTML tags
		if !strings.Contains(body, "<") {
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
        <p>%s</p>
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
`, request.RecommenderName, body, recommendationLink, recommendationLink, recommendationLink, deadline)
		}

		// Also process subject merge tags
		subject = strings.ReplaceAll(subject, "{{recommender_name}}", request.RecommenderName)
		subject = strings.ReplaceAll(subject, "{{applicant_name}}", applicantName)
		subject = strings.ReplaceAll(subject, "{{applicant_email}}", applicantEmail)
		subject = strings.ReplaceAll(subject, "{{form_title}}", form.Name)
	} else {
		// Default template
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
	}

	// Build sender name - check for custom emailSettings first
	senderName := form.Name
	var formSettings map[string]interface{}
	if err := json.Unmarshal(form.Settings, &formSettings); err == nil {
		if emailSettings, ok := formSettings["emailSettings"].(map[string]interface{}); ok {
			if customSenderName, ok := emailSettings["senderName"].(string); ok && customSenderName != "" {
				senderName = customSenderName
				fmt.Printf("[Recommendations] Using custom sender name from settings: %s\n", senderName)
			}
		}
	}
	if senderName == "" {
		senderName = "Matic"
	}
	fromEmail := fmt.Sprintf("%s <noreply@notifications.maticsapp.com>", senderName)

	// Check for reply-to email in settings
	var replyTo string
	if err := json.Unmarshal(form.Settings, &formSettings); err == nil {
		if emailSettings, ok := formSettings["emailSettings"].(map[string]interface{}); ok {
			if replyToEmail, ok := emailSettings["replyToEmail"].(string); ok && replyToEmail != "" {
				replyTo = replyToEmail
				fmt.Printf("[Recommendations] Using reply-to from settings: %s\n", replyTo)
			}
		}
	}

	fmt.Printf("[Recommendations] Sending email from: %s to: %s, subject: %s\n", fromEmail, request.RecommenderEmail, subject)

	params := &resend.SendEmailRequest{
		From:    fromEmail,
		To:      []string{request.RecommenderEmail},
		Subject: subject,
		Html:    body,
	}

	// Add reply-to if configured
	if replyTo != "" {
		params.ReplyTo = replyTo
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

	// Parse the response - handle both JSON and multipart form data
	var responseData map[string]interface{}

	contentType := c.ContentType()
	if strings.Contains(contentType, "multipart/form-data") {
		// Handle multipart form with file
		responseStr := c.PostForm("response")
		if responseStr != "" {
			if err := json.Unmarshal([]byte(responseStr), &responseData); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid response format"})
				return
			}
		} else {
			responseData = make(map[string]interface{})
		}

		// Handle file upload
		file, header, err := c.Request.FormFile("document")
		if err == nil && file != nil {
			defer file.Close()

			// Validate file type
			allowedTypes := map[string]bool{
				"application/pdf":    true,
				"application/msword": true,
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
			}

			fileContentType := header.Header.Get("Content-Type")
			if !allowedTypes[fileContentType] {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type. Please upload a PDF or Word document."})
				return
			}

			// Validate file size (10MB max)
			if header.Size > 10*1024*1024 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "File size must be less than 10MB"})
				return
			}

			// Generate unique filename
			ext := filepath.Ext(header.Filename)
			filename := fmt.Sprintf("%s_%s%s", uuid.New().String()[:8], strings.TrimSuffix(header.Filename, ext), ext)

			// Create uploads directory if it doesn't exist
			uploadDir := filepath.Join("uploads", "recommendations", request.ID.String())
			if err := os.MkdirAll(uploadDir, 0755); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
				return
			}

			// Save the file
			filePath := filepath.Join(uploadDir, filename)
			dst, err := os.Create(filePath)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
				return
			}
			defer dst.Close()

			if _, err := io.Copy(dst, file); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write file"})
				return
			}

			// Generate URL - use request host for production, fallback to env or localhost
			baseURL := os.Getenv("BASE_URL")
			if baseURL == "" {
				// Try to get from request
				scheme := "https"
				if c.GetHeader("X-Forwarded-Proto") == "http" || strings.HasPrefix(c.Request.Host, "localhost") {
					scheme = "http"
				}
				host := c.GetHeader("X-Forwarded-Host")
				if host == "" {
					host = c.Request.Host
				}
				if host != "" {
					baseURL = fmt.Sprintf("%s://%s", scheme, host)
				} else {
					baseURL = "https://backend.maticslab.com" // Production default
				}
			}
			documentURL := fmt.Sprintf("%s/uploads/recommendations/%s/%s", baseURL, request.ID.String(), filename)

			responseData["uploaded_document"] = map[string]interface{}{
				"url":      documentURL,
				"filename": header.Filename,
				"size":     header.Size,
				"type":     fileContentType,
			}
		}
	} else {
		// Handle regular JSON request
		var input struct {
			Response map[string]interface{} `json:"response" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		responseData = input.Response
	}

	// Update the request
	responseJSON, _ := json.Marshal(responseData)
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
		baseURL = "https://www.maticsapp.com"
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

	// Build sender name - check for custom emailSettings first
	senderName := form.Name
	var formSettings map[string]interface{}
	if err := json.Unmarshal(form.Settings, &formSettings); err == nil {
		if emailSettings, ok := formSettings["emailSettings"].(map[string]interface{}); ok {
			if customSenderName, ok := emailSettings["senderName"].(string); ok && customSenderName != "" {
				senderName = customSenderName
			}
		}
	}
	if senderName == "" {
		senderName = "Matic"
	}
	fromEmail := fmt.Sprintf("%s <noreply@notifications.maticsapp.com>", senderName)

	// Check for reply-to email in settings
	var replyTo string
	if err := json.Unmarshal(form.Settings, &formSettings); err == nil {
		if emailSettings, ok := formSettings["emailSettings"].(map[string]interface{}); ok {
			if replyToEmail, ok := emailSettings["replyToEmail"].(string); ok && replyToEmail != "" {
				replyTo = replyToEmail
			}
		}
	}

	params := &resend.SendEmailRequest{
		From:    fromEmail,
		To:      []string{request.RecommenderEmail},
		Subject: subject,
		Html:    body,
	}

	// Add reply-to if configured
	if replyTo != "" {
		params.ReplyTo = replyTo
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

	// Rewrite localhost URLs in responses
	for i := range requests {
		if len(requests[i].Response) > 0 {
			rewritten, err := rewriteLocalhostURLs(requests[i].Response)
			if err == nil {
				requests[i].Response = rewritten
			}
		}
	}

	c.JSON(http.StatusOK, requests)
}
