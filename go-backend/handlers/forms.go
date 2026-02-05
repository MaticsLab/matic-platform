package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/Jsanchez767/matic-platform/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// rowSelectColumns defines the columns to select for Row queries
// IMPORTANT: table_rows has ba_created_by/ba_updated_by (TEXT), NOT created_by/updated_by (UUID)
// Always use explicit Select() to avoid "column created_by does not exist" errors
const rowSelectColumns = "id, table_id, data, metadata, is_archived, position, stage_group_id, tags, ba_created_by, ba_updated_by, created_at, updated_at"

// GetForm returns a single form by ID
func GetForm(c *gin.Context) {
	id := c.Param("id")

	// Optimized: Load table with view in single query using Preload
	var table models.Table
	if err := database.DB.Preload("Views", "type = ?", "form").First(&table, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	// Load fields in one query with explicit ordering
	var fields []models.Field
	database.DB.Where("table_id = ?", table.ID).Order("position ASC").Find(&fields)
	for i := range fields {
		if fields[i].SectionID == nil || *fields[i].SectionID == "" {
			var config map[string]interface{}
			json.Unmarshal(fields[i].Config, &config)
			if sid, ok := config["section_id"].(string); ok && sid != "" {
				fields[i].SectionID = &sid
			}
		}
	}

	// Extract view data from preloaded relationship
	isPublished := false
	var viewID *uuid.UUID
	if len(table.Views) > 0 {
		view := table.Views[0]
		viewID = &view.ID
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

// GetFormBySlug returns a form by its slug or custom_slug
// Supports both auto-generated slug and custom_slug
func GetFormBySlug(c *gin.Context) {
	slugOrId := c.Param("slug")
	var table models.Table
	query := database.DB.Where("icon = ?", "form")

	// Try to find by UUID ID first (in case slug is actually a form ID)
	if _, err := uuid.Parse(slugOrId); err == nil {
		if err := query.Where("id = ?", slugOrId).First(&table).Error; err == nil {
			goto found
		}
	}

	// Try custom_slug first (preferred for public URLs)
	if err := query.Where("custom_slug = ?", slugOrId).First(&table).Error; err == nil {
		goto found
	}

	// Fall back to auto-generated slug
	if err := query.Where("slug = ?", slugOrId).First(&table).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

found:

	var fields []models.Field
	database.DB.Where("table_id = ?", table.ID).Order("position ASC").Find(&fields)
	for i := range fields {
		if fields[i].SectionID == nil || *fields[i].SectionID == "" {
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
	// List all forms (tables) in a workspace
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	// Parse workspace ID
	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workspace_id"})
		return
	}

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Verify user is an active member of this workspace
	member, memberExists := checkWorkspaceMembership(workspaceUUID, userID)
	if !memberExists {
		c.JSON(http.StatusForbidden, gin.H{"error": "User is not a member of this workspace"})
		return
	}

	// Get all tables (forms) in the workspace
	var tables []models.Table
	query := database.DB.Where("workspace_id = ?", workspaceUUID).Order("created_at DESC")

	// If user has hub_access restrictions (non-empty array), filter to only those tables
	if len(member.HubAccess) > 0 {
		query = query.Where("id = ANY(?)", member.HubAccess)
	}
	// If hub_access is empty/null, user has access to all tables

	if err := query.Find(&tables).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Convert tables to FormDTO
	var forms []FormDTO
	for _, table := range tables {
		// Get fields for this form
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

		// Get view to check if published
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
		}

		// Parse settings
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

		forms = append(forms, form)
	}

	c.JSON(http.StatusOK, forms)
}

// FormListItemDTO - Lightweight form data for hub list view
type FormListItemDTO struct {
	ID                 uuid.UUID  `json:"id"`
	ViewID             *uuid.UUID `json:"view_id,omitempty"`
	WorkspaceID        uuid.UUID  `json:"workspace_id"`
	Name               string     `json:"name"`
	Slug               string     `json:"slug"`
	CustomSlug         *string    `json:"custom_slug,omitempty"`
	Description        string     `json:"description"`
	IsPublished        bool       `json:"is_published"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	PreviewTitle       *string    `json:"preview_title,omitempty"`
	PreviewDescription *string    `json:"preview_description,omitempty"`
	PreviewImageURL    *string    `json:"preview_image_url,omitempty"`
	SubmissionCount    int        `json:"submission_count,omitempty"` // Optional: count of submissions
}

// ListFormsOptimized - Fast endpoint for Applications Hub
// Returns only essential fields without loading all form fields
func ListFormsOptimized(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	// Parse workspace ID
	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workspace_id"})
		return
	}

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Verify user is an active member of this workspace
	member, memberExists := checkWorkspaceMembership(workspaceUUID, userID)
	if !memberExists {
		c.JSON(http.StatusForbidden, gin.H{"error": "User is not a member of this workspace"})
		return
	}

	// Get all tables (forms) in the workspace - single query, no fields loaded
	var tables []models.Table
	query := database.DB.Where("workspace_id = ?", workspaceUUID).
		Select("id, workspace_id, name, slug, custom_slug, description, created_at, updated_at, preview_title, preview_description, preview_image_url").
		Order("created_at DESC")

	// If user has hub_access restrictions (non-empty array), filter to only those tables
	if len(member.HubAccess) > 0 {
		query = query.Where("id = ANY(?)", member.HubAccess)
	}
	// If hub_access is empty/null, user has access to all tables

	if err := query.Find(&tables).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Batch fetch views and submission counts in parallel
	type viewResult struct {
		TableID     uuid.UUID
		ViewID      *uuid.UUID
		IsPublished bool
	}

	type countResult struct {
		TableID uuid.UUID
		Count   int
	}

	// Get all table IDs
	tableIDs := make([]uuid.UUID, len(tables))
	for i, table := range tables {
		tableIDs[i] = table.ID
	}

	// Fetch views in batch
	var views []models.View
	database.DB.Where("table_id IN ? AND type = ?", tableIDs, "form").
		Select("id, table_id, config").
		Find(&views)

	// Build view map for quick lookup
	viewMap := make(map[uuid.UUID]viewResult)
	for _, view := range views {
		var config map[string]interface{}
		json.Unmarshal(view.Config, &config)
		isPublished := false
		if val, ok := config["is_published"].(bool); ok {
			isPublished = val
		}
		viewMap[view.TableID] = viewResult{
			TableID:     view.TableID,
			ViewID:      &view.ID,
			IsPublished: isPublished,
		}
	}

	// Fetch submission counts in batch using raw SQL for performance
	var counts []countResult
	if len(tableIDs) > 0 {
		database.DB.Raw(`
			SELECT table_id, COUNT(*) as count
			FROM table_rows
			WHERE table_id IN ?
			GROUP BY table_id
		`, tableIDs).Scan(&counts)
	}

	// Build count map
	countMap := make(map[uuid.UUID]int)
	for _, count := range counts {
		countMap[count.TableID] = count.Count
	}

	// Convert to DTO format
	forms := make([]FormListItemDTO, 0, len(tables))
	for _, table := range tables {
		view, hasView := viewMap[table.ID]
		submissionCount := countMap[table.ID]

		form := FormListItemDTO{
			ID:                 table.ID,
			WorkspaceID:        table.WorkspaceID,
			Name:               table.Name,
			Slug:               table.Slug,
			CustomSlug:         table.CustomSlug,
			Description:        table.Description,
			CreatedAt:          table.CreatedAt,
			UpdatedAt:          table.UpdatedAt,
			PreviewTitle:       table.PreviewTitle,
			PreviewDescription: table.PreviewDescription,
			PreviewImageURL:    table.PreviewImageURL,
			SubmissionCount:    submissionCount,
		}

		if hasView {
			form.ViewID = view.ViewID
			form.IsPublished = view.IsPublished
		}

		forms = append(forms, form)
	}

	c.JSON(http.StatusOK, forms)
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
	}

	// Set Better Auth user ID for table creation
	if userID, exists := middleware.GetUserID(c); exists {
		baUserID := userID
		table.BACreatedBy = &baUserID // Better Auth user ID (TEXT)
	}

	if err := database.DB.Create(&table).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	viewConfig := map[string]interface{}{
		"is_published": input.IsPublished,
	}

	view := models.View{
		TableID:     table.ID,
		Name:        "Form View",
		Type:        "form",
		Config:      mapToJSON(viewConfig),
		BACreatedBy: table.BACreatedBy, // Better Auth user ID (TEXT)
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

	// Re-fetch the updated table and view to return the full DTO
	var updatedView models.View
	isPublished := false
	var viewID *uuid.UUID
	if err := database.DB.Where("table_id = ? AND type = ?", table.ID, "form").First(&updatedView).Error; err == nil {
		viewID = &updatedView.ID
		var config map[string]interface{}
		json.Unmarshal(updatedView.Config, &config)
		if val, ok := config["is_published"].(bool); ok {
			isPublished = val
		}
	}

	var fields []models.Field
	database.DB.Where("table_id = ?", table.ID).Order("position ASC").Find(&fields)
	for i := range fields {
		if fields[i].SectionID == nil || *fields[i].SectionID == "" {
			var config map[string]interface{}
			json.Unmarshal(fields[i].Config, &config)
			if sid, ok := config["section_id"].(string); ok && sid != "" {
				fields[i].SectionID = &sid
			}
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
			TableID:     table.ID,
			Name:        "Form View",
			Type:        "form",
			Config:      mapToJSON(viewConfig),
			BACreatedBy: table.BACreatedBy,
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

// Form Submission Handlers

func ListFormSubmissions(c *gin.Context) {
	formID := c.Param("id")
	includeUser := c.Query("include_user") == "true"
	fmt.Printf("Listing submissions for form: %s, include_user: %v\n", formID, includeUser)

	// Get the table_id - formID might be a view_id
	var tableID uuid.UUID
	var view models.View
	if err := database.DB.Where("id = ?", formID).First(&view).Error; err == nil {
		tableID = view.TableID
	} else {
		// formID is the table_id itself
		parsedFormID, err := uuid.Parse(formID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form ID"})
			return
		}
		tableID = parsedFormID
	}

	// Parse pagination parameters
	limit := 100 // Default limit
	if limitParam := c.Query("limit"); limitParam != "" {
		if parsedLimit, err := strconv.Atoi(limitParam); err == nil && parsedLimit > 0 && parsedLimit <= 1000 {
			limit = parsedLimit
		}
	}

	offset := 0
	if offsetParam := c.Query("offset"); offsetParam != "" {
		if parsedOffset, err := strconv.Atoi(offsetParam); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	// If include_user is requested, we need to join with Better Auth users
	if includeUser {
		type SubmissionWithUser struct {
			ID                uuid.UUID              `json:"id"`
			TableID           uuid.UUID              `json:"table_id"`
			FormID            string                 `json:"form_id"` // Alias for table_id for frontend compatibility
			Data              json.RawMessage        `json:"data"`
			Metadata          json.RawMessage        `json:"metadata"`
			IsArchived        bool                   `json:"is_archived"`
			Position          int64                  `json:"position"`
			StageGroupID      *uuid.UUID             `json:"stage_group_id,omitempty"`
			Tags              json.RawMessage        `json:"tags"`
			BACreatedBy       *string                `json:"ba_created_by,omitempty"`
			BAUpdatedBy       *string                `json:"ba_updated_by,omitempty"`
			CreatedAt         time.Time              `json:"created_at"`
			UpdatedAt         time.Time              `json:"updated_at"`
			SubmittedAt       time.Time              `json:"submitted_at"` // Alias for created_at for frontend compatibility
			ApplicantFullName string                 `json:"applicant_full_name,omitempty"`
			Status            string                 `json:"status,omitempty"`
			BAUser            *models.BetterAuthUser `json:"ba_user,omitempty"`
		}

		var results []SubmissionWithUser
		// Join with ba_users table using ba_created_by field
		query := database.DB.Table("table_rows").
			Select(`table_rows.id, table_rows.table_id, table_rows.data, table_rows.metadata, 
				table_rows.is_archived, table_rows.position, table_rows.stage_group_id, 
				table_rows.tags, table_rows.ba_created_by, table_rows.ba_updated_by, 
				table_rows.created_at, table_rows.updated_at,
				ba_users.id as ba_user_id, ba_users.email as ba_user_email, ba_users.name as ba_user_name`).
			Joins("LEFT JOIN ba_users ON table_rows.ba_created_by = ba_users.id").
			Where("table_rows.table_id = ?", tableID).
			Order("table_rows.created_at DESC").
			Offset(offset).Limit(limit)

		rows, err := query.Rows()
		if err != nil {
			fmt.Printf("Error fetching submissions with users: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		for rows.Next() {
			var result SubmissionWithUser
			var baUserID, baUserEmail, baUserName *string

			if err := rows.Scan(
				&result.ID, &result.TableID, &result.Data, &result.Metadata,
				&result.IsArchived, &result.Position, &result.StageGroupID,
				&result.Tags, &result.BACreatedBy, &result.BAUpdatedBy,
				&result.CreatedAt, &result.UpdatedAt,
				&baUserID, &baUserEmail, &baUserName,
			); err != nil {
				fmt.Printf("Error scanning submission row: %v\n", err)
				continue
			}

			result.FormID = result.TableID.String()
			result.SubmittedAt = result.CreatedAt

			// Parse data to extract status and other info
			var rowData map[string]interface{}
			if len(result.Data) > 0 {
				json.Unmarshal(result.Data, &rowData)
			}

			var metadata map[string]interface{}
			if len(result.Metadata) > 0 {
				json.Unmarshal(result.Metadata, &metadata)
			}

			// Extract status from metadata if available
			if s, ok := metadata["status"].(string); ok && s != "" {
				result.Status = s
			}

			// Build Better Auth user if data exists
			if baUserID != nil && baUserEmail != nil {
				result.BAUser = &models.BetterAuthUser{
					ID:    *baUserID,
					Email: *baUserEmail,
				}
				if baUserName != nil {
					result.BAUser.Name = *baUserName
				}
			}

			results = append(results, result)
		}

		fmt.Printf("Found %d submissions with users for form %s\n", len(results), formID)
		c.JSON(http.StatusOK, results)
		return
	}

	// Fallback to original logic without user data
	var rows []models.Row
	// OPTIMIZATION: Select only needed columns to reduce data transfer
	// Note: table_rows has ba_created_by/ba_updated_by, NOT created_by/updated_by
	query := database.DB.Select(rowSelectColumns).
		Where("table_id = ?", tableID).
		Order("created_at DESC")

	// Apply pagination
	query = query.Offset(offset).Limit(limit)

	if err := query.Find(&rows).Error; err != nil {
		fmt.Printf("Error fetching submissions: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	fmt.Printf("Found %d submissions for form %s (limit: %d, offset: %d)\n", len(rows), formID, limit, offset)

	// OPTIMIZATION: Get all portal applicants for this form to map emails to full_names
	// portal_applicants.form_id can be either the table_id or any view_id for this table
	var viewIDs []uuid.UUID
	var views []models.View
	database.DB.Where("table_id = ? AND type = ?", tableID, "form").Find(&views)
	viewIDs = append(viewIDs, tableID) // Include table_id itself
	for _, v := range views {
		viewIDs = append(viewIDs, v.ID)
	}

	var applicants []models.PortalApplicant
	database.DB.Where("form_id IN ?", viewIDs).Find(&applicants)

	// Create a map of email -> full_name
	emailToFullName := make(map[string]string)
	for _, applicant := range applicants {
		if applicant.Email != "" && applicant.FullName != "" {
			emailToFullName[applicant.Email] = applicant.FullName
		}
	}

	// OPTIMIZATION: Build response directly without double marshaling
	// Use a type that matches the JSON structure we want (compatible with FormSubmission interface)
	type SubmissionResponse struct {
		ID                uuid.UUID              `json:"id"`
		TableID           uuid.UUID              `json:"table_id"`
		FormID            string                 `json:"form_id"` // Alias for table_id for frontend compatibility
		Data              map[string]interface{} `json:"data"`
		Metadata          map[string]interface{} `json:"metadata"`
		IsArchived        bool                   `json:"is_archived"`
		Position          int64                  `json:"position"`
		StageGroupID      *uuid.UUID             `json:"stage_group_id,omitempty"`
		Tags              []interface{}          `json:"tags"`
		BACreatedBy       *string                `json:"ba_created_by,omitempty"`
		BAUpdatedBy       *string                `json:"ba_updated_by,omitempty"`
		CreatedAt         time.Time              `json:"created_at"`
		UpdatedAt         time.Time              `json:"updated_at"`
		SubmittedAt       time.Time              `json:"submitted_at"` // Alias for created_at for frontend compatibility
		ApplicantFullName string                 `json:"applicant_full_name,omitempty"`
		// Status can be derived from metadata if needed
		Status string `json:"status,omitempty"`
	}

	result := make([]SubmissionResponse, len(rows))

	// Process rows - extract email and lookup full_name efficiently
	for i, row := range rows {
		// Parse Data JSONB field once (it's already JSON, just need to unmarshal)
		var rowData map[string]interface{}
		if len(row.Data) > 0 {
			if err := json.Unmarshal(row.Data, &rowData); err != nil {
				rowData = make(map[string]interface{})
			}
		} else {
			rowData = make(map[string]interface{})
		}

		// Parse Metadata JSONB field once
		var metadata map[string]interface{}
		if len(row.Metadata) > 0 {
			if err := json.Unmarshal(row.Metadata, &metadata); err != nil {
				metadata = make(map[string]interface{})
			}
		} else {
			metadata = make(map[string]interface{})
		}

		// Parse Tags JSONB field
		var tags []interface{}
		if len(row.Tags) > 0 {
			json.Unmarshal(row.Tags, &tags)
		}

		// Extract email efficiently - try multiple locations
		var email string
		if e, ok := rowData["_applicant_email"].(string); ok && e != "" {
			email = e
		} else if e, ok := rowData["email"].(string); ok && e != "" {
			email = e
		} else if personal, ok := rowData["personal"].(map[string]interface{}); ok {
			if e, ok := personal["personalEmail"].(string); ok && e != "" {
				email = e
			}
		}

		// Look up full_name from portal applicants
		applicantFullName := ""
		if email != "" {
			if fullName, exists := emailToFullName[email]; exists {
				applicantFullName = fullName
			}
		}

		// Extract status from metadata if available
		status := ""
		if s, ok := metadata["status"].(string); ok && s != "" {
			status = s
		}

		result[i] = SubmissionResponse{
			ID:                row.ID,
			TableID:           row.TableID,
			FormID:            row.TableID.String(), // Frontend expects form_id
			Data:              rowData,
			Metadata:          metadata,
			IsArchived:        row.IsArchived,
			Position:          row.Position,
			StageGroupID:      row.StageGroupID,
			Tags:              tags,
			BACreatedBy:       row.BACreatedBy,
			BAUpdatedBy:       row.BAUpdatedBy,
			CreatedAt:         row.CreatedAt,
			UpdatedAt:         row.UpdatedAt,
			SubmittedAt:       row.CreatedAt, // Frontend expects submitted_at
			ApplicantFullName: applicantFullName,
			Status:            status,
		}
	}

	c.JSON(http.StatusOK, result)
}

// DeleteFormSubmission deletes a single form submission (row) by its ID
func DeleteFormSubmission(c *gin.Context) {
	formID := c.Param("id")
	submissionID := c.Param("submission_id")

	fmt.Printf("🗑️ DeleteFormSubmission: formID=%s submissionID=%s\n", formID, submissionID)

	// formID is typically the table_id, but might be a view_id in some cases
	tableID := formID

	// Check if formID is a view_id - if so, get the table_id
	var view models.View
	if err := database.DB.Where("id = ?", formID).First(&view).Error; err == nil {
		tableID = view.TableID.String()
		fmt.Printf("🗑️ DeleteFormSubmission: Resolved view_id %s to table_id %s\n", formID, tableID)
	} else {
		// formID is the table_id itself
		fmt.Printf("🗑️ DeleteFormSubmission: Using formID as table_id: %s\n", tableID)
	}

	// First try to find the row directly by ID (in case table_id doesn't match)
	var row models.Row
	if err := database.DB.Select(rowSelectColumns).Where("id = ?", submissionID).First(&row).Error; err != nil {
		fmt.Printf("❌ DeleteFormSubmission: Row not found by ID %s: %v\n", submissionID, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	fmt.Printf("🗑️ DeleteFormSubmission: Found row %s, row.TableID=%s, expected tableID=%s\n", row.ID, row.TableID, tableID)

	// Verify the row belongs to the expected table
	if row.TableID.String() != tableID {
		fmt.Printf("⚠️ DeleteFormSubmission: Row table_id mismatch! row.TableID=%s, tableID=%s\n", row.TableID, tableID)
		// Still allow deletion if the row exists (table_id might be passed differently)
	}

	// Delete the submission (row) - use Unscoped to permanently delete
	if err := database.DB.Unscoped().Delete(&row).Error; err != nil {
		fmt.Printf("❌ DeleteFormSubmission: Failed to delete: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete submission"})
		return
	}

	fmt.Printf("✅ DeleteFormSubmission: Successfully deleted submission %s\n", submissionID)
	c.JSON(http.StatusOK, gin.H{"message": "Submission deleted successfully"})
}

type SubmitFormInput struct {
	Data      map[string]interface{} `json:"data" binding:"required"`
	Email     string                 `json:"email"`
	SaveDraft bool                   `json:"save_draft"` // If true, don't mark as submitted
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

	// Get table settings for application-level validation
	var table models.Table
	if err := database.DB.First(&table, "id = ?", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table not found"})
		return
	}

	// Parse application settings from table.Settings
	var tableSettings map[string]interface{}
	if table.Settings != nil {
		json.Unmarshal(table.Settings, &tableSettings)
	}
	if tableSettings == nil {
		tableSettings = make(map[string]interface{})
	}

	// Check application status
	if status, ok := tableSettings["applicationStatus"].(string); ok {
		if status == "closed" {
			fmt.Printf("🛑 SubmitForm: application %s is closed, rejecting submission\n", formID)
			c.JSON(http.StatusForbidden, gin.H{"error": "Applications are currently closed"})
			return
		}
		if status == "draft" {
			fmt.Printf("🛑 SubmitForm: application %s is in draft mode, rejecting submission\n", formID)
			c.JSON(http.StatusForbidden, gin.H{"error": "This application is not accepting submissions"})
			return
		}
	}

	// Check application deadline
	if deadline, ok := tableSettings["applicationDeadline"].(string); ok && deadline != "" {
		deadlineTime, err := time.Parse(time.RFC3339, deadline)
		if err == nil && time.Now().After(deadlineTime) {
			fmt.Printf("🛑 SubmitForm: application %s deadline has passed (%s), rejecting submission\n", formID, deadline)
			c.JSON(http.StatusForbidden, gin.H{"error": "The application deadline has passed"})
			return
		}
	}

	var input SubmitFormInput
	if err := c.ShouldBindJSON(&input); err != nil {
		fmt.Printf("❌ SubmitForm: bad request payload for %s: %v\n", formID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	fmt.Printf("[DEBUG] SubmitForm: input.SaveDraft = %v\n", input.SaveDraft)

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

		fmt.Printf("📝 SubmitForm: Looking for existing submission with email=%s, formID=%s\n", email, formID)

		// Use a transaction-level advisory lock to prevent race conditions
		// This ensures only one submission can be processed at a time for a given email+form
		lockKey := fmt.Sprintf("%s:%s", formID, email)
		lockID := int64(hashString(lockKey))

		// Try to acquire advisory lock with a retry mechanism (non-blocking to avoid deadlocks)
		var lockAcquired bool
		for i := 0; i < 10; i++ { // Try up to 10 times with short waits
			var result bool
			database.DB.Raw("SELECT pg_try_advisory_lock($1)", lockID).Scan(&result)
			if result {
				lockAcquired = true
				defer database.DB.Exec("SELECT pg_advisory_unlock($1)", lockID)
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		if !lockAcquired {
			fmt.Printf("⚠️ SubmitForm: Could not acquire lock for %s, proceeding without lock\n", lockKey)
		}

		var found bool
		for _, query := range queries {
			if err := database.DB.Select(rowSelectColumns).Where(query, formID, email).First(&existingRow).Error; err == nil {
				fmt.Printf("📝 SubmitForm: Found existing row using query: %s\n", query)
				found = true
				break
			} else {
				fmt.Printf("📝 SubmitForm: Query '%s' did not find row\n", query)
			}
		}

		if found {
			// Check if edits are allowed after submission
			allowEdits := true // Default to allowing edits
			if val, ok := tableSettings["allowEditsAfterSubmission"].(bool); ok {
				allowEdits = val
			}

			// Check if the existing submission is already submitted (not a draft)
			var checkMetadata map[string]interface{}
			if existingRow.Metadata != nil {
				json.Unmarshal(existingRow.Metadata, &checkMetadata)
			}
			isSubmitted := false
			if checkMetadata != nil {
				if status, ok := checkMetadata["status"].(string); ok && status == "submitted" {
					isSubmitted = true
				}
			}

			// Block edit if submissions are not allowed and already submitted
			if !allowEdits && isSubmitted && !input.SaveDraft {
				fmt.Printf("🛑 SubmitForm: edits not allowed for submitted application %s, rejecting\n", formID)
				c.JSON(http.StatusForbidden, gin.H{"error": "Edits are not allowed after submission"})
				return
			}

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

			// Link to Better Auth user if not already linked and we have an email
			if existingRow.BACreatedBy == nil && email != "" {
				var baUser struct {
					ID string `gorm:"column:id"`
				}
				if err := database.DB.Raw("SELECT id FROM ba_users WHERE email = ? LIMIT 1", email).Scan(&baUser).Error; err == nil && baUser.ID != "" {
					existingRow.BACreatedBy = &baUser.ID
					fmt.Printf("🔗 SubmitForm: Linked existing submission to Better Auth user %s (email=%s)\n", baUser.ID, email)
				}
			}

			// Update metadata - only change status if not a draft save
			var existingMetadata map[string]interface{}
			if existingRow.Metadata != nil {
				json.Unmarshal(existingRow.Metadata, &existingMetadata)
			}
			if existingMetadata == nil {
				existingMetadata = make(map[string]interface{})
			}
			if input.SaveDraft {
				fmt.Printf("[DEBUG] SubmitForm: Saving as draft (existing row)\n")
				// Draft save - keep current status or set to draft if no status
				if _, hasStatus := existingMetadata["status"]; !hasStatus {
					existingMetadata["status"] = "draft"
				}
				existingMetadata["draft_saved_at"] = time.Now()
			} else {
				fmt.Printf("[DEBUG] SubmitForm: Submitting (existing row)\n")
				// Full submission - mark as submitted
				existingMetadata["status"] = "submitted"
				existingMetadata["resubmitted_at"] = time.Now()
			}
			// Enforce: status must be draft if SaveDraft, submitted if not
			if input.SaveDraft && existingMetadata["status"] != "draft" {
				fmt.Printf("[ERROR] SubmitForm: Expected status 'draft' but got '%v'\n", existingMetadata["status"])
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Draft save did not set status to draft"})
				return
			}
			if !input.SaveDraft && existingMetadata["status"] != "submitted" {
				fmt.Printf("[ERROR] SubmitForm: Expected status 'submitted' but got '%v'\n", existingMetadata["status"])
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Submit did not set status to submitted"})
				return
			}
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

			// REMOVED: portal_applicants write (deprecated table, removed as per architecture audit)
			// All submission data is now stored ONLY in table_rows (single source of truth)
			fmt.Printf("✅ SubmitForm: Updated EXISTING submission in table_rows (id=%s) for email=%s\n", existingRow.ID, email)

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

			// Process recommendation fields and create recommendation requests (only for non-draft submissions)
			if !input.SaveDraft {
				go processRecommendationFields(parsedFormID, existingRow.ID, data)
			}

			fmt.Printf("✅ SubmitForm: updated submission row %s for form %s\n", existingRow.ID, formID)
			c.JSON(http.StatusOK, existingRow)
			return
		}

		fmt.Printf("📝 SubmitForm: No existing row found for email=%s, will create new\n", email)
	}

	// Check max submissions limit ONLY for new submissions (not updates)
	// This is checked here (after existing submission check) so users can update their own submissions
	if maxSubs, ok := tableSettings["maxSubmissions"].(float64); ok && maxSubs > 0 {
		var currentCount int64
		database.DB.Model(&models.Row{}).Where("table_id = ?", formID).Count(&currentCount)
		if currentCount >= int64(maxSubs) {
			fmt.Printf("🛑 SubmitForm: application %s has reached max submissions (%d/%d), rejecting NEW submission\n", formID, currentCount, int(maxSubs))
			c.JSON(http.StatusForbidden, gin.H{"error": "Maximum number of submissions has been reached"})
			return
		}
	}

	fmt.Printf("📝 SubmitForm: Creating NEW row for form %s (email=%s, save_draft=%v)\n", formID, email, input.SaveDraft)

	// Create new row with transaction
	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Set initial metadata with status based on save_draft flag
	initialMetadata := map[string]interface{}{
		"created_at": time.Now(),
	}
	if input.SaveDraft {
		fmt.Printf("[DEBUG] SubmitForm: Creating new row as draft\n")
		initialMetadata["status"] = "draft"
		initialMetadata["draft_saved_at"] = time.Now()
	} else {
		fmt.Printf("[DEBUG] SubmitForm: Creating new row as submitted\n")
		initialMetadata["status"] = "submitted"
		initialMetadata["submitted_at"] = time.Now()
	}
	// Enforce: status must be draft if SaveDraft, submitted if not
	if input.SaveDraft && initialMetadata["status"] != "draft" {
		fmt.Printf("[ERROR] SubmitForm: Expected status 'draft' but got '%v'\n", initialMetadata["status"])
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Draft save did not set status to draft"})
		return
	}
	if !input.SaveDraft && initialMetadata["status"] != "submitted" {
		fmt.Printf("[ERROR] SubmitForm: Expected status 'submitted' but got '%v'\n", initialMetadata["status"])
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Submit did not set status to submitted"})
		return
	}

	row := models.Row{
		TableID:  parsedFormID,
		Data:     mapToJSON(data),
		Metadata: mapToJSON(initialMetadata),
	}
	// Add user ID if authenticated (from middleware)
	var userIDStr string
	if s, exists := middleware.GetUserID(c); exists {
		row.BACreatedBy = &s
		userIDStr = s
	} else if email != "" {
		// For public submissions, try to find Better Auth user by email
		var baUser struct {
			ID string `gorm:"column:id"`
		}
		if err := database.DB.Raw("SELECT id FROM ba_users WHERE email = ? LIMIT 1", email).Scan(&baUser).Error; err == nil && baUser.ID != "" {
			row.BACreatedBy = &baUser.ID
			userIDStr = baUser.ID
			fmt.Printf("📝 SubmitForm: Linked submission to Better Auth user %s (email=%s)\n", baUser.ID, email)
		} else {
			fmt.Printf("⚠️ SubmitForm: No Better Auth user found for email=%s, creating unlinked submission\n", email)
		}
	}
	if err := tx.Create(&row).Error; err != nil {
		fmt.Printf("❌ SubmitForm: failed to create row for %s: %v\n", formID, err)
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// REMOVED: application_submissions write (duplicate data, removed as per architecture audit)
	// REMOVED: portal_applicants write (deprecated table, data now only in table_rows)
	// All submission data is now stored ONLY in table_rows (single source of truth)
	fmt.Printf("✅ SubmitForm: Created NEW submission in table_rows (id=%s) for email=%s\n", row.ID, email)

	// Create initial version for version history (synchronous, in transaction)
	versionService := services.NewVersionService()
	var baChangedBy *string
	if userIDStr != "" {
		baChangedBy = &userIDStr
	}
	if _, err := versionService.CreateVersionTx(tx, services.CreateVersionInput{
		RowID:        row.ID,
		TableID:      parsedFormID,
		Data:         data,
		ChangeType:   models.ChangeTypeCreate,
		ChangeReason: "Initial submission from portal",
		BAChangedBy:  baChangedBy,
	}); err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create version"})
		return
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

	// Process recommendation fields and create recommendation requests (only for non-draft submissions)
	if !input.SaveDraft {
		go processRecommendationFields(parsedFormID, row.ID, data)
	}

	fmt.Printf("✅ SubmitForm: created new submission row %s for form %s\n", row.ID, formID)
	c.JSON(http.StatusCreated, row)
}

// processRecommendationFields finds recommendation fields in the form and creates recommendation requests
// for each recommender. This is called asynchronously after form submission.
func processRecommendationFields(formID uuid.UUID, submissionID uuid.UUID, data map[string]interface{}) {
	fmt.Printf("📧 processRecommendationFields: Processing recommendations for submission %s\n", submissionID)

	// Get all fields for this form to find recommendation fields
	var fields []models.Field
	if err := database.DB.Where("table_id = ?", formID).Find(&fields).Error; err != nil {
		fmt.Printf("❌ processRecommendationFields: Failed to get fields for form %s: %v\n", formID, err)
		return
	}

	// Get the form info for email context
	var form models.Table
	if err := database.DB.First(&form, "id = ?", formID).Error; err != nil {
		fmt.Printf("❌ processRecommendationFields: Failed to get form %s: %v\n", formID, err)
		return
	}

	// Get the submission for context
	var submission models.Row
	if err := database.DB.First(&submission, "id = ?", submissionID).Error; err != nil {
		fmt.Printf("❌ processRecommendationFields: Failed to get submission %s: %v\n", submissionID, err)
		return
	}

	// Find recommendation fields
	for _, field := range fields {
		// Check if this is a recommendation field
		if field.FieldTypeID != "recommendation" {
			continue
		}

		fieldIDStr := field.ID.String()
		fmt.Printf("📧 processRecommendationFields: Found recommendation field %s\n", fieldIDStr)

		// Get the recommender data from the submission
		fieldData, exists := data[fieldIDStr]
		if !exists {
			fmt.Printf("📧 processRecommendationFields: No data for field %s\n", fieldIDStr)
			continue
		}

		// The recommender data should be an array of recommender objects
		recommenders, ok := fieldData.([]interface{})
		if !ok {
			fmt.Printf("📧 processRecommendationFields: Field %s data is not an array\n", fieldIDStr)
			continue
		}

		// Get field config for deadline settings
		var fieldConfig models.RecommendationFieldConfig
		if field.Config != nil {
			json.Unmarshal(field.Config, &fieldConfig)
		}

		// Set defaults
		if fieldConfig.DeadlineDays == 0 {
			fieldConfig.DeadlineDays = 14
		}

		// Process each recommender
		for _, recData := range recommenders {
			rec, ok := recData.(map[string]interface{})
			if !ok {
				continue
			}

			// Note: recommenderID is stored in rec["id"] but we don't need it for the request
			recommenderName := getStringValue(rec, "name")
			recommenderEmail := getStringValue(rec, "email")
			recommenderRelationship := getStringValue(rec, "relationship")

			if recommenderName == "" || recommenderEmail == "" {
				fmt.Printf("📧 processRecommendationFields: Skipping recommender with missing name/email\n")
				continue
			}

			// Check if a recommendation request already exists for this recommender
			var existingRequest models.RecommendationRequest
			if err := database.DB.Where(
				"submission_id = ? AND field_id = ? AND recommender_email = ? AND status != ?",
				submissionID, fieldIDStr, recommenderEmail, "cancelled",
			).First(&existingRequest).Error; err == nil {
				fmt.Printf("📧 processRecommendationFields: Request already exists for %s\n", recommenderEmail)
				continue
			}

			// Calculate expiry date
			var expiresAt *time.Time
			if fieldConfig.DeadlineDays > 0 {
				expiry := time.Now().AddDate(0, 0, fieldConfig.DeadlineDays)
				expiresAt = &expiry
			}

			// Create the recommendation request
			request := models.RecommendationRequest{
				SubmissionID:            submissionID,
				FormID:                  formID,
				FieldID:                 fieldIDStr,
				RecommenderName:         recommenderName,
				RecommenderEmail:        recommenderEmail,
				RecommenderRelationship: recommenderRelationship,
				Token:                   generateRecommendationToken(),
				Status:                  "pending",
				ExpiresAt:               expiresAt,
			}

			if err := database.DB.Create(&request).Error; err != nil {
				fmt.Printf("❌ processRecommendationFields: Failed to create request for %s: %v\n", recommenderEmail, err)
				continue
			}

			fmt.Printf("✅ processRecommendationFields: Created request %s for %s (%s)\n", request.ID, recommenderName, recommenderEmail)

			// Update the recommender data in the submission with the request ID
			rec["request_id"] = request.ID.String()
			rec["request_status"] = "pending"

			// Send the email asynchronously
			go sendRecommendationRequestEmail(&request, &submission, &form, &fieldConfig)
		}

		// Update the submission data with the request IDs
		data[fieldIDStr] = recommenders
		updatedData := mapToJSON(data)
		database.DB.Model(&models.Row{}).Where("id = ?", submissionID).Update("data", updatedData)
	}
}

// getStringValue safely extracts a string value from a map
func getStringValue(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
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
	Content     string                   `json:"content"` // Cover section content (Novel editor)
	Blocks      []map[string]interface{} `json:"blocks"`  // Ending section blocks
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
		sectionData := map[string]interface{}{
			"id":          s.ID,
			"title":       s.Title,
			"description": s.Description,
			"sectionType": s.SectionType,
			"conditions":  s.Conditions,
		}
		// Include content for cover sections
		if s.Content != "" {
			sectionData["content"] = s.Content
		}
		// Include blocks for ending sections
		if len(s.Blocks) > 0 {
			sectionData["blocks"] = s.Blocks
		}
		sectionMeta = append(sectionMeta, sectionData)
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

			// Extra debug for recommendation fields
			if fieldInput.Type == "recommendation" {
				fmt.Printf("🔔 RECOMMENDATION FIELD CONFIG RECEIVED:\n")
				fmt.Printf("   deadlineType=%v\n", fieldInput.Config["deadlineType"])
				fmt.Printf("   fixedDeadline=%v\n", fieldInput.Config["fixedDeadline"])
				fmt.Printf("   deadlineDays=%v\n", fieldInput.Config["deadlineDays"])
				fmt.Printf("   Full config: %+v\n", fieldInput.Config)
			}

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

	parsedFormID, err := uuid.Parse(formID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form ID"})
		return
	}

	// PRIORITY 1: Check table_rows (PRIMARY DATA SOURCE)
	// Try multiple locations where email might be stored:
	// 1. data->>'_applicant_email' (standard location - preferred)
	// 2. data->'personal'->>'personalEmail' (legacy static forms)
	// 3. data->>'email' (dynamic forms - field named email)
	// 4. data->>'Personal Email' (dynamic forms - field named Personal Email)
	// 5. data->>'CPS email' (dynamic forms - field named CPS email)
	// 6. data->>'personalEmail' (dynamic forms - camelCase variant)
	var row models.Row
	queries := []string{
		"table_id = ? AND data->>'_applicant_email' = ?",          // Standard location (check first)
		"table_id = ? AND data->'personal'->>'personalEmail' = ?", // Legacy location
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
		if err := database.DB.Select(rowSelectColumns).Where(query, formID, email).First(&row).Error; err == nil {
			found = true
			fmt.Printf("✅ GetFormSubmission: Found in table_rows using query: %s\n", query)
			break
		}
	}

	if found {
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
		return
	}

	// PRIORITY 2: Fallback to portal_applicants (LEGACY - for migration period only)
	// This should only happen for old submissions not yet migrated
	fmt.Printf("⚠️ GetFormSubmission: Not found in table_rows, checking legacy portal_applicants for email=%s\n", email)

	var allViews []models.View
	database.DB.Where("table_id = ? AND type = ?", formID, "form").Find(&allViews)
	formIDs := []uuid.UUID{parsedFormID} // Include table_id itself
	for _, v := range allViews {
		formIDs = append(formIDs, v.ID)
	}

	// Query portal_applicants using ANY to check all possible form_ids
	var applicant models.PortalApplicant
	if err := database.DB.Raw(`
		SELECT * FROM portal_applicants 
		WHERE form_id = ANY($1) AND email = $2
		LIMIT 1
	`, pq.Array(formIDs), email).Scan(&applicant).Error; err == nil && applicant.ID != uuid.Nil {
		// Found in portal_applicants - return this data
		fmt.Printf("⚠️ GetFormSubmission: Found in LEGACY portal_applicants table for email=%s (migration needed)\n", email)
		var submissionData map[string]interface{}
		json.Unmarshal(applicant.SubmissionData, &submissionData)

		// If applicant has a row_id, also fetch metadata from table_rows
		var metadata map[string]interface{}
		if applicant.RowID != nil {
			var row models.Row
			if err := database.DB.Select(rowSelectColumns).First(&row, "id = ?", *applicant.RowID).Error; err == nil {
				json.Unmarshal(row.Metadata, &metadata)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"id":         applicant.RowID, // May be nil if not yet submitted to table_rows
			"data":       submissionData,
			"metadata":   metadata,
			"created_at": applicant.CreatedAt,
			"updated_at": applicant.UpdatedAt,
		})
		return
	}

	// Not found in either location
	c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
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
	if err := database.DB.Select(rowSelectColumns).Where("table_id = ? AND id = ?", formID, submissionID).First(&row).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Merge with existing metadata
	existingMetadata := make(map[string]interface{})
	if row.Metadata != nil {
		json.Unmarshal(row.Metadata, &existingMetadata)
	}

	// Merge input metadata into existing
	for k, v := range input.Metadata {
		existingMetadata[k] = v
	}

	row.Metadata = mapToJSON(existingMetadata)

	if err := database.DB.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, row)
}
