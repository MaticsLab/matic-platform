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
	"gorm.io/datatypes"
)

// GetMyPortalSubmission gets the authenticated user's submission for a form
// GET /api/v1/portal/forms/:form_id/my-submission
// Accepts either the new forms.id or the legacy data_tables.id (will lookup via legacy_table_id)
func GetMyPortalSubmission(c *gin.Context) {
	// Get authenticated user ID from portal middleware
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	formID := c.Param("form_id")
	parsedFormID, err := uuid.Parse(formID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form ID"})
		return
	}

	fmt.Printf("📋 GetMyPortalSubmission: User %s requesting submission for form %s\n", userID, formID)

	// Try to resolve the actual form ID from forms table
	// First check if it's already a new form ID
	var actualFormID uuid.UUID
	var form models.Form
	err = database.DB.Where("id = ?", parsedFormID).First(&form).Error
	if err == nil {
		// Found by new form ID
		actualFormID = form.ID
		fmt.Printf("✅ Found form by new ID: %s\n", actualFormID)
	} else {
		// Not found by new ID, try legacy_table_id lookup
		err = database.DB.Where("legacy_table_id = ?", parsedFormID).First(&form).Error
		if err != nil {
			fmt.Printf("❌ Form not found by ID or legacy_table_id: %s\n", formID)
			// Return empty state - form might not be migrated yet
			c.JSON(http.StatusOK, gin.H{
				"id":         nil,
				"data":       map[string]interface{}{},
				"metadata":   map[string]interface{}{"status": "not_started"},
				"created_at": nil,
				"updated_at": nil,
			})
			return
		}
		actualFormID = form.ID
		fmt.Printf("✅ Found form by legacy_table_id %s -> new ID: %s\n", formID, actualFormID)
	}

	// Query form_submissions for this user's submission
	var submission models.FormSubmission
	err = database.DB.Where("form_id = ? AND user_id = ?", actualFormID, userID).First(&submission).Error

	if err != nil {
		// No submission found - return empty state
		fmt.Printf("ℹ️ GetMyPortalSubmission: No submission found for user %s\n", userID)
		c.JSON(http.StatusOK, gin.H{
			"id":         nil,
			"data":       map[string]interface{}{},
			"metadata":   map[string]interface{}{"status": "not_started"},
			"created_at": nil,
			"updated_at": nil,
		})
		return
	}

	// Get all responses for this submission
	var responses []models.FormResponse
	database.DB.Where("submission_id = ?", submission.ID).Find(&responses)

	// Build data object from responses
	data := make(map[string]interface{})
	for _, resp := range responses {
		// Get field info to get the field_key
		var field models.FormField
		if err := database.DB.First(&field, "id = ?", resp.FieldID).Error; err == nil {
			// Extract value based on type
			var value interface{}
			switch resp.ValueType {
			case "text":
				value = resp.ValueText
			case "number":
				value = resp.ValueNumber
			case "boolean":
				value = resp.ValueBoolean
			case "date":
				value = resp.ValueDate
			case "datetime":
				value = resp.ValueDatetime
			case "json":
				if resp.ValueJSON != nil {
					json.Unmarshal(resp.ValueJSON, &value)
				}
			}
			data[field.FieldKey] = value
		}
	}

	// Build metadata
	metadata := map[string]interface{}{
		"status":                submission.Status,
		"completion_percentage": submission.CompletionPercentage,
	}
	if submission.SubmittedAt != nil {
		metadata["submitted_at"] = submission.SubmittedAt
	}
	metadata["last_saved_at"] = submission.LastSavedAt

	fmt.Printf("✅ GetMyPortalSubmission: Found submission %s with %d responses\n", submission.ID, len(responses))

	c.JSON(http.StatusOK, gin.H{
		"id":         submission.ID,
		"data":       data,
		"metadata":   metadata,
		"created_at": submission.CreatedAt,
		"updated_at": submission.UpdatedAt,
	})
}

// SaveMyPortalSubmissionInput is the request body for saving portal submissions
type SaveMyPortalSubmissionInput struct {
	Data      map[string]interface{} `json:"data" binding:"required"`
	SaveDraft bool                   `json:"save_draft"` // true = draft, false = submit
}

