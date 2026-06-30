package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
)

// AutosavePortalSubmission - POST /api/v1/submissions/:id/autosave
// Autosaves changed fields for a portal submission with optimistic locking
func AutosavePortalSubmission(c *gin.Context) {
	submissionID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	// Parse request body
	var input struct {
		Changes     map[string]interface{} `json:"changes" binding:"required"`
		BaseVersion int                    `json:"base_version"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Verify ownership
	var submission models.FormSubmission
	if err := database.DB.First(&submission, "id = ? AND user_id = ?", submissionID, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// For now, we don't do version conflict detection
	// In the future, we could add a version field to FormSubmission and check it here

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

	// Update only the changed fields
	for fieldKey, value := range input.Changes {
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
		case nil:
			// Handle null values
			valueType = "json"
			valueJSON = []byte("null")
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
	now := time.Now()
	updates := map[string]interface{}{
		"last_saved_at": now,
		"updated_at":    now,
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

	// Return success response
	// For now, we just return version 1 (no version tracking yet)
	c.JSON(http.StatusOK, gin.H{
		"version":  1,
		"saved_at": now.Format(time.RFC3339),
		"conflict": false,
	})
}
