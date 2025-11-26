package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Form Handlers

type FormDTO struct {
	ID          uuid.UUID              `json:"id"`
	WorkspaceID uuid.UUID              `json:"workspace_id"`
	Name        string                 `json:"name"`
	Slug        string                 `json:"slug"`
	Description string                 `json:"description"`
	Settings    map[string]interface{} `json:"settings"`
	IsPublished bool                   `json:"is_published"`
	Fields      []models.Field         `json:"fields,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

func ListForms(c *gin.Context) {
	workspaceID := c.Query("workspace_id")

	var tables []models.Table
	query := database.DB.Where("icon = ?", "form")

	if workspaceID != "" {
		query = query.Where("workspace_id = ?", workspaceID)
	}

	if err := query.Order("created_at DESC").Find(&tables).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var forms []FormDTO
	for _, table := range tables {
		var settings map[string]interface{}
		json.Unmarshal(table.Settings, &settings)

		// Try to find associated form view to get IsPublished
		var view models.View
		isPublished := false
		if err := database.DB.Where("table_id = ? AND type = ?", table.ID, "form").First(&view).Error; err == nil {
			var config map[string]interface{}
			json.Unmarshal(view.Config, &config)
			if val, ok := config["is_published"].(bool); ok {
				isPublished = val
			}
		}

		forms = append(forms, FormDTO{
			ID:          table.ID,
			WorkspaceID: table.WorkspaceID,
			Name:        table.Name,
			Slug:        table.Slug,
			Description: table.Description,
			Settings:    settings,
			IsPublished: isPublished,
			CreatedAt:   table.CreatedAt,
			UpdatedAt:   table.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, forms)
}

func GetForm(c *gin.Context) {
	id := c.Param("id")

	var table models.Table
	if err := database.DB.First(&table, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	var fields []models.Field
	database.DB.Where("table_id = ?", id).Order("position ASC").Find(&fields)

	var view models.View
	isPublished := false
	if err := database.DB.Where("table_id = ? AND type = ?", table.ID, "form").First(&view).Error; err == nil {
		var config map[string]interface{}
		json.Unmarshal(view.Config, &config)
		if val, ok := config["is_published"].(bool); ok {
			isPublished = val
		}
	}

	var settings map[string]interface{}
	json.Unmarshal(table.Settings, &settings)

	form := FormDTO{
		ID:          table.ID,
		WorkspaceID: table.WorkspaceID,
		Name:        table.Name,
		Slug:        table.Slug,
		Description: table.Description,
		Settings:    settings,
		IsPublished: isPublished,
		Fields:      fields,
		CreatedAt:   table.CreatedAt,
		UpdatedAt:   table.UpdatedAt,
	}

	c.JSON(http.StatusOK, form)
}

func GetFormBySlug(c *gin.Context) {
	slug := c.Param("slug")

	var table models.Table
	if err := database.DB.First(&table, "slug = ?", slug).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	var fields []models.Field
	database.DB.Where("table_id = ?", table.ID).Order("position ASC").Find(&fields)

	var view models.View
	isPublished := false
	if err := database.DB.Where("table_id = ? AND type = ?", table.ID, "form").First(&view).Error; err == nil {
		var config map[string]interface{}
		json.Unmarshal(view.Config, &config)
		if val, ok := config["is_published"].(bool); ok {
			isPublished = val
		}
	}

	var settings map[string]interface{}
	json.Unmarshal(table.Settings, &settings)

	form := FormDTO{
		ID:          table.ID,
		WorkspaceID: table.WorkspaceID,
		Name:        table.Name,
		Slug:        table.Slug,
		Description: table.Description,
		Settings:    settings,
		IsPublished: isPublished,
		Fields:      fields,
		CreatedAt:   table.CreatedAt,
		UpdatedAt:   table.UpdatedAt,
	}

	c.JSON(http.StatusOK, form)
}

type CreateFormInput struct {
	WorkspaceID uuid.UUID              `json:"workspace_id" binding:"required"`
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Settings    map[string]interface{} `json:"settings"`
	IsPublished bool                   `json:"is_published"`
}

func CreateForm(c *gin.Context) {
	var input CreateFormInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate slug from name
	slug := generateSlug(input.Name)

	// Check for duplicate slug in workspace
	var existing models.Table
	if err := database.DB.Where("workspace_id = ? AND slug = ?", input.WorkspaceID, slug).First(&existing).Error; err == nil {
		// Slug exists, append a number
		counter := 1
		for {
			newSlug := slug + "-" + fmt.Sprintf("%d", counter)
			if err := database.DB.Where("workspace_id = ? AND slug = ?", input.WorkspaceID, newSlug).First(&existing).Error; err != nil {
				slug = newSlug
				break
			}
			counter++
			if counter > 100 {
				// Fallback to UUID-based slug
				slug = slug + "-" + uuid.New().String()[:8]
				break
			}
		}
	}

	table := models.Table{
		WorkspaceID: input.WorkspaceID,
		Name:        input.Name,
		Slug:        slug,
		Description: input.Description,
		Settings:    mapToJSON(input.Settings),
		Icon:        "form",
		CreatedBy:   uuid.Nil,
	}

	if userID, exists := middleware.GetUserID(c); exists {
		if parsedUserID, err := uuid.Parse(userID); err == nil {
			table.CreatedBy = parsedUserID
		}
	}

	if err := database.DB.Create(&table).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	viewConfig := map[string]interface{}{
		"is_published": input.IsPublished,
	}

	view := models.View{
		TableID:   table.ID,
		Name:      "Form View",
		Type:      "form",
		Config:    mapToJSON(viewConfig),
		CreatedBy: table.CreatedBy,
	}

	database.DB.Create(&view)

	c.JSON(http.StatusCreated, FormDTO{
		ID:          table.ID,
		WorkspaceID: table.WorkspaceID,
		Name:        table.Name,
		Slug:        table.Slug,
		Description: table.Description,
		Settings:    input.Settings,
		IsPublished: input.IsPublished,
		CreatedAt:   table.CreatedAt,
		UpdatedAt:   table.UpdatedAt,
	})
}

type UpdateFormInput struct {
	Name        *string                 `json:"name"`
	Slug        *string                 `json:"slug"`
	Description *string                 `json:"description"`
	Settings    *map[string]interface{} `json:"settings"`
	IsPublished *bool                   `json:"is_published"`
}

func UpdateForm(c *gin.Context) {
	id := c.Param("id")

	var table models.Table
	if err := database.DB.First(&table, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	var input UpdateFormInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Name != nil {
		table.Name = *input.Name
	}
	if input.Slug != nil {
		table.Slug = *input.Slug
	}
	if input.Description != nil {
		table.Description = *input.Description
	}
	if input.Settings != nil {
		table.Settings = mapToJSON(*input.Settings)
	}

	if err := database.DB.Save(&table).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if input.IsPublished != nil {
		var view models.View
		if err := database.DB.Where("table_id = ? AND type = ?", table.ID, "form").First(&view).Error; err == nil {
			var config map[string]interface{}
			json.Unmarshal(view.Config, &config)
			config["is_published"] = *input.IsPublished
			view.Config = mapToJSON(config)
			database.DB.Save(&view)
		}
	}

	// Re-fetch to return full DTO
	GetForm(c)
}

func DeleteForm(c *gin.Context) {
	id := c.Param("id")

	var table models.Table
	if err := database.DB.First(&table, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	if err := database.DB.Delete(&table).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// Form Submission Handlers

func ListFormSubmissions(c *gin.Context) {
	formID := c.Param("id")

	var rows []models.Row
	if err := database.DB.Where("table_id = ?", formID).Order("created_at DESC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rows)
}

type SubmitFormInput struct {
	Data  map[string]interface{} `json:"data" binding:"required"`
	Email string                 `json:"email"`
}

func SubmitForm(c *gin.Context) {
	formID := c.Param("id")

	// Verify form exists and is published
	var view models.View
	if err := database.DB.Where("table_id = ? AND type = ?", formID, "form").First(&view).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found or not configured"})
		return
	}

	var config map[string]interface{}
	json.Unmarshal(view.Config, &config)
	if val, ok := config["is_published"].(bool); !ok || !val {
		c.JSON(http.StatusForbidden, gin.H{"error": "Form is not published"})
		return
	}

	var input SubmitFormInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data := input.Data
	if data == nil {
		data = make(map[string]interface{})
	}

	data["_ip_address"] = c.ClientIP()
	data["_user_agent"] = c.Request.UserAgent()

	// Check for existing submission if email is present
	email := input.Email
	if email == "" {
		if personal, ok := data["personal"].(map[string]interface{}); ok {
			if e, ok := personal["personalEmail"].(string); ok {
				email = e
			}
		}
	}

	if email != "" {
		// Ensure email is saved in data for future reference if not already there
		if _, ok := data["personal"]; !ok {
			data["personal"] = map[string]interface{}{
				"personalEmail": email,
			}
		} else if personal, ok := data["personal"].(map[string]interface{}); ok {
			personal["personalEmail"] = email
			data["personal"] = personal
		}

		var existingRow models.Row
		// Postgres JSONB query: data->'personal'->>'personalEmail' = ?
		if err := database.DB.Where("table_id = ? AND data->'personal'->>'personalEmail' = ?", formID, email).First(&existingRow).Error; err == nil {
			// Update existing row
			existingRow.Data = mapToJSON(data)
			existingRow.UpdatedAt = time.Now()
			database.DB.Save(&existingRow)
			c.JSON(http.StatusOK, existingRow)
			return
		}
	}

	row := models.Row{
		TableID: uuid.MustParse(formID),
		Data:    mapToJSON(data),
	}

	// Add user ID if authenticated (optional for forms)
	if userID, exists := middleware.GetUserID(c); exists {
		if parsedUserID, err := uuid.Parse(userID); err == nil {
			row.CreatedBy = &parsedUserID
		}
	}

	if err := database.DB.Create(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, row)
}

type FieldInput struct {
	ID          string                 `json:"id"`
	Label       string                 `json:"label"`
	Type        string                 `json:"type"`
	Position    int                    `json:"position"`
	IsRequired  bool                   `json:"required"`
	Placeholder string                 `json:"placeholder"`
	Options     []string               `json:"options"`
	Width       string                 `json:"width"`
	Children    []FieldInput           `json:"children"`
	Validation  map[string]interface{} `json:"validation"`
}

type SectionInput struct {
	ID          string       `json:"id"`
	Title       string       `json:"title"`
	Description string       `json:"description"`
	Fields      []FieldInput `json:"fields"`
}

type UpdateFormStructureInput struct {
	Settings map[string]interface{} `json:"settings"`
	Sections []SectionInput         `json:"sections"`
}

func UpdateFormStructure(c *gin.Context) {
	id := c.Param("id")

	var table models.Table
	if err := database.DB.First(&table, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	var input UpdateFormStructureInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Start transaction
	tx := database.DB.Begin()

	// Update form settings
	// We also want to store the section structure (without fields) in settings
	// so we can reconstruct the sections on load.
	settings := input.Settings
	if settings == nil {
		settings = make(map[string]interface{})
	}

	var sectionMeta []map[string]interface{}
	for _, s := range input.Sections {
		sectionMeta = append(sectionMeta, map[string]interface{}{
			"id":          s.ID,
			"title":       s.Title,
			"description": s.Description,
		})
	}
	settings["sections"] = sectionMeta

	table.Settings = mapToJSON(settings)
	if name, ok := settings["name"].(string); ok {
		table.Name = name
	}
	if err := tx.Save(&table).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Delete existing fields
	if err := tx.Where("table_id = ?", table.ID).Delete(&models.Field{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create new fields
	var newFields []models.Field
	position := 0

	for _, section := range input.Sections {
		for _, fieldInput := range section.Fields {
			// Construct config JSON
			config := make(map[string]interface{})
			if len(fieldInput.Options) > 0 {
				config["items"] = fieldInput.Options
			}
			if fieldInput.Width != "" {
				config["width"] = fieldInput.Width
			}
			config["section_id"] = section.ID
			config["is_required"] = fieldInput.IsRequired
			config["placeholder"] = fieldInput.Placeholder

			if len(fieldInput.Validation) > 0 {
				config["validation"] = fieldInput.Validation
			}

			// Handle children for groups/repeaters
			if len(fieldInput.Children) > 0 {
				config["children"] = fieldInput.Children
			}

			field := models.Field{
				TableID:  table.ID,
				Label:    fieldInput.Label,
				Name:     fieldInput.Label,
				Type:     fieldInput.Type,
				Position: position,
				Config:   mapToJSON(config),
			}

			// Use ID from frontend if valid UUID, else generate new
			if uid, err := uuid.Parse(fieldInput.ID); err == nil {
				field.ID = uid
			} else {
				field.ID = uuid.New()
			}

			if field.Name == "" {
				field.Name = "field_" + field.ID.String()[:8]
			}

			newFields = append(newFields, field)
			position++
		}
	}

	if len(newFields) > 0 {
		if err := tx.Create(&newFields).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"message": "Form structure updated", "fields_count": len(newFields)})
}

func GetFormSubmission(c *gin.Context) {
	formID := c.Param("id")
	email := c.Query("email")

	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email is required"})
		return
	}

	var row models.Row
	if err := database.DB.Where("table_id = ? AND data->'personal'->>'personalEmail' = ?", formID, email).First(&row).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	var data map[string]interface{}
	json.Unmarshal(row.Data, &data)
	c.JSON(http.StatusOK, data)
}

// External Review Handlers

type ExternalReviewDTO struct {
	Form        FormDTO      `json:"form"`
	Submissions []models.Row `json:"submissions"`
}

func GetExternalReviewData(c *gin.Context) {
	token := c.Param("token")

	// Find form with this review token in settings
	// Note: This is a JSONB query. Syntax depends on GORM/Postgres driver.
	// We'll fetch all forms and filter in memory for simplicity if JSON query is complex,
	// but better to use database query.
	// Postgres: settings->>'review_token' = ?

	var table models.Table
	if err := database.DB.Where("settings->>'review_token' = ?", token).First(&table).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invalid review token"})
		return
	}

	// Get Form Details (reuse GetForm logic)
	var fields []models.Field
	database.DB.Where("table_id = ?", table.ID).Order("position ASC").Find(&fields)

	var settings map[string]interface{}
	json.Unmarshal(table.Settings, &settings)

	formDTO := FormDTO{
		ID:          table.ID,
		WorkspaceID: table.WorkspaceID,
		Name:        table.Name,
		Slug:        table.Slug,
		Description: table.Description,
		Settings:    settings,
		Fields:      fields,
		CreatedAt:   table.CreatedAt,
		UpdatedAt:   table.UpdatedAt,
	}

	// Get Submissions
	var rows []models.Row
	if err := database.DB.Where("table_id = ?", table.ID).Order("created_at DESC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ExternalReviewDTO{
		Form:        formDTO,
		Submissions: rows,
	})
}

type SubmitReviewInput struct {
	Scores   map[string]int            `json:"scores"`
	Notes    map[string]string         `json:"notes"`
	Comments map[string]string         `json:"comments"`
	Status   string                    `json:"status"` // 'approved', 'rejected', 'reviewed'
}

func SubmitExternalReview(c *gin.Context) {
	token := c.Param("token")
	submissionID := c.Param("submission_id")

	// Verify token
	var table models.Table
	if err := database.DB.Where("settings->>'review_token' = ?", token).First(&table).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Invalid review token"})
		return
	}

	var input SubmitReviewInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get submission
	var row models.Row
	if err := database.DB.First(&row, "id = ? AND table_id = ?", submissionID, table.ID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Update submission metadata with review data
	var metadata map[string]interface{}
	if len(row.Metadata) > 0 {
		json.Unmarshal(row.Metadata, &metadata)
	} else {
		metadata = make(map[string]interface{})
	}

	// Store review in metadata
	reviewData := map[string]interface{}{
		"scores":      input.Scores,
		"notes":       input.Notes,
		"comments":    input.Comments,
		"reviewed_at": time.Now(),
		"reviewer":    "External Reviewer", // Could be passed in input if we had reviewer names
	}

	// Append to reviews array or overwrite? Let's overwrite for single reviewer for now,
	// or append if we want multiple.
	metadata["review"] = reviewData

	// Update status if provided
	if input.Status != "" {
		metadata["status"] = input.Status
		metadata["reviewed_at"] = time.Now()
	}

	row.Metadata = mapToJSON(metadata)

	if err := database.DB.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, row)
}
