package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// ============================================
// FORMS V2 HANDLERS
// Phase 2: Write to both old and new schema
// ============================================

// ==================== FORMS ====================

// ListFormsV2 lists all forms in a workspace
// GET /api/v2/forms?workspace_id=xxx
func ListFormsV2(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var forms []models.Form
	query := database.DB.Where("workspace_id = ?", workspaceID)

	// Optional status filter
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Order("created_at DESC").Find(&forms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, forms)
}

// GetFormV2 gets a single form with sections and fields
// GET /api/v2/forms/:id
func GetFormV2(c *gin.Context) {
	formID := c.Param("id")

	var form models.Form
	if err := database.DB.
		Preload("Sections", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC")
		}).
		Preload("Fields", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC")
		}).
		First(&form, "id = ?", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	c.JSON(http.StatusOK, form)
}

// GetFormBySlugV2 gets a form by workspace and form slug
// GET /api/v2/forms/by-slug/:workspace_slug/:form_slug
func GetFormBySlugV2(c *gin.Context) {
	workspaceSlug := c.Param("workspace_slug")
	formSlug := c.Param("form_slug")

	// First get workspace by slug
	var workspace models.Workspace
	if err := database.DB.First(&workspace, "slug = ?", workspaceSlug).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	var form models.Form
	if err := database.DB.
		Preload("Sections", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC")
		}).
		Preload("Fields", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC")
		}).
		First(&form, "workspace_id = ? AND slug = ? AND status = 'published'", workspace.ID, formSlug).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	c.JSON(http.StatusOK, form)
}

