package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ========== Portal Form Handlers (New Unified Schema) ==========

// GetPortalSubmission - GET /api/v1/portal/v2/submissions/:id
// Returns a single submission with all responses for the authenticated user
func GetPortalSubmission(c *gin.Context) {
	submissionID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	// Fetch submission
	var submission models.FormSubmission
	if err := database.DB.First(&submission, "id = ? AND user_id = ?", submissionID, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Fetch form
	var form models.Form
	if err := database.DB.First(&form, "id = ?", submission.FormID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	// Fetch form fields
	var fields []models.FormField
	if err := database.DB.Where("form_id = ?", submission.FormID).Order("sort_order ASC").Find(&fields).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch form fields"})
		return
	}

	// Fetch responses
	var responses []models.FormResponse
	if err := database.DB.Where("submission_id = ?", submissionID).Find(&responses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch responses"})
		return
	}

	// Map responses by field_id for easy lookup
	responseMap := make(map[uuid.UUID]models.FormResponse)
	for _, resp := range responses {
		responseMap[resp.FieldID] = resp
	}

	// Build combined data structure matching old JSONB format for frontend compatibility
	data := make(map[string]interface{})
	for _, field := range fields {
		if resp, exists := responseMap[field.ID]; exists {
			// Extract the actual value based on value_type
			switch resp.ValueType {
			case "text":
				if resp.ValueText != nil {
					data[field.FieldKey] = *resp.ValueText
				}
			case "number":
				if resp.ValueNumber != nil {
					data[field.FieldKey] = *resp.ValueNumber
				}
			case "boolean":
				if resp.ValueBoolean != nil {
					data[field.FieldKey] = *resp.ValueBoolean
				}
			case "date":
				if resp.ValueDate != nil {
					data[field.FieldKey] = resp.ValueDate.Format("2006-01-02")
				}
			case "datetime":
				if resp.ValueDatetime != nil {
					data[field.FieldKey] = resp.ValueDatetime.Format(time.RFC3339)
				}
			case "json":
				if resp.ValueJSON != nil {
					var jsonValue interface{}
					json.Unmarshal(resp.ValueJSON, &jsonValue)
					data[field.FieldKey] = jsonValue
				}
			}
		}
	}

	// Return submission with data
	c.JSON(http.StatusOK, gin.H{
		"id":                    submission.ID,
		"form_id":               submission.FormID,
		"form_name":             form.Name,
		"status":                submission.Status,
		"completion_percentage": submission.CompletionPercentage,
		"data":                  data,
		"submitted_at":          submission.SubmittedAt,
		"last_saved_at":         submission.LastSavedAt,
		"created_at":            submission.CreatedAt,
		"updated_at":            submission.UpdatedAt,
	})
}

// UpdatePortalSubmission - PUT /api/v1/portal/v2/submissions/:id
// Updates a submission by saving/updating individual field responses
func UpdatePortalSubmission(c *gin.Context) {
	submissionID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	// Verify ownership
	var submission models.FormSubmission
	if err := database.DB.First(&submission, "id = ? AND user_id = ?", submissionID, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Parse request body
	var input struct {
		Data                 map[string]interface{} `json:"data" binding:"required"`
		Status               *string                `json:"status"`
		CompletionPercentage *int                   `json:"completion_percentage"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Fetch form fields
	var fields []models.FormField
	if err := database.DB.Where("form_id = ?", submission.FormID).Find(&fields).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch form fields"})
		return
	}

	// Create field map for lookup
	fieldMap := make(map[string]models.FormField)
	for _, field := range fields {
		fieldMap[field.FieldKey] = field
	}

	// Start transaction
	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Update or create responses for each field in data
	for fieldKey, value := range input.Data {
		field, exists := fieldMap[fieldKey]
		if !exists {
			fmt.Printf("Warning: Field %s not found in form schema, skipping\n", fieldKey)
			continue
		}

		// Determine value type
		var valueType string
		var valueText *string
		var valueNumber *float64
		var valueBoolean *bool
		var valueJSON []byte

		switch v := value.(type) {
		case string:
			valueType = "text"
			valueText = &v
		case float64:
			valueType = "number"
			valueNumber = &v
		case int:
			valueType = "number"
			f := float64(v)
			valueNumber = &f
		case bool:
			valueType = "boolean"
			valueBoolean = &v
		case map[string]interface{}, []interface{}:
			valueType = "json"
			jsonBytes, _ := json.Marshal(v)
			valueJSON = jsonBytes
		default:
			// Try to serialize as JSON
			valueType = "json"
			jsonBytes, _ := json.Marshal(v)
			valueJSON = jsonBytes
		}

		// Upsert response
		response := models.FormResponse{
			SubmissionID: submission.ID,
			FieldID:      field.ID,
			ValueType:    valueType,
			ValueText:    valueText,
			ValueNumber:  valueNumber,
			ValueBoolean: valueBoolean,
			ValueJSON:    valueJSON,
			IsValid:      true,
		}

		if err := tx.Where("submission_id = ? AND field_id = ?", submission.ID, field.ID).
			Assign(response).
			FirstOrCreate(&response).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to save response for field %s", fieldKey)})
			return
		}
	}

	// Update submission metadata
	updates := map[string]interface{}{
		"last_saved_at": time.Now(),
		"updated_at":    time.Now(),
	}

	if input.Status != nil {
		updates["status"] = *input.Status
		if *input.Status == "submitted" && submission.SubmittedAt == nil {
			updates["submitted_at"] = time.Now()
		}
	}

	if input.CompletionPercentage != nil {
		updates["completion_percentage"] = *input.CompletionPercentage
	}

	if err := tx.Model(&submission).Updates(updates).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update submission"})
		return
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit changes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         submission.ID,
		"status":     submission.Status,
		"message":    "Submission updated successfully",
		"updated_at": time.Now(),
	})
}

// GetOrCreatePortalSubmission - POST /api/v1/portal/v2/forms/:form_id/submissions
// Gets existing submission or creates a new draft for the authenticated user
func GetOrCreatePortalSubmission(c *gin.Context) {
	formID := c.Param("form_id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	// Try to find existing submission
	var submission models.FormSubmission
	err := database.DB.Where("form_id = ? AND user_id = ? AND status != ?", formID, userID, "withdrawn").
		First(&submission).Error

	if err == nil {
		// Found existing submission
		c.JSON(http.StatusOK, gin.H{
			"id":                    submission.ID,
			"form_id":               submission.FormID,
			"status":                submission.Status,
			"completion_percentage": submission.CompletionPercentage,
			"started_at":            submission.StartedAt,
			"last_saved_at":         submission.LastSavedAt,
			"submitted_at":          submission.SubmittedAt,
			"existing":              true,
		})
		return
	}

	// Check if form exists and allows submissions
	var form models.Form
	if err := database.DB.First(&form, "id = ?", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	if form.Status != "published" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Form is not accepting submissions"})
		return
	}

	// Check if form has closed
	if form.ClosesAt != nil && time.Now().After(*form.ClosesAt) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Form submissions are closed"})
		return
	}

	// Create new submission
	newSubmission := models.FormSubmission{
		FormID:               form.ID,
		UserID:               userID,
		Status:               "draft",
		CompletionPercentage: 0,
		FormVersion:          form.Version,
	}

	if err := database.DB.Create(&newSubmission).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create submission"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":                    newSubmission.ID,
		"form_id":               newSubmission.FormID,
		"status":                newSubmission.Status,
		"completion_percentage": newSubmission.CompletionPercentage,
		"started_at":            newSubmission.StartedAt,
		"existing":              false,
	})
}