// SaveMyPortalSubmission creates or updates the authenticated user's submission
// POST /api/v1/portal/forms/:form_id/my-submission
// Accepts either the new forms.id or the legacy data_tables.id (will lookup via legacy_table_id)
func SaveMyPortalSubmission(c *gin.Context) {
	// Get authenticated user ID from portal middleware
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	formID := c.Param("form_id")
	parsedFormID, err := uuid.Parse(formID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form ID"})
		return
	}

	var input SaveMyPortalSubmissionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("📝 SaveMyPortalSubmission: User %s saving submission for form %s (draft=%v)\n", userID, formID, input.SaveDraft)

	// Try to resolve the actual form ID from forms table
	// First check if it's already a new form ID
	var actualFormID uuid.UUID
	var form models.Form
	err = database.DB.Where("id = ?", parsedFormID).First(&form).Error
	if err == nil {
		// Found by new form ID
		actualFormID = form.ID
		fmt.Printf("✅ Found form by new ID: %s\n", actualFormID)
	} else {
		// Not found by new ID, try legacy_table_id lookup
		err = database.DB.Where("legacy_table_id = ?", parsedFormID).First(&form).Error
		if err != nil {
			fmt.Printf("❌ Form not found by ID or legacy_table_id: %s\n", formID)
			c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
			return
		}
		actualFormID = form.ID
		fmt.Printf("✅ Found form by legacy_table_id %s -> new ID: %s\n", formID, actualFormID)
	}

	// Get form fields to map data keys to field IDs
	var fields []models.FormField
	database.DB.Where("form_id = ?", actualFormID).Find(&fields)

	// Create map of field_key -> field_id
	fieldKeyToID := make(map[string]uuid.UUID)
	for _, field := range fields {
		fieldKeyToID[field.FieldKey] = field.ID
	}

	// Check if user already has a submission
	var existingSubmission models.FormSubmission
	err = database.DB.Where("form_id = ? AND user_id = ?", actualFormID, userID).First(&existingSubmission).Error

	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var submissionID uuid.UUID

	if err == nil {
		// Update existing submission
		fmt.Printf("🔄 SaveMyPortalSubmission: Updating existing submission %s\n", existingSubmission.ID)

		submissionID = existingSubmission.ID
		existingSubmission.LastSavedAt = time.Now()

		if input.SaveDraft {
			// Keep as draft or in_progress
			if existingSubmission.Status != "submitted" {
				existingSubmission.Status = "draft"
			}
		} else {
			// Mark as submitted
			existingSubmission.Status = "submitted"
			now := time.Now()
			existingSubmission.SubmittedAt = &now
		}

		// Calculate completion percentage (simple: count non-empty fields)
		filledCount := 0
		for key, value := range input.Data {
			if value != nil && value != "" {
				filledCount++
			}
			_ = key
		}
		totalFields := len(fields)
		if totalFields > 0 {
			existingSubmission.CompletionPercentage = (filledCount * 100) / totalFields
		}

		if err := tx.Save(&existingSubmission).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update submission"})
			return
		}
	} else {
		// Create new submission
		fmt.Printf("📝 SaveMyPortalSubmission: Creating new submission for user %s\n", userID)

		status := "draft"
		var submittedAt *time.Time
		if !input.SaveDraft {
			status = "submitted"
			now := time.Now()
			submittedAt = &now
		}

		// Calculate completion percentage
		filledCount := 0
		for key, value := range input.Data {
			if value != nil && value != "" {
				filledCount++
			}
			_ = key
		}
		totalFields := len(fields)
		completionPct := 0
		if totalFields > 0 {
			completionPct = (filledCount * 100) / totalFields
		}

		newSubmission := models.FormSubmission{
			FormID:               actualFormID,
			UserID:               userID,
			Status:               status,
			CompletionPercentage: completionPct,
			LastSavedAt:          time.Now(),
			SubmittedAt:          submittedAt,
		}

		if err := tx.Create(&newSubmission).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create submission"})
			return
		}

		submissionID = newSubmission.ID
	}

	// Now save/update all responses
	for fieldKey, value := range input.Data {
		fieldID, exists := fieldKeyToID[fieldKey]
		if !exists {
			fmt.Printf("⚠️ SaveMyPortalSubmission: Field key '%s' not found in form, skipping\n", fieldKey)
			continue
		}

		// Determine value type and storage
		var valueType string
		var valueText *string
		var valueNumber *float64
		var valueBoolean *bool
		var valueJSON datatypes.JSON

		switch v := value.(type) {
		case string:
			valueType = "text"
			valueText = &v
		case float64:
			valueType = "number"
			valueNumber = &v
		case int:
			valueType = "number"
			num := float64(v)
			valueNumber = &num
		case bool:
			valueType = "boolean"
			valueBoolean = &v
		default:
			// Store complex types as JSON
			valueType = "json"
			jsonBytes, _ := json.Marshal(value)
			valueJSON = datatypes.JSON(jsonBytes)
		}

		// Upsert response
		response := models.FormResponse{
			SubmissionID: submissionID,
			FieldID:      fieldID,
			ValueType:    valueType,
			ValueText:    valueText,
			ValueNumber:  valueNumber,
			ValueBoolean: valueBoolean,
			ValueJSON:    valueJSON,
		}

		// Try to update, if not exists create
		result := tx.Where("submission_id = ? AND field_id = ?", submissionID, fieldID).
			Assign(models.FormResponse{
				ValueType:    valueType,
				ValueText:    valueText,
				ValueNumber:  valueNumber,
				ValueBoolean: valueBoolean,
				ValueJSON:    valueJSON,
				UpdatedAt:    time.Now(),
			}).
			FirstOrCreate(&response)

		if result.Error != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save response"})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	fmt.Printf("✅ SaveMyPortalSubmission: Saved submission %s with %d responses\n", submissionID, len(input.Data))
	c.JSON(http.StatusOK, gin.H{
		"id":         submissionID,
		"updated_at": time.Now(),
	})
}
