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

// resolveForm resolves a form by its new ID or legacy_table_id.
// Returns the form and true on success, or writes an error response and returns false.
func resolveForm(c *gin.Context, formIDStr string) (*models.Form, bool) {
	parsedFormID, err := uuid.Parse(formIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form ID"})
		return nil, false
	}

	var form models.Form

	// Try new form ID first
	err = database.DB.Where("id = ?", parsedFormID).First(&form).Error
	if err == nil {
		return &form, true
	}

	// Fallback: try legacy_table_id
	err = database.DB.Where("legacy_table_id = ?", parsedFormID).First(&form).Error
	if err == nil {
		fmt.Printf("✅ Resolved form via legacy_table_id %s -> %s\n", formIDStr, form.ID)
		return &form, true
	}

	return nil, false
}

// getDataFields returns only data-collecting fields for a form (excludes layout fields)
func getDataFields(formID uuid.UUID) []models.FormField {
	var fields []models.FormField
	database.DB.Where("form_id = ?", formID).Find(&fields)
	return models.DataFieldsOnly(fields)
}

// computeCompletion calculates completion percentage based on filled data fields
func computeCompletion(data map[string]interface{}, dataFields []models.FormField) int {
	if len(dataFields) == 0 {
		return 0
	}
	filled := 0
	for _, f := range dataFields {
		if v, exists := data[f.ID.String()]; exists && v != nil && v != "" {
			filled++
		}
	}
	return (filled * 100) / len(dataFields)
}

// buildLegacyKeyMap builds a mapping of field_key -> legacy field UUID string
// for forms that were migrated from the legacy data_tables system.
func buildLegacyKeyMap(form *models.Form, fields []models.FormField) map[string]string {
	if form.LegacyTableID == nil {
		return nil
	}

	var legacyFields []models.Field
	database.DB.Where("table_id = ?", form.LegacyTableID).Find(&legacyFields)

	legacyMap := make(map[string]string)
	for _, lf := range legacyFields {
		legacyMap[lf.Name] = lf.ID.String()
	}
	return legacyMap
}

// buildLegacyUUIDToFieldID builds a mapping of legacy UUID string -> new field ID
// for resolving incoming data that uses old field UUIDs as keys.
func buildLegacyUUIDToFieldID(form *models.Form, fieldKeyToID map[string]uuid.UUID) map[string]uuid.UUID {
	if form.LegacyTableID == nil {
		return nil
	}

	var legacyFields []models.Field
	database.DB.Where("table_id = ?", form.LegacyTableID).Find(&legacyFields)

	mapping := make(map[string]uuid.UUID)
	for _, lf := range legacyFields {
		if newFieldID, exists := fieldKeyToID[lf.Name]; exists {
			mapping[lf.ID.String()] = newFieldID
		}
	}
	return mapping
}

// remapToLegacyKeys remaps raw_data keyed by V2 form_field UUIDs to V1 table_field UUIDs.
// This is needed because GetFormBySlug returns V1 table_fields IDs in the config,
// but form_submissions.raw_data uses V2 form_field UUIDs.
func remapToLegacyKeys(form *models.Form, data map[string]interface{}) map[string]interface{} {
	if form.LegacyTableID == nil {
		return data
	}

	// Build V2 field UUID -> field_key map
	var v2Fields []models.FormField
	database.DB.Where("form_id = ?", form.ID).Find(&v2Fields)
	v2UUIDToKey := make(map[string]string)
	for _, f := range v2Fields {
		v2UUIDToKey[f.ID.String()] = f.FieldKey
	}

	// Build field_key -> V1 field UUID map
	var v1Fields []models.Field
	database.DB.Where("table_id = ?", form.LegacyTableID).Find(&v1Fields)
	keyToV1UUID := make(map[string]string)
	for _, f := range v1Fields {
		keyToV1UUID[f.Name] = f.ID.String()
	}

	// Remap: V2 UUID -> field_key -> V1 UUID
	remapped := make(map[string]interface{})
	for dataKey, value := range data {
		if fieldKey, ok := v2UUIDToKey[dataKey]; ok {
			if v1UUID, ok := keyToV1UUID[fieldKey]; ok {
				remapped[v1UUID] = value
				continue
			}
		}
		// Keep unmapped keys as-is
		remapped[dataKey] = value
	}

	fmt.Printf("🔄 remapToLegacyKeys: Remapped %d keys for legacy form %s\n", len(remapped), form.LegacyTableID)
	return remapped
}

