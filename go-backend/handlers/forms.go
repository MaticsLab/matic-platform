package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/Jsanchez767/matic-platform/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Form Handlers

type FormDTO struct {
	ID          uuid.UUID              `json:"id"`
	ViewID      *uuid.UUID             `json:"view_id,omitempty"`
	WorkspaceID uuid.UUID              `json:"workspace_id"`
	Name        string                 `json:"name"`
	Slug        string                 `json:"slug"`
	CustomSlug  *string                `json:"custom_slug,omitempty"`
	Description string                 `json:"description"`
	Settings    map[string]interface{} `json:"settings"`
	IsPublished bool                   `json:"is_published"`
	Fields      []models.Field         `json:"fields,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	// Preview/Share metadata
	PreviewTitle       *string `json:"preview_title,omitempty"`
	PreviewDescription *string `json:"preview_description,omitempty"`
	PreviewImageURL    *string `json:"preview_image_url,omitempty"`
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
			ID:                 table.ID,
			WorkspaceID:        table.WorkspaceID,
			Name:               table.Name,
			Slug:               table.Slug,
			CustomSlug:         table.CustomSlug,
			Description:        table.Description,
			Settings:           settings,
			IsPublished:        isPublished,
			CreatedAt:          table.CreatedAt,
			UpdatedAt:          table.UpdatedAt,
			PreviewTitle:       table.PreviewTitle,
			PreviewDescription: table.PreviewDescription,
			PreviewImageURL:    table.PreviewImageURL,
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

	// Enrich fields with section_id from config
	for i := range fields {
		if fields[i].SectionID == nil || *fields[i].SectionID == "" {
			// Try to get section_id from Config
			var config map[string]interface{}
			json.Unmarshal(fields[i].Config, &config)
			if sid, ok := config["section_id"].(string); ok && sid != "" {
				fields[i].SectionID = &sid
			}
		}
	}

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
		ID:                 table.ID,
		WorkspaceID:        table.WorkspaceID,
		Name:               table.Name,
		Slug:               table.Slug,
		CustomSlug:         table.CustomSlug,
		Description:        table.Description,
		Settings:           settings,
		IsPublished:        isPublished,
		Fields:             fields,
		CreatedAt:          table.CreatedAt,
		UpdatedAt:          table.UpdatedAt,
		PreviewTitle:       table.PreviewTitle,
		PreviewDescription: table.PreviewDescription,
		PreviewImageURL:    table.PreviewImageURL,
	}

	c.JSON(http.StatusOK, form)
}

func GetFormBySlug(c *gin.Context) {
	slugOrId := c.Param("slug")

	var table models.Table
	// First try to find by UUID ID
	if _, err := uuid.Parse(slugOrId); err == nil {
		if err := database.DB.First(&table, "id = ?", slugOrId).Error; err == nil {
			// Found by ID
			goto found
		}
	}

	// Try to find by custom_slug first (user-defined pretty URLs)
	if err := database.DB.First(&table, "custom_slug = ?", slugOrId).Error; err == nil {
		goto found
	}

	// Fall back to the auto-generated slug
	if err := database.DB.First(&table, "slug = ?", slugOrId).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

found:
	var fields []models.Field
	database.DB.Where("table_id = ?", table.ID).Order("position ASC").Find(&fields)

	// Enrich fields with section_id from config
	for i := range fields {
		if fields[i].SectionID == nil || *fields[i].SectionID == "" {
			// Try to get section_id from Config
			var config map[string]interface{}
			json.Unmarshal(fields[i].Config, &config)
			if sid, ok := config["section_id"].(string); ok && sid != "" {
				fields[i].SectionID = &sid
			}
		}
	}

	var view models.View
	isPublished := false
	var viewID *uuid.UUID
	if err := database.DB.Where("table_id = ? AND type = ?", table.ID, "form").First(&view).Error; err == nil {
		viewID = &view.ID
		var config map[string]interface{}
		json.Unmarshal(view.Config, &config)
		if val, ok := config["is_published"].(bool); ok {
			isPublished = val
		}
	} else {
		// No form view exists - create one automatically
		viewConfig := map[string]interface{}{
			"is_published": false,
		}
		view = models.View{
			TableID:   table.ID,
			Name:      "Form View",
			Type:      "form",
			Config:    mapToJSON(viewConfig),
			CreatedBy: table.CreatedBy,
		}
		if err := database.DB.Create(&view).Error; err == nil {
			viewID = &view.ID
		}
	}

	var settings map[string]interface{}
	json.Unmarshal(table.Settings, &settings)

	form := FormDTO{
		ID:                 table.ID,
		ViewID:             viewID,
		WorkspaceID:        table.WorkspaceID,
		Name:               table.Name,
		Slug:               table.Slug,
		CustomSlug:         table.CustomSlug,
		Description:        table.Description,
		Settings:           settings,
		IsPublished:        isPublished,
		Fields:             fields,
		CreatedAt:          table.CreatedAt,
		UpdatedAt:          table.UpdatedAt,
		PreviewTitle:       table.PreviewTitle,
		PreviewDescription: table.PreviewDescription,
		PreviewImageURL:    table.PreviewImageURL,
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
		ID:                 table.ID,
		WorkspaceID:        table.WorkspaceID,
		Name:               table.Name,
		Slug:               table.Slug,
		Description:        table.Description,
		Settings:           input.Settings,
		IsPublished:        input.IsPublished,
		CreatedAt:          table.CreatedAt,
		UpdatedAt:          table.UpdatedAt,
		PreviewTitle:       table.PreviewTitle,
		PreviewDescription: table.PreviewDescription,
		PreviewImageURL:    table.PreviewImageURL,
	})
}

type UpdateFormInput struct {
	Name        *string                 `json:"name"`
	Slug        *string                 `json:"slug"`
	Description *string                 `json:"description"`
	Settings    *map[string]interface{} `json:"settings"`
	IsPublished *bool                   `json:"is_published"`
	// Preview/Share metadata
	PreviewTitle       *string `json:"preview_title"`
	PreviewDescription *string `json:"preview_description"`
	PreviewImageURL    *string `json:"preview_image_url"`
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
	if input.PreviewTitle != nil {
		table.PreviewTitle = input.PreviewTitle
	}
	if input.PreviewDescription != nil {
		table.PreviewDescription = input.PreviewDescription
	}
	if input.PreviewImageURL != nil {
		table.PreviewImageURL = input.PreviewImageURL
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

	// Use a transaction to delete all related data
	tx := database.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}

	// Delete all rows (submissions) for this table
	if err := tx.Where("table_id = ?", id).Delete(&models.Row{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete submissions: " + err.Error()})
		return
	}

	// Delete all fields for this table
	if err := tx.Where("table_id = ?", id).Delete(&models.Field{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete fields: " + err.Error()})
		return
	}

	// Delete all workflows associated with this form
	if err := tx.Where("form_id = ?", id).Delete(&models.ReviewWorkflow{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete workflows: " + err.Error()})
		return
	}

	// Delete the table/form itself
	if err := tx.Delete(&table).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete form: " + err.Error()})
		return
	}

	// Commit the transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit deletion: " + err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// UpdateFormCustomSlugInput represents the request body for updating a form's custom slug
type UpdateFormCustomSlugInput struct {
	CustomSlug *string `json:"custom_slug"` // Can be null to remove custom slug
}

// isValidCustomSlug validates a custom slug
func isValidCustomSlug(slug string) bool {
	// Must be 3-50 characters
	if len(slug) < 3 || len(slug) > 50 {
		return false
	}

	// Must only contain lowercase letters, numbers, and hyphens
	validPattern := regexp.MustCompile(`^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$`)
	if !validPattern.MatchString(slug) {
		return false
	}

	// Cannot have consecutive hyphens
	if strings.Contains(slug, "--") {
		return false
	}

	// Cannot be a UUID format
	uuidPattern := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	if uuidPattern.MatchString(slug) {
		return false
	}

	return true
}

// UpdateFormCustomSlug updates the custom URL slug for a form/portal
func UpdateFormCustomSlug(c *gin.Context) {
	id := c.Param("id")

	var table models.Table
	if err := database.DB.First(&table, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	var input UpdateFormCustomSlugInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// If custom_slug is provided, validate it
	if input.CustomSlug != nil && *input.CustomSlug != "" {
		slug := strings.ToLower(strings.TrimSpace(*input.CustomSlug))

		if !isValidCustomSlug(slug) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid custom slug. Must be 3-50 characters, lowercase alphanumeric with hyphens (no consecutive hyphens or leading/trailing hyphens).",
			})
			return
		}

		// Check if slug is already taken by another form
		var existing models.Table
		if err := database.DB.Where("custom_slug = ? AND id != ?", slug, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "This custom URL is already taken"})
			return
		}

		table.CustomSlug = &slug
	} else {
		// Remove custom slug (set to nil)
		table.CustomSlug = nil
	}

	if err := database.DB.Save(&table).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return the updated form
	var settings map[string]interface{}
	json.Unmarshal(table.Settings, &settings)

	var view models.View
	isPublished := false
	if err := database.DB.Where("table_id = ? AND type = ?", table.ID, "form").First(&view).Error; err == nil {
		var config map[string]interface{}
		json.Unmarshal(view.Config, &config)
		if val, ok := config["is_published"].(bool); ok {
			isPublished = val
		}
	}

	form := FormDTO{
		ID:                 table.ID,
		WorkspaceID:        table.WorkspaceID,
		Name:               table.Name,
		Slug:               table.Slug,
		CustomSlug:         table.CustomSlug,
		Description:        table.Description,
		Settings:           settings,
		IsPublished:        isPublished,
		CreatedAt:          table.CreatedAt,
		UpdatedAt:          table.UpdatedAt,
		PreviewTitle:       table.PreviewTitle,
		PreviewDescription: table.PreviewDescription,
		PreviewImageURL:    table.PreviewImageURL,
	}

	c.JSON(http.StatusOK, form)
}

// PortalFormDTO extends FormDTO with workspace subdomain info
type PortalFormDTO struct {
	FormDTO
	WorkspaceName      string  `json:"workspace_name"`
	WorkspaceSubdomain *string `json:"workspace_subdomain,omitempty"`
}

// GetFormBySubdomainSlug resolves a form using subdomain + slug combination
// This supports pretty URLs like: {subdomain}.maticapp.com/{slug}
func GetFormBySubdomainSlug(c *gin.Context) {
	subdomain := c.Param("subdomain")
	slugOrId := c.Param("slug")

	// Find the workspace by subdomain
	var workspace models.Workspace
	if err := database.DB.First(&workspace, "custom_subdomain = ?", subdomain).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Subdomain not found"})
		return
	}

	// Find the form within this workspace
	var table models.Table
	query := database.DB.Where("workspace_id = ? AND icon = ?", workspace.ID, "form")

	// Try to find by UUID ID first
	if _, err := uuid.Parse(slugOrId); err == nil {
		if err := query.Where("id = ?", slugOrId).First(&table).Error; err == nil {
			goto found
		}
	}

	// Try custom_slug
	if err := query.Where("custom_slug = ?", slugOrId).First(&table).Error; err == nil {
		goto found
	}

	// Fall back to auto-generated slug
	if err := query.Where("slug = ?", slugOrId).First(&table).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found in this workspace"})
		return
	}

found:
	var fields []models.Field
	database.DB.Where("table_id = ?", table.ID).Order("position ASC").Find(&fields)

	var view models.View
	isPublished := false
	var viewID *uuid.UUID
	if err := database.DB.Where("table_id = ? AND type = ?", table.ID, "form").First(&view).Error; err == nil {
		viewID = &view.ID
		var config map[string]interface{}
		json.Unmarshal(view.Config, &config)
		if val, ok := config["is_published"].(bool); ok {
			isPublished = val
		}
	} else {
		// No form view exists - create one automatically
		viewConfig := map[string]interface{}{
			"is_published": false,
		}
		view = models.View{
			TableID:   table.ID,
			Name:      "Form View",
			Type:      "form",
			Config:    mapToJSON(viewConfig),
			CreatedBy: table.CreatedBy,
		}
		if err := database.DB.Create(&view).Error; err == nil {
			viewID = &view.ID
		}
	}

	var settings map[string]interface{}
	json.Unmarshal(table.Settings, &settings)

	form := PortalFormDTO{
		FormDTO: FormDTO{
			ID:                 table.ID,
			ViewID:             viewID,
			WorkspaceID:        table.WorkspaceID,
			Name:               table.Name,
			Slug:               table.Slug,
			CustomSlug:         table.CustomSlug,
			Description:        table.Description,
			Settings:           settings,
			IsPublished:        isPublished,
			Fields:             fields,
			CreatedAt:          table.CreatedAt,
			UpdatedAt:          table.UpdatedAt,
			PreviewTitle:       table.PreviewTitle,
			PreviewDescription: table.PreviewDescription,
			PreviewImageURL:    table.PreviewImageURL,
		},
		WorkspaceName:      workspace.Name,
		WorkspaceSubdomain: workspace.CustomSubdomain,
	}

	c.JSON(http.StatusOK, form)
}

// GetFormWithSubmissionsAndWorkflow returns form, submissions, and all workflow data in a single call
// This is the most optimized endpoint for loading the Review Workspace
func GetFormWithSubmissionsAndWorkflow(c *gin.Context) {
	startTime := time.Now()
	formID := c.Param("id")
	fmt.Printf("📊 [COMBINED ENDPOINT] Starting load for form %s\n", formID)

	// Response structure
	type StageWithDetails struct {
		models.ApplicationStage
		ReviewerConfigs []models.StageReviewerConfig `json:"reviewer_configs"`
		StageActions    []models.StageAction         `json:"stage_actions"`
	}

	type CombinedResponse struct {
		Form            FormDTO                   `json:"form"`
		Submissions     []models.Row              `json:"submissions"`
		Workflows       []models.ReviewWorkflow   `json:"workflows"`
		Rubrics         []models.Rubric           `json:"rubrics"`
		ReviewerTypes   []models.ReviewerType     `json:"reviewer_types"`
		Stages          []StageWithDetails        `json:"stages"`
		WorkflowActions []models.WorkflowAction   `json:"workflow_actions"`
		Groups          []models.ApplicationGroup `json:"groups"`
		StageGroups     []models.StageGroup       `json:"stage_groups"`
	}

	var response CombinedResponse

	// First get the form to get workspace_id
	var table models.Table
	if err := database.DB.First(&table, "id = ?", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}
	fmt.Printf("📊 [COMBINED ENDPOINT] Form lookup: %v\n", time.Since(startTime))

	workspaceID := table.WorkspaceID.String()

	// Parallel fetch all data
	var wg sync.WaitGroup
	var fields []models.Field
	var view models.View
	var submissions []models.Row
	var fieldsErr, submissionsErr, workflowsErr, rubricsErr, reviewerTypesErr, stageGroupsErr error

	// 7 parallel queries for base data
	wg.Add(7)

	// Form fields
	go func() {
		defer wg.Done()
		fieldsErr = database.DB.Where("table_id = ?", formID).Order("position ASC").Find(&fields).Error
	}()

	// Form view (for is_published)
	go func() {
		defer wg.Done()
		database.DB.Where("table_id = ? AND type = ?", table.ID, "form").First(&view)
	}()

	// Submissions
	go func() {
		defer wg.Done()
		submissionsErr = database.DB.Where("table_id = ?", formID).Order("created_at DESC").Find(&submissions).Error
	}()

	// Workflows
	go func() {
		defer wg.Done()
		workflowsErr = database.DB.Where("workspace_id = ?", workspaceID).Find(&response.Workflows).Error
	}()

	// Rubrics
	go func() {
		defer wg.Done()
		rubricsErr = database.DB.Where("workspace_id = ?", workspaceID).Find(&response.Rubrics).Error
	}()

	// Reviewer types
	go func() {
		defer wg.Done()
		reviewerTypesErr = database.DB.Where("workspace_id = ?", workspaceID).Find(&response.ReviewerTypes).Error
	}()

	// Stage groups
	go func() {
		defer wg.Done()
		stageGroupsErr = database.DB.Where("workspace_id = ?", workspaceID).Order("order_index ASC").Find(&response.StageGroups).Error
	}()

	wg.Wait()

	// Check critical errors
	if fieldsErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch form fields"})
		return
	}
	if submissionsErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch submissions"})
		return
	}
	if workflowsErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch workflows"})
		return
	}

	// Suppress non-critical errors - use empty slices
	if rubricsErr != nil {
		response.Rubrics = []models.Rubric{}
	}
	if reviewerTypesErr != nil {
		response.ReviewerTypes = []models.ReviewerType{}
	}
	if stageGroupsErr != nil {
		response.StageGroups = []models.StageGroup{}
	}

	// Build form response
	var settings map[string]interface{}
	json.Unmarshal(table.Settings, &settings)

	isPublished := false
	if view.ID != uuid.Nil {
		var config map[string]interface{}
		json.Unmarshal(view.Config, &config)
		if val, ok := config["is_published"].(bool); ok {
			isPublished = val
		}
	}

	response.Form = FormDTO{
		ID:          table.ID,
		WorkspaceID: table.WorkspaceID,
		Name:        table.Name,
		Slug:        table.Slug,
		CustomSlug:  table.CustomSlug,
		Description: table.Description,
		Settings:    settings,
		IsPublished: isPublished,
		Fields:      fields,
		CreatedAt:   table.CreatedAt,
		UpdatedAt:   table.UpdatedAt,
	}

	response.Submissions = submissions

	// Determine active workflow and get workflow-specific data
	var activeWorkflowID string
	if len(response.Workflows) > 0 {
		for _, w := range response.Workflows {
			if w.IsActive {
				activeWorkflowID = w.ID.String()
				break
			}
		}
		if activeWorkflowID == "" {
			activeWorkflowID = response.Workflows[0].ID.String()
		}
	}

	if activeWorkflowID != "" {
		// Fetch workflow actions, groups, and stages in parallel
		var stages []models.ApplicationStage
		var wg2 sync.WaitGroup
		wg2.Add(3)

		go func() {
			defer wg2.Done()
			database.DB.Where("review_workflow_id = ?", activeWorkflowID).Order("order_index ASC").Find(&response.WorkflowActions)
		}()

		go func() {
			defer wg2.Done()
			database.DB.Where("review_workflow_id = ?", activeWorkflowID).Order("order_index ASC").Find(&response.Groups)
		}()

		go func() {
			defer wg2.Done()
			database.DB.Where("workspace_id = ? AND review_workflow_id = ?", workspaceID, activeWorkflowID).Order("order_index ASC").Find(&stages)
		}()

		wg2.Wait()

		// Get stage configs and actions
		if len(stages) > 0 {
			stageIDs := make([]string, len(stages))
			for i, s := range stages {
				stageIDs[i] = s.ID.String()
			}

			var allConfigs []models.StageReviewerConfig
			var allActions []models.StageAction

			var wg3 sync.WaitGroup
			wg3.Add(2)

			go func() {
				defer wg3.Done()
				database.DB.Where("stage_id IN ?", stageIDs).Find(&allConfigs)
			}()

			go func() {
				defer wg3.Done()
				database.DB.Where("stage_id IN ?", stageIDs).Order("order_index ASC").Find(&allActions)
			}()

			wg3.Wait()

			// Map configs and actions to stages
			configMap := make(map[string][]models.StageReviewerConfig)
			for _, cfg := range allConfigs {
				configMap[cfg.StageID.String()] = append(configMap[cfg.StageID.String()], cfg)
			}

			actionMap := make(map[string][]models.StageAction)
			for _, action := range allActions {
				actionMap[action.StageID.String()] = append(actionMap[action.StageID.String()], action)
			}

			response.Stages = make([]StageWithDetails, len(stages))
			for i, stage := range stages {
				stageID := stage.ID.String()
				response.Stages[i] = StageWithDetails{
					ApplicationStage: stage,
					ReviewerConfigs:  configMap[stageID],
					StageActions:     actionMap[stageID],
				}
				if response.Stages[i].ReviewerConfigs == nil {
					response.Stages[i].ReviewerConfigs = []models.StageReviewerConfig{}
				}
				if response.Stages[i].StageActions == nil {
					response.Stages[i].StageActions = []models.StageAction{}
				}
			}
		}
	}

	fmt.Printf("📊 [COMBINED ENDPOINT] Total time: %v (submissions: %d, workflows: %d, stages: %d)\n",
		time.Since(startTime), len(response.Submissions), len(response.Workflows), len(response.Stages))
	c.JSON(http.StatusOK, response)
}

// Form Submission Handlers

func ListFormSubmissions(c *gin.Context) {
	formID := c.Param("id")
	fmt.Printf("Listing submissions for form: %s\n", formID)

	var rows []models.Row
	if err := database.DB.Where("table_id = ?", formID).Order("created_at DESC").Find(&rows).Error; err != nil {
		fmt.Printf("Error fetching submissions: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	fmt.Printf("Found %d submissions for form %s\n", len(rows), formID)

	c.JSON(http.StatusOK, rows)
}

// DeleteFormSubmission deletes a single form submission (row) by its ID
func DeleteFormSubmission(c *gin.Context) {
	formID := c.Param("id")
	submissionID := c.Param("submission_id")

	fmt.Printf("Deleting submission %s from form %s\n", submissionID, formID)

	// Verify the submission exists and belongs to the form
	var row models.Row
	if err := database.DB.Where("id = ? AND table_id = ?", submissionID, formID).First(&row).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Delete the submission (row)
	if err := database.DB.Delete(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete submission"})
		return
	}

	fmt.Printf("Successfully deleted submission %s\n", submissionID)
	c.JSON(http.StatusOK, gin.H{"message": "Submission deleted successfully"})
}

type SubmitFormInput struct {
	Data  map[string]interface{} `json:"data" binding:"required"`
	Email string                 `json:"email"`
}

func SubmitForm(c *gin.Context) {
	formID := c.Param("id")
	fmt.Printf("📝 SubmitForm: incoming submission for form/table %s\n", formID)

	// Verify form exists and is published
	var view models.View
	if err := database.DB.Where("table_id = ? AND type = ?", formID, "form").First(&view).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found or not configured"})
		return
	}

	var config map[string]interface{}
	json.Unmarshal(view.Config, &config)
	if val, ok := config["is_published"].(bool); !ok || !val {
		fmt.Printf("🛑 SubmitForm: form %s not published, rejecting submission\n", formID)
		c.JSON(http.StatusForbidden, gin.H{"error": "Form is not published"})
		return
	}

	var input SubmitFormInput
	if err := c.ShouldBindJSON(&input); err != nil {
		fmt.Printf("❌ SubmitForm: bad request payload for %s: %v\n", formID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data := input.Data
	if data == nil {
		data = make(map[string]interface{})
	}

	// Parse form ID
	parsedFormID := uuid.MustParse(formID)

	// Normalize data using FieldNormalizer
	normalizer := services.NewFieldNormalizer()
	normalizeResult, err := normalizer.NormalizeForStorage(services.NormalizeInput{
		TableID: parsedFormID,
		Data:    data,
	})
	if err != nil {
		fmt.Printf("❌ SubmitForm: normalization failed for %s: %v\n", formID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to normalize data: " + err.Error()})
		return
	}

	// Check for validation errors
	if len(normalizeResult.Errors) > 0 {
		fmt.Printf("⚠️ SubmitForm: validation errors for %s: %+v\n", formID, normalizeResult.Errors)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation errors",
			"details": normalizeResult.Errors,
		})
		return
	}

	// Use normalized data
	data = normalizeResult.Data

	data["_ip_address"] = c.ClientIP()
	data["_user_agent"] = c.Request.UserAgent()

	// Check for existing submission if email is present
	email := input.Email
	if email == "" {
		// Try to get email from various locations in the data
		if personal, ok := data["personal"].(map[string]interface{}); ok {
			if e, ok := personal["personalEmail"].(string); ok {
				email = e
			}
		}
		// Also check for email field at root level (dynamic forms)
		if email == "" {
			if e, ok := data["email"].(string); ok {
				email = e
			}
		}
	}

	if email != "" {
		// Always store _applicant_email at root level for reliable lookups
		data["_applicant_email"] = email

		// Also ensure email is saved in data["personal"] for backwards compatibility
		if _, ok := data["personal"]; !ok {
			data["personal"] = map[string]interface{}{
				"personalEmail": email,
			}
		} else if personal, ok := data["personal"].(map[string]interface{}); ok {
			personal["personalEmail"] = email
			data["personal"] = personal
		}

		var existingRow models.Row
		// Try multiple locations where email might be stored
		queries := []string{
			"table_id = ? AND data->>'_applicant_email' = ?",
			"table_id = ? AND data->'personal'->>'personalEmail' = ?",
			"table_id = ? AND data->>'email' = ?",
		}

		var found bool
		for _, query := range queries {
			if err := database.DB.Where(query, formID, email).First(&existingRow).Error; err == nil {
				found = true
				break
			}
		}

		if found {
			fmt.Printf("🔄 SubmitForm: existing submission found for %s (email=%s), updating row %s\n", formID, email, existingRow.ID)
			// Update existing row with transaction - create version in same transaction
			tx := database.DB.Begin()
			defer func() {
				if r := recover(); r != nil {
					tx.Rollback()
				}
			}()

			existingRow.Data = mapToJSON(data)
			existingRow.UpdatedAt = time.Now()

			// Reset status to "submitted" when applicant resubmits (e.g., after revision request)
			var existingMetadata map[string]interface{}
			if existingRow.Metadata != nil {
				json.Unmarshal(existingRow.Metadata, &existingMetadata)
			}
			if existingMetadata == nil {
				existingMetadata = make(map[string]interface{})
			}
			existingMetadata["status"] = "submitted"
			existingMetadata["resubmitted_at"] = time.Now()
			existingRow.Metadata = mapToJSON(existingMetadata)

			if err := tx.Save(&existingRow).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update submission"})
				return
			}

			// Create version for the update (synchronous, in transaction)
			versionService := services.NewVersionService()
			if _, err := versionService.CreateVersionTx(tx, services.CreateVersionInput{
				RowID:        existingRow.ID,
				TableID:      parsedFormID,
				Data:         data,
				ChangeType:   models.ChangeTypeUpdate,
				ChangeReason: "Form submission updated",
			}); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create version"})
				return
			}

			// Update portal_applicants.submission_data if this is a portal submission
			if email != "" {
				if err := tx.Exec(`
					UPDATE portal_applicants 
					SET submission_data = $1, updated_at = NOW()
					WHERE form_id = $2 AND email = $3
				`, mapToJSON(data), view.ID, email).Error; err != nil {
					// Log error but don't fail the transaction - this is optional
					c.Error(err)
				}
			}

			if err := tx.Commit().Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
				return
			}

			// Queue for embedding (async - ok to be outside transaction)
			go func() {
				database.DB.Exec(`
					INSERT INTO embedding_queue (entity_id, entity_type, priority, status)
					VALUES ($1, 'submission', 5, 'pending')
					ON CONFLICT (entity_id, entity_type) 
					DO UPDATE SET priority = 5, status = 'pending', created_at = NOW()
				`, existingRow.ID)
			}()

			fmt.Printf("✅ SubmitForm: updated submission row %s for form %s\n", existingRow.ID, formID)
			c.JSON(http.StatusOK, existingRow)
			return
		}
	}

	// Create new row with transaction
	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	row := models.Row{
		TableID: parsedFormID,
		Data:    mapToJSON(data),
	}

	// Add user ID if authenticated (optional for forms)
	var userID *uuid.UUID
	if userIDStr, exists := middleware.GetUserID(c); exists {
		if parsedUserID, err := uuid.Parse(userIDStr); err == nil {
			row.CreatedBy = &parsedUserID
			userID = &parsedUserID
		}
	}

	if err := tx.Create(&row).Error; err != nil {
		fmt.Printf("❌ SubmitForm: failed to create row for %s: %v\n", formID, err)
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create initial version for version history (synchronous, in transaction)
	versionService := services.NewVersionService()
	if _, err := versionService.CreateVersionTx(tx, services.CreateVersionInput{
		RowID:        row.ID,
		TableID:      parsedFormID,
		Data:         data,
		ChangeType:   models.ChangeTypeCreate,
		ChangeReason: "Initial submission from portal",
		ChangedBy:    userID,
	}); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create version"})
		return
	}

	// Update portal_applicants.submission_data if this is a portal submission
	if email != "" {
		if err := tx.Exec(`
			UPDATE portal_applicants 
			SET submission_data = $1, updated_at = NOW()
			WHERE form_id = $2 AND email = $3
		`, mapToJSON(data), view.ID, email).Error; err != nil {
			// Log error but don't fail the transaction - this is optional
			c.Error(err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	// Queue submission for semantic embedding (async - ok to be outside transaction)
	go func() {
		database.DB.Exec(`
			INSERT INTO embedding_queue (entity_id, entity_type, priority, status)
			VALUES ($1, 'submission', 5, 'pending')
			ON CONFLICT (entity_id, entity_type) 
			DO UPDATE SET priority = 5, status = 'pending', created_at = NOW()
		`, row.ID)
	}()

	fmt.Printf("✅ SubmitForm: created new submission row %s for form %s\n", row.ID, formID)
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
	Width       interface{}            `json:"width"` // Can be string ("full", "half") or number
	Children    []FieldInput           `json:"children"`
	Validation  map[string]interface{} `json:"validation"`
	Config      map[string]interface{} `json:"config"` // Additional config like dynamicOptions, sourceField, etc.
}

type SectionInput struct {
	ID          string                   `json:"id"`
	Title       string                   `json:"title"`
	Description string                   `json:"description"`
	SectionType string                   `json:"sectionType"`
	Fields      []FieldInput             `json:"fields"`
	Conditions  []map[string]interface{} `json:"conditions"`
}

type UpdateFormStructureInput struct {
	Settings     map[string]interface{} `json:"settings"`
	Sections     []SectionInput         `json:"sections"`
	Translations map[string]interface{} `json:"translations"`
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

	// DEBUG: Log received translations
	if input.Translations != nil {
		fmt.Printf("📝 UpdateFormStructure: Received %d translation languages\n", len(input.Translations))
	} else {
		fmt.Println("⚠️ UpdateFormStructure: No translations received in input")
	}

	// Start transaction
	tx := database.DB.Begin()

	// Update form settings
	// We also want to store the section structure (without fields) in settings
	// so we can reconstruct the sections on load.

	// MERGE: Load existing settings first to preserve keys not sent by frontend (e.g. reviewers)
	var settings map[string]interface{}
	if len(table.Settings) > 0 {
		// Handle potential error or just ignore if malformed
		_ = json.Unmarshal(table.Settings, &settings)
	}
	if settings == nil {
		settings = make(map[string]interface{})
	}

	// Merge input settings into existing settings
	if input.Settings != nil {
		for k, v := range input.Settings {
			settings[k] = v
		}
	}

	var sectionMeta []map[string]interface{}
	for _, s := range input.Sections {
		sectionMeta = append(sectionMeta, map[string]interface{}{
			"id":          s.ID,
			"title":       s.Title,
			"description": s.Description,
			"sectionType": s.SectionType,
			"conditions":  s.Conditions,
		})
	}
	settings["sections"] = sectionMeta

	// Save translations if present
	if input.Translations != nil {
		settings["translations"] = input.Translations
	}

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
			// DEBUG: Log what we received from frontend
			fmt.Printf("📥 Field received: type=%s, label=%s, config=%+v\n", fieldInput.Type, fieldInput.Label, fieldInput.Config)

			// Construct config JSON - start with any config from the frontend
			config := make(map[string]interface{})
			if fieldInput.Config != nil {
				for k, v := range fieldInput.Config {
					config[k] = v
				}
			}

			// Override/add specific fields
			if len(fieldInput.Options) > 0 {
				config["items"] = fieldInput.Options
			}
			// Handle width (can be string or number)
			if fieldInput.Width != nil && fieldInput.Width != "" {
				switch w := fieldInput.Width.(type) {
				case string:
					if w != "" {
						config["width"] = w
					}
				case float64:
					// Convert number to string width name if needed
					config["width"] = fmt.Sprintf("%.0f", w)
				default:
					config["width"] = fmt.Sprintf("%v", w)
				}
			}
			config["section_id"] = section.ID
			config["is_required"] = fieldInput.IsRequired
			if fieldInput.Placeholder != "" {
				config["placeholder"] = fieldInput.Placeholder
			}

			if len(fieldInput.Validation) > 0 {
				config["validation"] = fieldInput.Validation
			}

			// Handle children for groups/repeaters
			if len(fieldInput.Children) > 0 {
				config["children"] = fieldInput.Children
			}

			// Get field_type_id from registry (use type as ID, they should match)
			fieldTypeID := GetDefaultFieldTypeID(fieldInput.Type)

			// Generate a clean name from label (snake_case)
			fieldName := toSnakeCase(fieldInput.Label)
			if fieldName == "" {
				fieldName = "field_" + fieldInput.ID[:8]
			}

			field := models.Field{
				TableID:     table.ID,
				Label:       fieldInput.Label,
				Name:        fieldName,
				Type:        fieldInput.Type,
				FieldTypeID: fieldTypeID, // Link to field_type_registry
				Position:    position,
				Config:      mapToJSON(config),
			}

			// DEBUG: Log what we're saving
			fmt.Printf("💾 Saving field: type=%s, label=%s, config=%s\n", field.Type, field.Label, string(mapToJSON(config)))

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

	// Try multiple locations where email might be stored:
	// 1. data->'personal'->>'personalEmail' (static forms)
	// 2. data->>'_applicant_email' (dynamic forms - new field)
	// 3. data->>'email' (dynamic forms - field named email)
	// 4. data->>'Personal Email' (dynamic forms - field named Personal Email)
	// 5. data->>'CPS email' (dynamic forms - field named CPS email)
	// 6. data->>'personalEmail' (dynamic forms - camelCase variant)
	queries := []string{
		"table_id = ? AND data->'personal'->>'personalEmail' = ?",
		"table_id = ? AND data->>'_applicant_email' = ?",
		"table_id = ? AND data->>'email' = ?",
		"table_id = ? AND data->>'Personal Email' = ?",
		"table_id = ? AND data->>'CPS email' = ?",
		"table_id = ? AND data->>'personalEmail' = ?",
		"table_id = ? AND LOWER(data->>'email') = LOWER(?)",
		"table_id = ? AND LOWER(data->>'Personal Email') = LOWER(?)",
		"table_id = ? AND LOWER(data->>'CPS email') = LOWER(?)",
	}

	var found bool
	for _, query := range queries {
		if err := database.DB.Where(query, formID, email).First(&row).Error; err == nil {
			found = true
			break
		}
	}

	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	var data map[string]interface{}
	json.Unmarshal(row.Data, &data)

	var metadata map[string]interface{}
	json.Unmarshal(row.Metadata, &metadata)

	// Return full row info including ID for activity feed integration
	c.JSON(http.StatusOK, gin.H{
		"id":         row.ID,
		"data":       data,
		"metadata":   metadata,
		"created_at": row.CreatedAt,
		"updated_at": row.UpdatedAt,
	})
}

// External Review Handlers

type ExternalReviewDTO struct {
	Form        FormDTO                     `json:"form"`
	Submissions []models.Row                `json:"submissions"`
	Reviewer    map[string]interface{}      `json:"reviewer,omitempty"`
	StageConfig *models.StageReviewerConfig `json:"stage_config,omitempty"`
	Rubric      *models.Rubric              `json:"rubric,omitempty"`
	Stage       *models.ApplicationStage    `json:"stage,omitempty"` // ApplicationStage with custom_statuses, custom_tags
}

func GetExternalReviewData(c *gin.Context) {
	token := c.Param("token")

	// Find form with this review token in settings
	// Check both the single 'review_token' field (legacy) and the 'reviewers' array
	var table models.Table
	var reviewerID string
	var reviewerInfo map[string]interface{}
	var reviewerTypeID string

	// Try finding in reviewers array first
	if err := database.DB.Where("settings->'reviewers' @> ?", fmt.Sprintf(`[{"token": "%s"}]`, token)).First(&table).Error; err == nil {
		// Found in reviewers array, extract ID and reviewer_type_id
		var settings map[string]interface{}
		if err := json.Unmarshal(table.Settings, &settings); err == nil {
			if reviewers, ok := settings["reviewers"].([]interface{}); ok {
				for _, r := range reviewers {
					if rMap, ok := r.(map[string]interface{}); ok {
						if t, ok := rMap["token"].(string); ok && t == token {
							reviewerInfo = rMap
							if id, ok := rMap["id"].(string); ok {
								reviewerID = id
							}
							if typeID, ok := rMap["reviewer_type_id"].(string); ok {
								reviewerTypeID = typeID
							}
							break
						}
					}
				}
			}
		}
	} else if err := database.DB.Where("settings->>'review_token' = ?", token).First(&table).Error; err != nil {
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
	query := database.DB.Where("table_id = ?", table.ID)

	// If we have a specific reviewer ID, filter by assignment
	if reviewerID != "" {
		// Check if metadata->'assigned_reviewers' contains reviewerID
		// Postgres JSONB operator: @>
		// We need to construct a JSON array string: '["reviewerID"]'
		query = query.Where("metadata->'assigned_reviewers' @> ?", fmt.Sprintf(`["%s"]`, reviewerID))
	}

	if err := query.Order("created_at DESC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Build response
	response := ExternalReviewDTO{
		Form:        formDTO,
		Submissions: rows,
		Reviewer:    reviewerInfo,
	}

	// If we have a reviewer_type_id, try to find the stage config
	// NEW: Also check for stage_assignments for stage-specific roles
	var stageAssignments []map[string]interface{}
	if reviewerInfo != nil {
		if sa, ok := reviewerInfo["stage_assignments"].([]interface{}); ok {
			for _, a := range sa {
				if aMap, ok := a.(map[string]interface{}); ok {
					stageAssignments = append(stageAssignments, aMap)
				}
			}
		}
	}

	// Helper function to find reviewer's role for a given stage
	findRoleForStage := func(stageID string) string {
		for _, assignment := range stageAssignments {
			if sid, ok := assignment["stage_id"].(string); ok && sid == stageID {
				if rtID, ok := assignment["reviewer_type_id"].(string); ok {
					return rtID
				}
			}
		}
		return reviewerTypeID // fallback to primary role
	}

	if reviewerTypeID != "" || len(stageAssignments) > 0 {
		// If we have stage assignments, we'll determine the rubric per stage
		// For now, we get the config for the primary role or first assignment
		effectiveReviewerTypeID := reviewerTypeID
		if effectiveReviewerTypeID == "" && len(stageAssignments) > 0 {
			if rtID, ok := stageAssignments[0]["reviewer_type_id"].(string); ok {
				effectiveReviewerTypeID = rtID
			}
		}

		var stageConfigs []models.StageReviewerConfig
		if err := database.DB.Where("reviewer_type_id = ?", effectiveReviewerTypeID).Find(&stageConfigs).Error; err == nil && len(stageConfigs) > 0 {
			// Use the first matching config (typically one stage per reviewer type)
			response.StageConfig = &stageConfigs[0]

			// Fetch the ApplicationStage for custom_statuses, custom_tags, logic_rules
			var stage models.ApplicationStage
			if err := database.DB.First(&stage, "id = ?", stageConfigs[0].StageID).Error; err == nil {
				response.Stage = &stage

				// Now check if reviewer has a different role for this specific stage
				stageSpecificRole := findRoleForStage(stage.ID.String())
				if stageSpecificRole != "" && stageSpecificRole != effectiveReviewerTypeID {
					// Find the stage config for this specific role on this stage
					var specificConfig models.StageReviewerConfig
					if err := database.DB.Where("stage_id = ? AND reviewer_type_id = ?", stage.ID, stageSpecificRole).First(&specificConfig).Error; err == nil {
						response.StageConfig = &specificConfig
					}
				}
			}

			// If the stage config has an assigned rubric, fetch it
			// Priority: AssignedRubricID > RubricID > Workflow DefaultRubricID
			rubricID := response.StageConfig.AssignedRubricID
			if rubricID == nil {
				rubricID = response.StageConfig.RubricID
			}

			// Fall back to workflow's default rubric if no stage-specific rubric
			if rubricID == nil && response.Stage != nil && response.Stage.ReviewWorkflowID != uuid.Nil {
				var workflow models.ReviewWorkflow
				if err := database.DB.First(&workflow, "id = ?", response.Stage.ReviewWorkflowID).Error; err == nil {
					rubricID = workflow.DefaultRubricID
				}
			}

			if rubricID != nil {
				var rubric models.Rubric
				if err := database.DB.First(&rubric, "id = ?", rubricID).Error; err == nil {
					response.Rubric = &rubric
				}
			}
		}
	}

	// Fallback: if no rubric found yet, try to get default rubric from any workflow in this workspace
	if response.Rubric == nil {
		var workflows []models.ReviewWorkflow
		if err := database.DB.Where("workspace_id = ?", table.WorkspaceID).Find(&workflows).Error; err == nil {
			for _, wf := range workflows {
				if wf.DefaultRubricID != nil {
					var rubric models.Rubric
					if err := database.DB.First(&rubric, "id = ?", wf.DefaultRubricID).Error; err == nil {
						response.Rubric = &rubric
						// Also try to get the first stage if we don't have one
						if response.Stage == nil {
							var stage models.ApplicationStage
							if err := database.DB.Where("review_workflow_id = ?", wf.ID).Order("order_index ASC").First(&stage).Error; err == nil {
								response.Stage = &stage
							}
						}
						break
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, response)
}

type AssignReviewerInput struct {
	Strategy       string   `json:"strategy"` // 'random' or 'manual'
	Count          int      `json:"count"`
	SubmissionIDs  []string `json:"submission_ids"`
	OnlyUnassigned bool     `json:"only_unassigned"`  // Only assign applications not assigned to ANY reviewer
	ReviewerTypeID string   `json:"reviewer_type_id"` // Optional reviewer type for context
	ReviewerName   string   `json:"reviewer_name"`    // Optional reviewer name for embedding in metadata
	ReviewerEmail  string   `json:"reviewer_email"`   // Optional reviewer email
}

func AssignReviewerApplications(c *gin.Context) {
	formID := c.Param("id")
	reviewerID := c.Param("reviewer_id")

	var input AssignReviewerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify form exists
	var table models.Table
	if err := database.DB.First(&table, "id = ?", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	var rowsToAssign []models.Row

	if input.Strategy == "manual" {
		if len(input.SubmissionIDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No submissions selected"})
			return
		}
		if err := database.DB.Where("table_id = ? AND id IN ?", formID, input.SubmissionIDs).Find(&rowsToAssign).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else if input.Strategy == "random" {
		if input.Count <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Count must be greater than 0"})
			return
		}
		// Find rows that are NOT already assigned to this reviewer
		// If only_unassigned is true, also exclude rows assigned to ANY reviewer
		query := database.DB.Where("table_id = ?", formID)

		if input.OnlyUnassigned {
			// Only truly unassigned applications (no assigned_reviewers or empty array)
			query = query.Where("(metadata->'assigned_reviewers' IS NULL OR metadata->>'assigned_reviewers' = '[]' OR metadata->>'assigned_reviewers' = 'null')")
		} else {
			// Just not assigned to this specific reviewer
			query = query.Where("(metadata->'assigned_reviewers' IS NULL OR NOT (metadata->'assigned_reviewers' @> ?))",
				fmt.Sprintf(`["%s"]`, reviewerID))
		}

		if err := query.Order("RANDOM()").Limit(input.Count).Find(&rowsToAssign).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid strategy"})
		return
	}

	// Try to find workflow and stage info from reviewer_type_id
	var workflowID, stageID, stageName string
	if input.ReviewerTypeID != "" {
		var stageConfig models.StageReviewerConfig
		if err := database.DB.Where("reviewer_type_id = ?", input.ReviewerTypeID).First(&stageConfig).Error; err == nil {
			stageID = stageConfig.StageID.String()
			// Get stage name
			var stage models.ApplicationStage
			if err := database.DB.First(&stage, "id = ?", stageConfig.StageID).Error; err == nil {
				stageName = stage.Name
				workflowID = stage.ReviewWorkflowID.String()
			}
		}
	}

	// Update rows
	count := 0
	for _, row := range rowsToAssign {
		var metadata map[string]interface{}
		if len(row.Metadata) > 0 {
			json.Unmarshal(row.Metadata, &metadata)
		} else {
			metadata = make(map[string]interface{})
		}

		var assignedReviewers []string
		if val, ok := metadata["assigned_reviewers"].([]interface{}); ok {
			for _, v := range val {
				if s, ok := v.(string); ok {
					assignedReviewers = append(assignedReviewers, s)
				}
			}
		}

		// Check if already assigned (shouldn't happen for random due to query, but good for manual)
		exists := false
		for _, id := range assignedReviewers {
			if id == reviewerID {
				exists = true
				break
			}
		}

		if !exists {
			assignedReviewers = append(assignedReviewers, reviewerID)
			metadata["assigned_reviewers"] = assignedReviewers

			// Store reviewer info in metadata for easy lookup
			// This helps the frontend display reviewer names without needing form.settings
			if input.ReviewerName != "" {
				reviewerInfoMap := make(map[string]interface{})
				if existing, ok := metadata["reviewer_info"].(map[string]interface{}); ok {
					reviewerInfoMap = existing
				}
				reviewerInfoMap[reviewerID] = map[string]interface{}{
					"name":  input.ReviewerName,
					"email": input.ReviewerEmail,
				}
				metadata["reviewer_info"] = reviewerInfoMap
			}

			// Set workflow and stage if we found them and not already set
			if workflowID != "" && metadata["assigned_workflow_id"] == nil {
				metadata["assigned_workflow_id"] = workflowID
			}
			if stageID != "" && metadata["current_stage_id"] == nil {
				metadata["current_stage_id"] = stageID
				metadata["stage_name"] = stageName
			}

			row.Metadata = mapToJSON(metadata)
			database.DB.Save(&row)
			count++
		}
	}

	// Update reviewer stats
	var settings map[string]interface{}
	if err := json.Unmarshal(table.Settings, &settings); err == nil {
		if reviewers, ok := settings["reviewers"].([]interface{}); ok {
			updated := false
			for i, r := range reviewers {
				if rMap, ok := r.(map[string]interface{}); ok {
					if id, ok := rMap["id"].(string); ok && id == reviewerID {
						// Update assigned count
						currentAssigned := 0.0
						if val, ok := rMap["assignedCount"].(float64); ok {
							currentAssigned = val
						}
						rMap["assignedCount"] = currentAssigned + float64(count)
						reviewers[i] = rMap
						updated = true
						break
					}
				}
			}
			if updated {
				settings["reviewers"] = reviewers
				table.Settings = mapToJSON(settings)
				database.DB.Save(&table)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Applications assigned", "count": count})
}

type SubmitReviewInput struct {
	Scores          map[string]int    `json:"scores"`
	Notes           map[string]string `json:"notes"`
	Comments        map[string]string `json:"comments"`
	OverallComments string            `json:"overall_comments"`
	Status          string            `json:"status"` // 'approved', 'rejected', 'reviewed', or custom status
	Tags            []string          `json:"tags"`
	IsDraft         bool              `json:"is_draft"`
}

// LogicRules represents the parsed logic rules from ApplicationStage
type LogicRules struct {
	AutoAdvanceCondition string `json:"auto_advance_condition"` // e.g., "if average_score >= 80 then advance to Stage 2"
	AutoRejectCondition  string `json:"auto_reject_condition"`  // e.g., "if average_score < 40 then reject"
	VisibilityRules      string `json:"visibility_rules"`       // e.g., "[High Priority, Needs Review]"
}

// WorkflowActionResult represents the outcome of logic rule evaluation
type WorkflowActionResult struct {
	ShouldAdvance bool   `json:"should_advance"`
	ShouldReject  bool   `json:"should_reject"`
	NextStageID   string `json:"next_stage_id,omitempty"`
	NextStageName string `json:"next_stage_name,omitempty"`
	ActionTaken   string `json:"action_taken"`
	ConditionMet  string `json:"condition_met"`
}

// EvaluateWorkflowLogic checks logic rules and determines if auto-actions should be taken
func EvaluateWorkflowLogic(metadata map[string]interface{}, stageID string, reviewerTypeID string) (*WorkflowActionResult, error) {
	result := &WorkflowActionResult{}

	// Get the stage config
	var stageConfig models.StageReviewerConfig
	if err := database.DB.Where("stage_id = ? AND reviewer_type_id = ?", stageID, reviewerTypeID).First(&stageConfig).Error; err != nil {
		// No config for this stage/reviewer type, try just stage_id
		if err := database.DB.Where("stage_id = ?", stageID).First(&stageConfig).Error; err != nil {
			return result, nil // No config found, no auto-action
		}
	}

	// Get the ApplicationStage for logic_rules
	var stage models.ApplicationStage
	if err := database.DB.First(&stage, "id = ?", stageID).Error; err != nil {
		return result, nil
	}

	// Parse logic rules
	var logicRules LogicRules
	if len(stage.LogicRules) > 0 {
		if err := json.Unmarshal(stage.LogicRules, &logicRules); err != nil {
			return result, nil
		}
	}

	// Extract scores from metadata
	var averageScore float64
	var totalScore float64
	var reviewCount int

	if reviewHistory, ok := metadata["review_history"].([]interface{}); ok && len(reviewHistory) > 0 {
		reviewCount = len(reviewHistory)
		for _, review := range reviewHistory {
			if reviewMap, ok := review.(map[string]interface{}); ok {
				if ts, ok := reviewMap["total_score"].(float64); ok {
					totalScore += ts
				} else if ts, ok := reviewMap["total_score"].(int); ok {
					totalScore += float64(ts)
				}
			}
		}
		if reviewCount > 0 {
			averageScore = totalScore / float64(reviewCount)
		}
	}

	// Check minimum reviews required
	minReviewsRequired := stageConfig.MinReviewsRequired
	if minReviewsRequired == 0 {
		minReviewsRequired = 1 // Default to at least 1 review
	}

	if reviewCount < minReviewsRequired {
		result.ActionTaken = "waiting_for_reviews"
		return result, nil // Not enough reviews yet
	}

	// Evaluate auto_advance_condition
	if logicRules.AutoAdvanceCondition != "" {
		conditionMet, nextStageName := evaluateCondition(logicRules.AutoAdvanceCondition, averageScore, totalScore)
		if conditionMet {
			result.ShouldAdvance = true
			result.NextStageName = nextStageName
			result.ActionTaken = "auto_advanced"
			result.ConditionMet = logicRules.AutoAdvanceCondition

			// Find next stage in the workflow
			var workflow models.ReviewWorkflow
			if err := database.DB.First(&workflow, "id = ?", stage.ReviewWorkflowID).Error; err == nil {
				var stages []models.ApplicationStage
				if err := database.DB.Where("review_workflow_id = ?", workflow.ID).Order("order_index ASC").Find(&stages).Error; err == nil {
					for i, s := range stages {
						if s.ID == stage.ID && i+1 < len(stages) {
							result.NextStageID = stages[i+1].ID.String()
							result.NextStageName = stages[i+1].Name
							break
						}
						// Or if matching by name
						if nextStageName != "" && strings.Contains(strings.ToLower(s.Name), strings.ToLower(nextStageName)) {
							result.NextStageID = s.ID.String()
							result.NextStageName = s.Name
							break
						}
					}
				}
			}
			return result, nil
		}
	}

	// Evaluate auto_reject_condition
	if logicRules.AutoRejectCondition != "" {
		conditionMet, _ := evaluateCondition(logicRules.AutoRejectCondition, averageScore, totalScore)
		if conditionMet {
			result.ShouldReject = true
			result.ActionTaken = "auto_rejected"
			result.ConditionMet = logicRules.AutoRejectCondition
			return result, nil
		}
	}

	result.ActionTaken = "none"
	return result, nil
}

// evaluateCondition parses and evaluates a condition string like "if average_score >= 80 then advance to Stage 2"
func evaluateCondition(condition string, averageScore, totalScore float64) (bool, string) {
	// Parse condition: "if <metric> <operator> <value> then <action> [to <target>]"
	re := regexp.MustCompile(`(?i)if\s+(\w+)\s*(>=|<=|>|<|==|!=)\s*(\d+(?:\.\d+)?)\s+then\s+(.+)`)
	matches := re.FindStringSubmatch(condition)

	if len(matches) < 5 {
		return false, ""
	}

	metric := strings.ToLower(matches[1])
	operator := matches[2]
	valueStr := matches[3]
	action := matches[4]

	value, err := strconv.ParseFloat(valueStr, 64)
	if err != nil {
		return false, ""
	}

	// Get the metric value
	var metricValue float64
	switch metric {
	case "average_score", "avg_score", "avg":
		metricValue = averageScore
	case "total_score", "total":
		metricValue = totalScore
	default:
		return false, ""
	}

	// Evaluate the condition
	var conditionMet bool
	switch operator {
	case ">=":
		conditionMet = metricValue >= value
	case "<=":
		conditionMet = metricValue <= value
	case ">":
		conditionMet = metricValue > value
	case "<":
		conditionMet = metricValue < value
	case "==":
		conditionMet = metricValue == value
	case "!=":
		conditionMet = metricValue != value
	}

	// Extract target stage name if present
	targetStage := ""
	targetRe := regexp.MustCompile(`(?i)advance\s+to\s+(.+)`)
	if targetMatches := targetRe.FindStringSubmatch(action); len(targetMatches) > 1 {
		targetStage = strings.TrimSpace(targetMatches[1])
	}

	return conditionMet, targetStage
}

// ApplyWorkflowAction applies the result of logic evaluation to the submission
func ApplyWorkflowAction(row *models.Row, metadata map[string]interface{}, result *WorkflowActionResult) error {
	if result.ShouldAdvance && result.NextStageID != "" {
		// Update stage_id in metadata
		metadata["stage_id"] = result.NextStageID
		metadata["stage_name"] = result.NextStageName

		// Track stage history
		stageHistory := []interface{}{}
		if existingHistory, ok := metadata["stage_history"].([]interface{}); ok {
			stageHistory = existingHistory
		}
		stageHistory = append(stageHistory, map[string]interface{}{
			"from_stage": metadata["current_stage_id"],
			"to_stage":   result.NextStageID,
			"action":     "auto_advanced",
			"condition":  result.ConditionMet,
			"timestamp":  time.Now(),
		})
		metadata["stage_history"] = stageHistory
		metadata["current_stage_id"] = result.NextStageID
		metadata["workflow_action"] = "auto_advanced"
	}

	if result.ShouldReject {
		metadata["status"] = "rejected"
		metadata["rejected_at"] = time.Now()
		metadata["rejection_reason"] = "auto_rejected"
		metadata["workflow_action"] = "auto_rejected"
		metadata["workflow_condition"] = result.ConditionMet

		// Track in stage history
		stageHistory := []interface{}{}
		if existingHistory, ok := metadata["stage_history"].([]interface{}); ok {
			stageHistory = existingHistory
		}
		stageHistory = append(stageHistory, map[string]interface{}{
			"action":    "auto_rejected",
			"condition": result.ConditionMet,
			"timestamp": time.Now(),
		})
		metadata["stage_history"] = stageHistory
	}

	row.Metadata = mapToJSON(metadata)
	return database.DB.Save(row).Error
}

func SubmitExternalReview(c *gin.Context) {
	token := c.Param("token")
	submissionID := c.Param("submission_id")

	// Verify token and get reviewer info
	var table models.Table
	var reviewerName = "External Reviewer"
	var reviewerID string

	// Try finding in reviewers array first
	if err := database.DB.Where("settings->'reviewers' @> ?", fmt.Sprintf(`[{"token": "%s"}]`, token)).First(&table).Error; err == nil {
		// Found in reviewers array, extract name
		var settings map[string]interface{}
		if err := json.Unmarshal(table.Settings, &settings); err == nil {
			if reviewers, ok := settings["reviewers"].([]interface{}); ok {
				for _, r := range reviewers {
					if rMap, ok := r.(map[string]interface{}); ok {
						if t, ok := rMap["token"].(string); ok && t == token {
							if name, ok := rMap["name"].(string); ok {
								reviewerName = name
							}
							if id, ok := rMap["id"].(string); ok {
								reviewerID = id
							}
							break
						}
					}
				}
			}
		}
	} else if err := database.DB.Where("settings->>'review_token' = ?", token).First(&table).Error; err != nil {
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
		"scores":           input.Scores,
		"notes":            input.Notes,
		"comments":         input.Comments,
		"overall_comments": input.OverallComments,
		"status":           input.Status,
		"tags":             input.Tags,
		"is_draft":         input.IsDraft,
		"reviewed_at":      time.Now(),
		"reviewer":         reviewerName,
		"reviewer_id":      reviewerID,
	}

	// Calculate total score
	totalScore := 0
	for _, v := range input.Scores {
		totalScore += v
	}
	reviewData["total_score"] = totalScore

	// Append to reviews array or overwrite? Let's overwrite for single reviewer for now,
	// or append if we want multiple.
	metadata["review"] = reviewData

	// Update status if provided and not a draft
	if input.Status != "" && !input.IsDraft {
		metadata["status"] = input.Status
		metadata["reviewed_at"] = time.Now()
	}

	// Store tags at metadata level for filtering
	if len(input.Tags) > 0 {
		metadata["tags"] = input.Tags
	}

	// Track review history (for multi-reviewer scenarios and prior reviews)
	reviewHistoryEntry := map[string]interface{}{
		"reviewer_id":      reviewerID,
		"reviewer_name":    reviewerName,
		"scores":           input.Scores,
		"notes":            input.Notes,
		"total_score":      totalScore,
		"overall_comments": input.OverallComments,
		"submitted_at":     time.Now(),
		"is_draft":         input.IsDraft,
	}

	reviewHistory := []interface{}{}
	if existingHistory, ok := metadata["review_history"].([]interface{}); ok {
		// Check if this reviewer already has an entry and update it
		found := false
		for i, entry := range existingHistory {
			if entryMap, ok := entry.(map[string]interface{}); ok {
				if entryReviewerID, ok := entryMap["reviewer_id"].(string); ok && entryReviewerID == reviewerID {
					existingHistory[i] = reviewHistoryEntry
					found = true
					break
				}
			}
		}
		if !found {
			existingHistory = append(existingHistory, reviewHistoryEntry)
		}
		reviewHistory = existingHistory
	} else {
		reviewHistory = append(reviewHistory, reviewHistoryEntry)
	}
	metadata["review_history"] = reviewHistory

	row.Metadata = mapToJSON(metadata)

	if err := database.DB.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Evaluate workflow logic rules if this is not a draft
	if !input.IsDraft {
		// Get stage_id from metadata or find from reviewer_type_id
		stageID := ""
		if sid, ok := metadata["stage_id"].(string); ok {
			stageID = sid
		} else if sid, ok := metadata["current_stage_id"].(string); ok {
			stageID = sid
		}

		// If we don't have a stage_id, try to find it from the reviewer's config
		reviewerTypeID := ""
		var settings map[string]interface{}
		if err := json.Unmarshal(table.Settings, &settings); err == nil {
			if reviewers, ok := settings["reviewers"].([]interface{}); ok {
				for _, r := range reviewers {
					if rMap, ok := r.(map[string]interface{}); ok {
						if id, ok := rMap["id"].(string); ok && id == reviewerID {
							if rtID, ok := rMap["reviewer_type_id"].(string); ok {
								reviewerTypeID = rtID
							}
							break
						}
					}
				}
			}
		}

		// Find stage from reviewer_type_id if we don't have it
		if stageID == "" && reviewerTypeID != "" {
			var stageConfig models.StageReviewerConfig
			if err := database.DB.Where("reviewer_type_id = ?", reviewerTypeID).First(&stageConfig).Error; err == nil {
				stageID = stageConfig.StageID.String()
			}
		}

		// Evaluate and apply workflow logic
		if stageID != "" {
			workflowResult, err := EvaluateWorkflowLogic(metadata, stageID, reviewerTypeID)
			if err == nil && (workflowResult.ShouldAdvance || workflowResult.ShouldReject) {
				// Re-parse metadata since we saved the row
				json.Unmarshal(row.Metadata, &metadata)
				if err := ApplyWorkflowAction(&row, metadata, workflowResult); err != nil {
					// Log error but don't fail the request
					fmt.Printf("Failed to apply workflow action: %v\n", err)
				}
			}
		}
	}

	// Update reviewer stats in table settings (only for non-draft submissions)
	if reviewerID != "" && !input.IsDraft {
		var settings map[string]interface{}
		if err := json.Unmarshal(table.Settings, &settings); err == nil {
			if reviewers, ok := settings["reviewers"].([]interface{}); ok {
				updated := false
				for i, r := range reviewers {
					if rMap, ok := r.(map[string]interface{}); ok {
						if id, ok := rMap["id"].(string); ok && id == reviewerID {
							// Increment completed count
							if count, ok := rMap["completedCount"].(float64); ok {
								rMap["completedCount"] = count + 1
							} else {
								rMap["completedCount"] = 1
							}
							rMap["lastActive"] = "Just now"
							reviewers[i] = rMap
							updated = true
							break
						}
					}
				}
				if updated {
					settings["reviewers"] = reviewers
					table.Settings = mapToJSON(settings)
					database.DB.Save(&table)
				}
			}
		}
	}

	c.JSON(http.StatusOK, row)
}

// ========== Workflow Assignment Handlers ==========

type AssignWorkflowInput struct {
	WorkflowID string `json:"workflow_id"`
	StageID    string `json:"stage_id"`
}

// AssignSubmissionWorkflow assigns a submission to a specific workflow and stage
func AssignSubmissionWorkflow(c *gin.Context) {
	formID := c.Param("id")
	submissionID := c.Param("submission_id")

	var input AssignWorkflowInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find the submission (row)
	var row models.Row
	if err := database.DB.Where("table_id = ? AND id = ?", formID, submissionID).First(&row).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Get or create metadata
	var metadata map[string]interface{}
	if len(row.Metadata) > 0 {
		json.Unmarshal(row.Metadata, &metadata)
	} else {
		metadata = make(map[string]interface{})
	}

	// Update workflow assignment
	metadata["assigned_workflow_id"] = input.WorkflowID
	metadata["current_stage_id"] = input.StageID
	metadata["workflow_assigned_at"] = time.Now()

	// Initialize review tracking if not exists
	if _, ok := metadata["stage_history"]; !ok {
		metadata["stage_history"] = []map[string]interface{}{}
	}

	// Add to stage history
	stageHistory := metadata["stage_history"].([]map[string]interface{})
	stageHistory = append(stageHistory, map[string]interface{}{
		"stage_id":   input.StageID,
		"entered_at": time.Now(),
		"action":     "assigned",
	})
	metadata["stage_history"] = stageHistory

	row.Metadata = mapToJSON(metadata)

	if err := database.DB.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, row)
}

type MoveToStageInput struct {
	StageID string `json:"stage_id"`
	Reason  string `json:"reason,omitempty"`
}

// MoveSubmissionToStage moves a submission to a different stage
func MoveSubmissionToStage(c *gin.Context) {
	formID := c.Param("id")
	submissionID := c.Param("submission_id")

	var input MoveToStageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find the submission
	var row models.Row
	if err := database.DB.Where("table_id = ? AND id = ?", formID, submissionID).First(&row).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Get metadata
	var metadata map[string]interface{}
	if len(row.Metadata) > 0 {
		json.Unmarshal(row.Metadata, &metadata)
	} else {
		metadata = make(map[string]interface{})
	}

	// Get previous stage for history
	previousStageID := ""
	if val, ok := metadata["current_stage_id"].(string); ok {
		previousStageID = val
	}

	// Update current stage
	metadata["current_stage_id"] = input.StageID
	metadata["stage_updated_at"] = time.Now()

	// Get or create stage history
	var stageHistory []interface{}
	if val, ok := metadata["stage_history"].([]interface{}); ok {
		stageHistory = val
	} else {
		stageHistory = []interface{}{}
	}

	// Add to history
	historyEntry := map[string]interface{}{
		"from_stage_id": previousStageID,
		"to_stage_id":   input.StageID,
		"moved_at":      time.Now(),
		"reason":        input.Reason,
	}
	stageHistory = append(stageHistory, historyEntry)
	metadata["stage_history"] = stageHistory

	row.Metadata = mapToJSON(metadata)

	if err := database.DB.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, row)
}

type UpdateReviewDataInput struct {
	Scores       map[string]interface{} `json:"scores,omitempty"`
	Comments     string                 `json:"comments,omitempty"`
	Status       string                 `json:"status,omitempty"`
	Tags         []string               `json:"tags,omitempty"`
	Flagged      bool                   `json:"flagged,omitempty"`
	Decision     string                 `json:"decision,omitempty"`
	ReviewerID   string                 `json:"reviewer_id,omitempty"`
	ReviewerName string                 `json:"reviewer_name,omitempty"`
}

// UpdateSubmissionReviewData updates the review data for a submission
func UpdateSubmissionReviewData(c *gin.Context) {
	formID := c.Param("id")
	submissionID := c.Param("submission_id")

	var input UpdateReviewDataInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find the submission
	var row models.Row
	if err := database.DB.Where("table_id = ? AND id = ?", formID, submissionID).First(&row).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Get metadata
	var metadata map[string]interface{}
	if len(row.Metadata) > 0 {
		json.Unmarshal(row.Metadata, &metadata)
	} else {
		metadata = make(map[string]interface{})
	}

	// Update review data
	if input.Scores != nil {
		metadata["scores"] = input.Scores
		// Calculate total score
		totalScore := 0.0
		for _, v := range input.Scores {
			if num, ok := v.(float64); ok {
				totalScore += num
			}
		}
		metadata["total_score"] = totalScore
	}

	if input.Comments != "" {
		metadata["comments"] = input.Comments
	}

	if input.Status != "" {
		metadata["status"] = input.Status
		metadata["status_updated_at"] = time.Now()
	}

	if input.Tags != nil {
		metadata["tags"] = input.Tags
	}

	metadata["flagged"] = input.Flagged

	if input.Decision != "" {
		metadata["decision"] = input.Decision
		metadata["decision_at"] = time.Now()
	}

	// Track reviewer activity
	if input.ReviewerID != "" {
		reviewHistory := []interface{}{}
		if val, ok := metadata["review_history"].([]interface{}); ok {
			reviewHistory = val
		}
		reviewHistory = append(reviewHistory, map[string]interface{}{
			"reviewer_id":   input.ReviewerID,
			"reviewer_name": input.ReviewerName,
			"reviewed_at":   time.Now(),
			"scores":        input.Scores,
		})
		metadata["review_history"] = reviewHistory
		metadata["review_count"] = len(reviewHistory)
	}

	row.Metadata = mapToJSON(metadata)

	if err := database.DB.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, row)
}

// BulkAssignWorkflow assigns multiple submissions to a workflow
func BulkAssignWorkflow(c *gin.Context) {
	formID := c.Param("id")

	var input struct {
		SubmissionIDs []string `json:"submission_ids"`
		WorkflowID    string   `json:"workflow_id"`
		StageID       string   `json:"stage_id"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(input.SubmissionIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No submission IDs provided"})
		return
	}

	count := 0
	for _, subID := range input.SubmissionIDs {
		var row models.Row
		if err := database.DB.Where("table_id = ? AND id = ?", formID, subID).First(&row).Error; err != nil {
			continue
		}

		var metadata map[string]interface{}
		if len(row.Metadata) > 0 {
			json.Unmarshal(row.Metadata, &metadata)
		} else {
			metadata = make(map[string]interface{})
		}

		metadata["assigned_workflow_id"] = input.WorkflowID
		metadata["current_stage_id"] = input.StageID
		metadata["workflow_assigned_at"] = time.Now()

		row.Metadata = mapToJSON(metadata)
		if err := database.DB.Save(&row).Error; err == nil {
			count++
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Workflow assigned", "count": count})
}

// UpdateSubmissionMetadata updates the metadata for a submission
func UpdateSubmissionMetadata(c *gin.Context) {
	formID := c.Param("id")
	submissionID := c.Param("submission_id")

	var input struct {
		Metadata map[string]interface{} `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find the submission
	var row models.Row
	if err := database.DB.Where("table_id = ? AND id = ?", formID, submissionID).First(&row).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Update metadata - merge with existing
	row.Metadata = mapToJSON(input.Metadata)

	if err := database.DB.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, row)
}