// CreateFormV2 creates a new form
// POST /api/v2/forms
func CreateFormV2(c *gin.Context) {
	var input struct {
		WorkspaceID              string          `json:"workspace_id" binding:"required"`
		Name                     string          `json:"name" binding:"required"`
		Slug                     string          `json:"slug" binding:"required"`
		Description              *string         `json:"description"`
		Settings                 json.RawMessage `json:"settings"`
		MaxSubmissions           *int            `json:"max_submissions"`
		AllowMultipleSubmissions bool            `json:"allow_multiple_submissions"`
		RequireAuth              bool            `json:"require_auth"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	workspaceID, err := uuid.Parse(input.WorkspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	// Get user ID from context (TEXT, not UUID)
	var createdBy *string
	if userID := c.GetString("ba_user_id"); userID != "" {
		createdBy = &userID
	}

	form := models.Form{
		WorkspaceID:              workspaceID,
		Name:                     input.Name,
		Slug:                     input.Slug,
		Description:              input.Description,
		Settings:                 datatypes.JSON(input.Settings),
		MaxSubmissions:           input.MaxSubmissions,
		AllowMultipleSubmissions: input.AllowMultipleSubmissions,
		RequireAuth:              input.RequireAuth,
		CreatedBy:                createdBy,
	}

	if err := database.DB.Create(&form).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Also create in legacy data_tables for backward compatibility
	var desc string
	if input.Description != nil {
		desc = *input.Description
	}
	legacyTable := models.Table{
		WorkspaceID: workspaceID,
		Name:        input.Name,
		Icon:        "form",
		Description: desc,
		CustomSlug:  &input.Slug,
	}
	if err := database.DB.Create(&legacyTable).Error; err == nil {
		// Link the legacy table
		form.LegacyTableID = &legacyTable.ID
		database.DB.Save(&form)
	}

	c.JSON(http.StatusCreated, form)
}

// UpdateFormV2 updates a form
// PATCH /api/v2/forms/:id
func UpdateFormV2(c *gin.Context) {
	formID := c.Param("id")

	var form models.Form
	if err := database.DB.First(&form, "id = ?", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	var input struct {
		Name                     *string         `json:"name"`
		Slug                     *string         `json:"slug"`
		Description              *string         `json:"description"`
		Settings                 json.RawMessage `json:"settings"`
		Status                   *string         `json:"status"`
		MaxSubmissions           *int            `json:"max_submissions"`
		AllowMultipleSubmissions *bool           `json:"allow_multiple_submissions"`
		RequireAuth              *bool           `json:"require_auth"`
		ClosesAt                 *time.Time      `json:"closes_at"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields
	if input.Name != nil {
		form.Name = *input.Name
	}
	if input.Slug != nil {
		form.Slug = *input.Slug
	}
	if input.Description != nil {
		form.Description = input.Description
	}
	if input.Settings != nil {
		form.Settings = datatypes.JSON(input.Settings)
	}
	if input.Status != nil {
		form.Status = *input.Status
		if *input.Status == "published" && form.PublishedAt == nil {
			now := time.Now()
			form.PublishedAt = &now
		}
	}
	if input.MaxSubmissions != nil {
		form.MaxSubmissions = input.MaxSubmissions
	}
	if input.AllowMultipleSubmissions != nil {
		form.AllowMultipleSubmissions = *input.AllowMultipleSubmissions
	}
	if input.RequireAuth != nil {
		form.RequireAuth = *input.RequireAuth
	}
	if input.ClosesAt != nil {
		form.ClosesAt = input.ClosesAt
	}

	if err := database.DB.Save(&form).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Sync to legacy table if linked
	if form.LegacyTableID != nil {
		database.DB.Model(&models.Table{}).Where("id = ?", form.LegacyTableID).Updates(map[string]interface{}{
			"name":        form.Name,
			"description": form.Description,
			"custom_slug": form.Slug,
		})
	}

	c.JSON(http.StatusOK, form)
}

// DeleteFormV2 deletes a form
// DELETE /api/v2/forms/:id
func DeleteFormV2(c *gin.Context) {
	formID := c.Param("id")

	var form models.Form
	if err := database.DB.First(&form, "id = ?", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	// Delete legacy table if linked
	if form.LegacyTableID != nil {
		database.DB.Delete(&models.Table{}, "id = ?", form.LegacyTableID)
	}

	if err := database.DB.Delete(&form).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Form deleted"})
}

// PublishFormV2 publishes a form
// POST /api/v2/forms/:id/publish
func PublishFormV2(c *gin.Context) {
	formID := c.Param("id")

	var form models.Form
	if err := database.DB.First(&form, "id = ?", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	now := time.Now()
	form.Status = "published"
	form.PublishedAt = &now
	form.Version++

	if err := database.DB.Save(&form).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Sync to legacy
	if form.LegacyTableID != nil {
		database.DB.Model(&models.Table{}).Where("id = ?", form.LegacyTableID).Update("is_published", true)
	}

	c.JSON(http.StatusOK, form)
}

// ==================== FORM FIELDS ====================

// ListFormFieldsV2 lists all fields for a form
// GET /api/v2/forms/:id/fields
func ListFormFieldsV2(c *gin.Context) {
	formID := c.Param("id")

	var fields []models.FormField
	if err := database.DB.
		Where("form_id = ?", formID).
		Order("sort_order ASC").
		Find(&fields).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, fields)
}

// CreateFormFieldV2 creates a new field
// POST /api/v2/forms/:id/fields
func CreateFormFieldV2(c *gin.Context) {
	formID := c.Param("id")

	formUUID, err := uuid.Parse(formID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form ID"})
		return
	}

	var input struct {
		SectionID   *string         `json:"section_id"`
		FieldKey    string          `json:"field_key" binding:"required"`
		FieldType   string          `json:"field_type" binding:"required"`
		Label       string          `json:"label" binding:"required"`
		Description *string         `json:"description"`
		Placeholder *string         `json:"placeholder"`
		Required    bool            `json:"required"`
		Validation  json.RawMessage `json:"validation"`
		Options     json.RawMessage `json:"options"`
		Conditions  json.RawMessage `json:"conditions"`
		SortOrder   int             `json:"sort_order"`
		Width       string          `json:"width"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var sectionID *uuid.UUID
	if input.SectionID != nil && *input.SectionID != "" {
		if id, err := uuid.Parse(*input.SectionID); err == nil {
			sectionID = &id
		}
	}

	field := models.FormField{
		FormID:      formUUID,
		SectionID:   sectionID,
		FieldKey:    input.FieldKey,
		FieldType:   input.FieldType,
		Label:       input.Label,
		Description: input.Description,
		Placeholder: input.Placeholder,
		Required:    input.Required,
		Validation:  datatypes.JSON(input.Validation),
		Options:     datatypes.JSON(input.Options),
		Conditions:  datatypes.JSON(input.Conditions),
		SortOrder:   input.SortOrder,
		Width:       input.Width,
	}

	if field.Width == "" {
		field.Width = "full"
	}

	if err := database.DB.Create(&field).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Also create in legacy table_fields
	var form models.Form
	if database.DB.First(&form, "id = ?", formID).Error == nil && form.LegacyTableID != nil {
		var desc string
		if input.Description != nil {
			desc = *input.Description
		}
		legacyField := models.Field{
			TableID:     *form.LegacyTableID,
			Name:        input.FieldKey,
			Label:       input.Label,
			Type:        input.FieldType,
			Description: desc,
			Position:    input.SortOrder,
			Validation:  datatypes.JSON(input.Validation),
		}
		if err := database.DB.Create(&legacyField).Error; err == nil {
			field.LegacyFieldID = &legacyField.ID
			database.DB.Save(&field)
		}
	}

	c.JSON(http.StatusCreated, field)
}

// UpdateFormFieldV2 updates a field
// PATCH /api/v2/fields/:id
func UpdateFormFieldV2(c *gin.Context) {
	fieldID := c.Param("id")

	var field models.FormField
	if err := database.DB.First(&field, "id = ?", fieldID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Field not found"})
		return
	}

	var input struct {
		SectionID   *string         `json:"section_id"`
		FieldKey    *string         `json:"field_key"`
		FieldType   *string         `json:"field_type"`
		Label       *string         `json:"label"`
		Description *string         `json:"description"`
		Placeholder *string         `json:"placeholder"`
		Required    *bool           `json:"required"`
		Validation  json.RawMessage `json:"validation"`
		Options     json.RawMessage `json:"options"`
		Conditions  json.RawMessage `json:"conditions"`
		SortOrder   *int            `json:"sort_order"`
		Width       *string         `json:"width"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields
	if input.FieldKey != nil {
		field.FieldKey = *input.FieldKey
	}
	if input.FieldType != nil {
		field.FieldType = *input.FieldType
	}
	if input.Label != nil {
		field.Label = *input.Label
	}
	if input.Description != nil {
		field.Description = input.Description
	}
	if input.Placeholder != nil {
		field.Placeholder = input.Placeholder
	}
	if input.Required != nil {
		field.Required = *input.Required
	}
	if input.Validation != nil {
		field.Validation = datatypes.JSON(input.Validation)
	}
	if input.Options != nil {
		field.Options = datatypes.JSON(input.Options)
	}
	if input.Conditions != nil {
		field.Conditions = datatypes.JSON(input.Conditions)
	}
	if input.SortOrder != nil {
		field.SortOrder = *input.SortOrder
	}
	if input.Width != nil {
		field.Width = *input.Width
	}

	field.Version++

	if err := database.DB.Save(&field).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Sync to legacy field if linked
	if field.LegacyFieldID != nil {
		database.DB.Model(&models.Field{}).Where("id = ?", field.LegacyFieldID).Updates(map[string]interface{}{
			"name":        field.FieldKey,
			"label":       field.Label,
			"type":        field.FieldType,
			"description": field.Description,
			"position":    field.SortOrder,
			"validation":  field.Validation,
		})
	}

	c.JSON(http.StatusOK, field)
}

// DeleteFormFieldV2 deletes a field
// DELETE /api/v2/fields/:id
func DeleteFormFieldV2(c *gin.Context) {
	fieldID := c.Param("id")

	var field models.FormField
	if err := database.DB.First(&field, "id = ?", fieldID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Field not found"})
		return
	}

	// Delete legacy field if linked
	if field.LegacyFieldID != nil {
		database.DB.Delete(&models.Field{}, "id = ?", field.LegacyFieldID)
	}

	if err := database.DB.Delete(&field).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Field deleted"})
}

// ==================== SUBMISSIONS ====================

// GetMySubmissionsV2 gets current user's submissions across all forms
// GET /api/v2/submissions/me
func GetMySubmissionsV2(c *gin.Context) {
	userID := c.GetString("ba_user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	// Query the view
	var submissions []struct {
		FormID               uuid.UUID  `json:"form_id"`
		FormName             string     `json:"form_name"`
		FormSlug             string     `json:"form_slug"`
		WorkspaceID          uuid.UUID  `json:"workspace_id"`
		SubmissionID         uuid.UUID  `json:"submission_id"`
		Status               string     `json:"status"`
		CompletionPercentage int        `json:"completion_percentage"`
		StartedAt            time.Time  `json:"started_at"`
		SubmittedAt          *time.Time `json:"submitted_at"`
		LastSavedAt          time.Time  `json:"last_saved_at"`
	}

	if err := database.DB.Table("user_form_submissions").
		Where("user_id = ?", userID).
		Scan(&submissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get user info
	var user models.BetterAuthUser
	database.DB.First(&user, "id = ?", userID)

	result := models.UserFormSubmissions{
		UserID:      user.ID,
		Email:       user.Email,
		UserName:    &user.Name,
		Submissions: make([]models.UserFormSubmissionItem, len(submissions)),
	}

	for i, s := range submissions {
		result.Submissions[i] = models.UserFormSubmissionItem{
			FormID:               s.FormID,
			FormName:             s.FormName,
			FormSlug:             s.FormSlug,
			WorkspaceID:          s.WorkspaceID,
			SubmissionID:         s.SubmissionID,
			Status:               s.Status,
			CompletionPercentage: s.CompletionPercentage,
			StartedAt:            s.StartedAt,
			SubmittedAt:          s.SubmittedAt,
			LastSavedAt:          s.LastSavedAt,
		}
	}

	c.JSON(http.StatusOK, result)
}

// StartSubmissionV2 starts or gets existing submission for a form
// POST /api/v2/forms/:id/submissions/start
func StartSubmissionV2(c *gin.Context) {
	formID := c.Param("id")
	userID := c.GetString("ba_user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	formUUID, err := uuid.Parse(formID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form ID"})
		return
	}

	// Check if form exists and is published
	var form models.Form
	if err := database.DB.First(&form, "id = ? AND status = 'published'", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found or not published"})
		return
	}

	// Check for existing submission
	var submission models.FormSubmission
	err = database.DB.
		Preload("Responses").
		Preload("Responses.Field").
		First(&submission, "form_id = ? AND user_id = ? AND status != 'withdrawn'", formID, userID).Error

	if err == nil {
		// Return existing submission
		c.JSON(http.StatusOK, submission)
		return
	}

	// Create new submission (UserID is string/TEXT to match ba_users.id)
	submission = models.FormSubmission{
		FormID:      formUUID,
		UserID:      userID,
		Status:      "draft",
		FormVersion: form.Version,
	}

	if err := database.DB.Create(&submission).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Also create in legacy table_rows for backward compatibility
	if form.LegacyTableID != nil {
		var user models.BetterAuthUser
		database.DB.First(&user, "id = ?", userID)

		legacyRow := models.Row{
			TableID:  *form.LegacyTableID,
			Data:     datatypes.JSON([]byte(`{"_applicant_email":"` + user.Email + `"}`)),
			Metadata: datatypes.JSON([]byte(`{"status":"draft"}`)),
		}
		if err := database.DB.Create(&legacyRow).Error; err == nil {
			submission.LegacyRowID = &legacyRow.ID
			database.DB.Save(&submission)
		}
	}

	c.JSON(http.StatusCreated, submission)
}

// GetSubmissionV2 gets a submission with all responses
// GET /api/v2/submissions/:id
func GetSubmissionV2(c *gin.Context) {
	submissionID := c.Param("id")
	userID := c.GetString("ba_user_id")

	var submission models.FormSubmission
	query := database.DB.
		Preload("Form").
		Preload("Form.Fields", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC")
		}).
		Preload("Responses").
		Preload("Responses.Field")

	if err := query.First(&submission, "id = ?", submissionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Check ownership (unless admin) - UserID is string now
	if userID != "" && submission.UserID != userID {
		// TODO: Check if user is admin of workspace
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	c.JSON(http.StatusOK, submission)
}

// SaveResponsesV2 saves/updates responses for a submission
// PUT /api/v2/submissions/:id/responses
func SaveResponsesV2(c *gin.Context) {
	submissionID := c.Param("id")
	userID := c.GetString("ba_user_id")

	submissionUUID, err := uuid.Parse(submissionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid submission ID"})
		return
	}

	var submission models.FormSubmission
	if err := database.DB.
		Preload("Form").
		Preload("Form.Fields").
		First(&submission, "id = ?", submissionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Check ownership - UserID is string now
	if userID != "" && submission.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var input struct {
		Responses map[string]any `json:"responses"` // field_key -> value
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Build field lookup by key
	fieldsByKey := make(map[string]models.FormField)
	for _, f := range submission.Form.Fields {
		fieldsByKey[f.FieldKey] = f
	}

	// Process each response
	for fieldKey, value := range input.Responses {
		field, exists := fieldsByKey[fieldKey]
		if !exists {
			continue // Skip unknown fields
		}

		// Find or create response
		var response models.FormResponse
		err := database.DB.First(&response, "submission_id = ? AND field_id = ?", submissionID, field.ID).Error

		if err != nil {
			// Create new response
			response = models.FormResponse{
				SubmissionID: submissionUUID,
				FieldID:      field.ID,
			}
		} else {
			// Save history before updating
			history := models.FormResponseHistory{
				ResponseID:            response.ID,
				PreviousValueText:     response.ValueText,
				PreviousValueNumber:   response.ValueNumber,
				PreviousValueBoolean:  response.ValueBoolean,
				PreviousValueDate:     response.ValueDate,
				PreviousValueDatetime: response.ValueDatetime,
				PreviousValueJSON:     response.ValueJSON,
				PreviousValueType:     &response.ValueType,
				ChangeReason:          stringPtr("autosave"),
			}
			if userID != "" {
				history.ChangedBy = &userID
			}
			database.DB.Create(&history)
		}

		// Set the typed value
		response.SetValue(value, field.FieldType)

		// Save response
		if err := database.DB.Save(&response).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	// Update submission timestamps and progress
	submission.LastSavedAt = time.Now()
	if submission.Status == "draft" {
		submission.Status = "in_progress"
	}

	// Calculate completion percentage
	var requiredCount, answeredCount int64
	database.DB.Model(&models.FormField{}).
		Where("form_id = ? AND required = true", submission.FormID).
		Count(&requiredCount)

	database.DB.Model(&models.FormResponse{}).
		Joins("JOIN form_fields ON form_responses.field_id = form_fields.id").
		Where("form_responses.submission_id = ? AND form_fields.required = true", submissionID).
		Where("form_responses.value_text IS NOT NULL OR form_responses.value_number IS NOT NULL OR form_responses.value_boolean IS NOT NULL OR form_responses.value_date IS NOT NULL OR form_responses.value_datetime IS NOT NULL OR form_responses.value_json IS NOT NULL").
		Count(&answeredCount)

	if requiredCount > 0 {
		submission.CompletionPercentage = int(float64(answeredCount) / float64(requiredCount) * 100)
	} else {
		submission.CompletionPercentage = 100
	}

	database.DB.Save(&submission)

	// Sync to legacy table_rows
	if submission.LegacyRowID != nil {
		syncToLegacyRow(submission)
	}

	c.JSON(http.StatusOK, submission)
}

// SubmitSubmissionV2 submits the form
// POST /api/v2/submissions/:id/submit
func SubmitSubmissionV2(c *gin.Context) {
	submissionID := c.Param("id")
	userID := c.GetString("ba_user_id")

	var submission models.FormSubmission
	if err := database.DB.
		Preload("Form").
		Preload("Form.Fields").
		Preload("Responses").
		First(&submission, "id = ?", submissionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Check ownership - UserID is string now
	if userID != "" && submission.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Validate all required fields are filled
	fieldsByID := make(map[uuid.UUID]models.FormField)
	for _, f := range submission.Form.Fields {
		fieldsByID[f.ID] = f
	}

	responsesByField := make(map[uuid.UUID]models.FormResponse)
	for _, r := range submission.Responses {
		responsesByField[r.FieldID] = r
	}

	var missingFields []string
	for _, field := range submission.Form.Fields {
		if field.Required {
			response, exists := responsesByField[field.ID]
			if !exists || response.GetValue() == nil {
				missingFields = append(missingFields, field.Label)
			}
		}
	}

	if len(missingFields) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":          "Missing required fields",
			"missing_fields": missingFields,
		})
		return
	}

	// Update submission status
	now := time.Now()
	submission.Status = "submitted"
	submission.SubmittedAt = &now
	submission.CompletionPercentage = 100

	if err := database.DB.Save(&submission).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Sync to legacy
	if submission.LegacyRowID != nil {
		syncToLegacyRow(submission)
		database.DB.Model(&models.Row{}).Where("id = ?", submission.LegacyRowID).Updates(map[string]interface{}{
			"metadata": datatypes.JSON([]byte(`{"status":"submitted","submitted_at":"` + now.Format(time.RFC3339) + `"}`)),
		})
	}

	c.JSON(http.StatusOK, submission)
}

// ==================== ADMIN SUBMISSIONS ====================

// ListFormSubmissionsV2 lists all submissions for a form (admin)
// GET /api/v2/forms/:id/submissions
func ListFormSubmissionsV2(c *gin.Context) {
	formID := c.Param("id")

	// Parse pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	offset := (page - 1) * limit

	// Base query
	query := database.DB.Table("form_submissions_full").Where("form_id = ?", formID)

	// Optional filters
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if search := c.Query("search"); search != "" {
		query = query.Where("user_email ILIKE ? OR user_name ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	// Count total
	var total int64
	query.Count(&total)

	// Get paginated results
	var submissions []models.FormSubmissionFull
	if err := query.
		Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Scan(&submissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"submissions": submissions,
		"total":       total,
		"page":        page,
		"limit":       limit,
	})
}

// ==================== HELPERS ====================

func stringPtr(s string) *string {
	return &s
}

// syncToLegacyRow syncs submission responses to legacy table_rows.data
func syncToLegacyRow(submission models.FormSubmission) {
	if submission.LegacyRowID == nil {
		return
	}

	// Load responses with fields
	var responses []models.FormResponse
	database.DB.Preload("Field").Where("submission_id = ?", submission.ID).Find(&responses)

	// Build data object
	data := make(map[string]any)

	// Get user email for _applicant_email
	var user models.BetterAuthUser
	if database.DB.First(&user, "id = ?", submission.UserID).Error == nil {
		data["_applicant_email"] = user.Email
	}

	for _, r := range responses {
		if r.Field != nil {
			data[r.Field.FieldKey] = r.GetValue()
			// Also store by legacy field ID if linked
			if r.Field.LegacyFieldID != nil {
				data[r.Field.LegacyFieldID.String()] = r.GetValue()
			}
		}
	}

	// Marshal and update
	if jsonData, err := json.Marshal(data); err == nil {
		database.DB.Model(&models.Row{}).Where("id = ?", submission.LegacyRowID).Update("data", datatypes.JSON(jsonData))
	}
}