// GetMyPortalSubmission gets the authenticated user's submission for a form
// GET /api/v1/portal/forms/:form_id/my-submission
// Reads from raw_data JSONB first, falls back to form_responses for legacy data.
func GetMyPortalSubmission(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	formID := c.Param("form_id")
	fmt.Printf("📋 GetMyPortalSubmission: User %s requesting submission for form %s\n", userID, formID)

	form, ok := resolveForm(c, formID)
	if !ok {
		// Form not found at all — return empty state
		c.JSON(http.StatusOK, gin.H{
			"id":         nil,
			"data":       map[string]interface{}{},
			"metadata":   map[string]interface{}{"status": "not_started"},
			"created_at": nil,
			"updated_at": nil,
		})
		return
	}

	// Query submission
	var submission models.FormSubmission
	err := database.DB.Where("form_id = ? AND user_id = ?", form.ID, userID).First(&submission).Error
	if err != nil {
		fmt.Printf("ℹ️ GetMyPortalSubmission: No submission found for user %s and form %s\n", userID, form.ID)
		c.JSON(http.StatusOK, gin.H{
			"id":         nil,
			"data":       map[string]interface{}{},
			"metadata":   map[string]interface{}{"status": "not_started"},
			"created_at": nil,
			"updated_at": nil,
		})
		return
	}

	// --- Read data: prefer raw_data JSONB, fall back to form_responses ---
	data := make(map[string]interface{})

	// Try raw_data first
	hasRawData := false
	if submission.RawData != nil && len(submission.RawData) > 2 { // > 2 means more than '{}'
		if err := json.Unmarshal(submission.RawData, &data); err == nil && len(data) > 0 {
			hasRawData = true
			fmt.Printf("✅ GetMyPortalSubmission: Read %d fields from raw_data\n", len(data))
			// Remap V2 field UUIDs to V1 table_field UUIDs for legacy forms
			// so keys match the field IDs returned by GetFormBySlug
			data = remapToLegacyKeys(form, data)
		}
	}

	// Fallback: build from form_responses (legacy path)
	if !hasRawData {
		var responses []models.FormResponse
		database.DB.Where("submission_id = ?", submission.ID).Find(&responses)

		legacyKeyMap := buildLegacyKeyMap(form, nil)

		for _, resp := range responses {
			var field models.FormField
			if err := database.DB.First(&field, "id = ?", resp.FieldID).Error; err != nil {
				continue
			}

			value := resp.GetValue()

			// Determine data key (legacy UUID or field_key)
			var dataKey string
			if legacyKeyMap != nil {
				if legacyUUID, exists := legacyKeyMap[field.FieldKey]; exists {
					dataKey = legacyUUID
				} else {
					dataKey = field.FieldKey
				}
			} else {
				dataKey = field.FieldKey
			}
			data[dataKey] = value
		}
		fmt.Printf("✅ GetMyPortalSubmission: Built %d fields from form_responses (legacy)\n", len(data))
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

	fmt.Printf("✅ GetMyPortalSubmission: Returning submission %s with %d data fields\n", submission.ID, len(data))

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
	SaveDraft bool                   `json:"save_draft"`
}

// SaveMyPortalSubmission creates or updates the authenticated user's submission
// POST /api/v1/portal/forms/:form_id/my-submission
// Writes to raw_data JSONB (primary) + dual-writes to form_responses (backward compat).
func SaveMyPortalSubmission(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	formID := c.Param("form_id")

	var input SaveMyPortalSubmissionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("📝 SaveMyPortalSubmission: User %s saving for form %s (draft=%v)\n", userID, formID, input.SaveDraft)

	form, ok := resolveForm(c, formID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	// Get data fields (excludes layout)
	dataFields := getDataFields(form.ID)

	// Build field lookup maps
	fieldKeyToID := make(map[string]uuid.UUID)
	fieldIDToField := make(map[uuid.UUID]models.FormField)
	for _, f := range dataFields {
		fieldKeyToID[f.FieldKey] = f.ID
		fieldIDToField[f.ID] = f
	}

	// Build legacy UUID -> new field ID map for forms migrated from legacy system
	legacyUUIDToID := buildLegacyUUIDToFieldID(form, fieldKeyToID)

	// --- Normalize incoming data keys to field IDs ---
	normalized := make(map[string]interface{})
	for dataKey, value := range input.Data {
		// Try field_key first
		if fid, exists := fieldKeyToID[dataKey]; exists {
			normalized[fid.String()] = value
			continue
		}
		// Try legacy UUID mapping
		if legacyUUIDToID != nil {
			if fid, exists := legacyUUIDToID[dataKey]; exists {
				normalized[fid.String()] = value
				continue
			}
		}
		// Try direct field ID (already a UUID string)
		if _, err := uuid.Parse(dataKey); err == nil {
			normalized[dataKey] = value
			continue
		}
		fmt.Printf("⚠️ SaveMyPortalSubmission: Data key '%s' not resolved, skipping\n", dataKey)
	}

	// Marshal raw_data JSONB
	rawDataBytes, err := json.Marshal(normalized)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize data"})
		return
	}

	// Compute completion
	completion := computeCompletion(normalized, dataFields)

	// Begin transaction
	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Check for existing submission
	var existingSubmission models.FormSubmission
	err = database.DB.Where("form_id = ? AND user_id = ?", form.ID, userID).First(&existingSubmission).Error

	var submissionID uuid.UUID

	if err == nil {
		// --- Update existing ---
		submissionID = existingSubmission.ID

		existingSubmission.RawData = datatypes.JSON(rawDataBytes)
		existingSubmission.CompletionPercentage = completion
		existingSubmission.LastSavedAt = time.Now()

		if input.SaveDraft {
			if existingSubmission.Status != "submitted" {
				existingSubmission.Status = "draft"
			}
		} else {
			existingSubmission.Status = "submitted"
			now := time.Now()
			existingSubmission.SubmittedAt = &now
		}

		if err := tx.Save(&existingSubmission).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update submission"})
			return
		}
		fmt.Printf("🔄 Updated submission %s (completion=%d%%)\n", submissionID, completion)
	} else {
		// --- Create new ---
		status := "draft"
		var submittedAt *time.Time
		if !input.SaveDraft {
			status = "submitted"
			now := time.Now()
			submittedAt = &now
		}

		newSubmission := models.FormSubmission{
			FormID:               form.ID,
			UserID:               userID,
			Status:               status,
			RawData:              datatypes.JSON(rawDataBytes),
			CompletionPercentage: completion,
			LastSavedAt:          time.Now(),
			SubmittedAt:          submittedAt,
		}

		if err := tx.Create(&newSubmission).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create submission"})
			return
		}
		submissionID = newSubmission.ID
		fmt.Printf("📝 Created submission %s (completion=%d%%)\n", submissionID, completion)
	}

	// --- Dual-write to form_responses (backward compat) ---
	for fieldIDStr, value := range normalized {
		fieldID, err := uuid.Parse(fieldIDStr)
		if err != nil {
			continue
		}

		field, exists := fieldIDToField[fieldID]
		if !exists {
			continue
		}

		// Determine value type and storage columns
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
			valueType = "json"
			jsonBytes, _ := json.Marshal(value)
			valueJSON = datatypes.JSON(jsonBytes)
		}

		_ = field // field available for SetValue if needed later

		response := models.FormResponse{
			SubmissionID: submissionID,
			FieldID:      fieldID,
			ValueType:    valueType,
			ValueText:    valueText,
			ValueNumber:  valueNumber,
			ValueBoolean: valueBoolean,
			ValueJSON:    valueJSON,
		}

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

	fmt.Printf("✅ SaveMyPortalSubmission: Saved submission %s with %d fields\n", submissionID, len(normalized))
	c.JSON(http.StatusOK, gin.H{
		"id":         submissionID,
		"updated_at": time.Now(),
	})
}
