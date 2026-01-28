package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Views Handlers - CRUD for table views including portal views

// ListViews returns all views for a table
func ListViews(c *gin.Context) {
	tableID := c.Param("tableId")
	viewType := c.Query("type") // Optional filter by type (grid, form, portal, etc.)

	var views []models.View
	query := database.DB.Where("table_id = ?", tableID)

	if viewType != "" {
		query = query.Where("type = ?", viewType)
	}

	if err := query.Order("created_at ASC").Find(&views).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, views)
}

// GetView returns a single view by ID
func GetView(c *gin.Context) {
	viewID := c.Param("viewId")

	var view models.View
	if err := database.DB.First(&view, "id = ?", viewID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "View not found"})
		return
	}

	c.JSON(http.StatusOK, view)
}

// GetPortalView returns the portal view for a table (convenience endpoint)
func GetPortalView(c *gin.Context) {
	tableID := c.Param("tableId")

	var view models.View
	if err := database.DB.Where("table_id = ? AND type = ?", tableID, models.ViewTypePortal).First(&view).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Portal view not found for this table"})
		return
	}

	c.JSON(http.StatusOK, view)
}

// GetPortalViews returns all portal views for a table
func GetPortalViews(c *gin.Context) {
	tableID := c.Param("id")

	var views []models.View
	if err := database.DB.Where("table_id = ? AND type = ?", tableID, models.ViewTypePortal).Find(&views).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch portal views"})
		return
	}

	c.JSON(http.StatusOK, views)
}

// UpdateViewConfig updates just the config field of a view
func UpdateViewConfig(c *gin.Context) {
	viewID := c.Param("id")

	viewUUID, err := uuid.Parse(viewID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid view ID"})
		return
	}

	var view models.View
	if err := database.DB.First(&view, viewUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "View not found"})
		return
	}

	var input struct {
		Config map[string]interface{} `json:"config" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	configJSON, err := json.Marshal(input.Config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize config"})
		return
	}
	view.Config = datatypes.JSON(configJSON)

	if err := database.DB.Save(&view).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update view config"})
		return
	}

	c.JSON(http.StatusOK, view)
}

// CreateViewInput is the input for creating a new view
type CreateViewInput struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Type        string                 `json:"type" binding:"required"` // grid, form, kanban, calendar, gallery, timeline, portal
	Settings    map[string]interface{} `json:"settings"`
	Config      map[string]interface{} `json:"config"`  // For portal: sections, translations, theme
	Filters     []interface{}          `json:"filters"` // View filters
	Sorts       []interface{}          `json:"sorts"`   // View sorts
	IsShared    bool                   `json:"is_shared"`
	IsLocked    bool                   `json:"is_locked"`
}

// CreateView creates a new view for a table
func CreateView(c *gin.Context) {
	tableID := c.Param("tableId")

	tableUUID, err := uuid.Parse(tableID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID"})
		return
	}

	// Verify table exists
	var table models.Table
	if err := database.DB.First(&table, "id = ?", tableUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table not found"})
		return
	}

	var input CreateViewInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID (Better Auth TEXT ID)
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	baUserID := userID // Better Auth user ID (TEXT)

	// Validate view type
	validTypes := []string{
		models.ViewTypeGrid,
		models.ViewTypeKanban,
		models.ViewTypeCalendar,
		models.ViewTypeGallery,
		models.ViewTypeTimeline,
		models.ViewTypeForm,
		models.ViewTypePortal,
	}
	isValid := false
	for _, vt := range validTypes {
		if input.Type == vt {
			isValid = true
			break
		}
	}
	if !isValid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid view type"})
		return
	}

	// Convert settings to JSON
	settingsJSON, _ := json.Marshal(input.Settings)
	configJSON, _ := json.Marshal(input.Config)
	filtersJSON, _ := json.Marshal(input.Filters)
	sortsJSON, _ := json.Marshal(input.Sorts)

	view := models.View{
		TableID:     tableUUID,
		Name:        input.Name,
		Description: input.Description,
		Type:        input.Type,
		Settings:    datatypes.JSON(settingsJSON),
		Config:      datatypes.JSON(configJSON),
		Filters:     datatypes.JSON(filtersJSON),
		Sorts:       datatypes.JSON(sortsJSON),
		IsShared:    input.IsShared,
		IsLocked:    input.IsLocked,
		BACreatedBy: &baUserID, // Better Auth user ID (TEXT)
	}

	if err := database.DB.Create(&view).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, view)
}

// UpdateViewInput is the input for updating a view
type UpdateViewInput struct {
	Name        *string                `json:"name"`
	Description *string                `json:"description"`
	Settings    map[string]interface{} `json:"settings"`
	Config      map[string]interface{} `json:"config"`
	Filters     []interface{}          `json:"filters"`
	Sorts       []interface{}          `json:"sorts"`
	Grouping    map[string]interface{} `json:"grouping"`
	IsShared    *bool                  `json:"is_shared"`
	IsLocked    *bool                  `json:"is_locked"`
}

// UpdateView updates an existing view
func UpdateView(c *gin.Context) {
	viewID := c.Param("viewId")

	var view models.View
	if err := database.DB.First(&view, "id = ?", viewID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "View not found"})
		return
	}

	var input UpdateViewInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields if provided
	if input.Name != nil {
		view.Name = *input.Name
	}
	if input.Description != nil {
		view.Description = *input.Description
	}
	if input.Settings != nil {
		settingsJSON, _ := json.Marshal(input.Settings)
		view.Settings = datatypes.JSON(settingsJSON)
	}
	if input.Config != nil {
		configJSON, _ := json.Marshal(input.Config)
		view.Config = datatypes.JSON(configJSON)
	}
	if input.Filters != nil {
		filtersJSON, _ := json.Marshal(input.Filters)
		view.Filters = datatypes.JSON(filtersJSON)
	}
	if input.Sorts != nil {
		sortsJSON, _ := json.Marshal(input.Sorts)
		view.Sorts = datatypes.JSON(sortsJSON)
	}
	if input.Grouping != nil {
		groupingJSON, _ := json.Marshal(input.Grouping)
		view.Grouping = datatypes.JSON(groupingJSON)
	}
	if input.IsShared != nil {
		view.IsShared = *input.IsShared
	}
	if input.IsLocked != nil {
		view.IsLocked = *input.IsLocked
	}

	if err := database.DB.Save(&view).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, view)
}

// DeleteView deletes a view
func DeleteView(c *gin.Context) {
	viewID := c.Param("viewId")

	var view models.View
	if err := database.DB.First(&view, "id = ?", viewID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "View not found"})
		return
	}

	// Prevent deleting the last grid view (every table should have at least one grid view)
	if view.Type == models.ViewTypeGrid {
		var count int64
		database.DB.Model(&models.View{}).
			Where("table_id = ? AND type = ?", view.TableID, models.ViewTypeGrid).
			Count(&count)
		if count <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete the only grid view"})
			return
		}
	}

	if err := database.DB.Delete(&view).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "View deleted successfully"})
}

// UpdatePortalViewInput is specific input for portal configuration
type UpdatePortalViewInput struct {
	Name               *string                  `json:"name"`
	Description        *string                  `json:"description"`
	Sections           []map[string]interface{} `json:"sections"`
	Theme              map[string]interface{}   `json:"theme"`
	Translations       map[string]interface{}   `json:"translations"`
	SubmissionSettings map[string]interface{}   `json:"submission_settings"`
	IsPublic           *bool                    `json:"is_public"`
	RequiresAuth       *bool                    `json:"requires_auth"`
}

// UpdatePortalView updates portal-specific configuration
func UpdatePortalView(c *gin.Context) {
	tableID := c.Param("tableId")

	var view models.View
	if err := database.DB.Where("table_id = ? AND type = ?", tableID, models.ViewTypePortal).First(&view).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Portal view not found for this table"})
		return
	}

	var input UpdatePortalViewInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update name/description if provided
	if input.Name != nil {
		view.Name = *input.Name
	}
	if input.Description != nil {
		view.Description = *input.Description
	}

	// Parse existing config
	var existingConfig map[string]interface{}
	if err := json.Unmarshal(view.Config, &existingConfig); err != nil {
		existingConfig = make(map[string]interface{})
	}

	// Update config fields
	if input.Sections != nil {
		existingConfig["sections"] = input.Sections
	}
	if input.Theme != nil {
		existingConfig["theme"] = input.Theme
	}
	if input.Translations != nil {
		existingConfig["translations"] = input.Translations
	}
	if input.SubmissionSettings != nil {
		existingConfig["submission_settings"] = input.SubmissionSettings
	}

	configJSON, _ := json.Marshal(existingConfig)
	view.Config = datatypes.JSON(configJSON)

	// Update settings for public/auth
	var existingSettings map[string]interface{}
	if err := json.Unmarshal(view.Settings, &existingSettings); err != nil {
		existingSettings = make(map[string]interface{})
	}

	if input.IsPublic != nil {
		existingSettings["is_public"] = *input.IsPublic
	}
	if input.RequiresAuth != nil {
		existingSettings["requires_auth"] = *input.RequiresAuth
	}

	settingsJSON, _ := json.Marshal(existingSettings)
	view.Settings = datatypes.JSON(settingsJSON)

	if err := database.DB.Save(&view).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, view)
}

// CreatePortalView creates a portal view for a table that doesn't have one
func CreatePortalView(c *gin.Context) {
	tableID := c.Param("tableId")

	tableUUID, err := uuid.Parse(tableID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID"})
		return
	}

	// Check if portal view already exists
	var existingView models.View
	if err := database.DB.Where("table_id = ? AND type = ?", tableUUID, models.ViewTypePortal).First(&existingView).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Portal view already exists for this table", "view": existingView})
		return
	}

	// Get table info
	var table models.Table
	if err := database.DB.First(&table, "id = ?", tableUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table not found"})
		return
	}

	// Get user ID (Better Auth TEXT ID)
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	baUserID := userID // Better Auth user ID (TEXT)

	// Create default portal configuration
	defaultConfig := map[string]interface{}{
		"sections": []map[string]interface{}{
			{
				"id":          "main",
				"title":       "Application",
				"description": "",
				"field_ids":   []string{},
			},
		},
		"theme":               map[string]interface{}{},
		"translations":        map[string]interface{}{},
		"submission_settings": map[string]interface{}{},
	}
	configJSON, _ := json.Marshal(defaultConfig)

	defaultSettings := map[string]interface{}{
		"is_public":     true,
		"requires_auth": false,
	}
	settingsJSON, _ := json.Marshal(defaultSettings)

	view := models.View{
		TableID:     tableUUID,
		Name:        table.Name + " Portal",
		Description: "Public application portal",
		Type:        models.ViewTypePortal,
		Config:      datatypes.JSON(configJSON),
		Settings:    datatypes.JSON(settingsJSON),
		Filters:     datatypes.JSON([]byte("[]")),
		Sorts:       datatypes.JSON([]byte("[]")),
		Grouping:    datatypes.JSON([]byte("{}")),
		IsShared:    true,
		IsLocked:    false,
		BACreatedBy: &baUserID, // Better Auth user ID (TEXT)
	}

	if err := database.DB.Create(&view).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, view)
}

// DuplicateView creates a copy of an existing view
func DuplicateView(c *gin.Context) {
	viewID := c.Param("id")

	var originalView models.View
	if err := database.DB.First(&originalView, "id = ?", viewID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "View not found"})
		return
	}

	// Get user ID (Better Auth - TEXT format)
	baUserID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Create copy with new ID and modified name
	newView := models.View{
		TableID:     originalView.TableID,
		Name:        originalView.Name + " (Copy)",
		Description: originalView.Description,
		Type:        originalView.Type,
		Settings:    originalView.Settings,
		Config:      originalView.Config,
		Filters:     originalView.Filters,
		Sorts:       originalView.Sorts,
		Grouping:    originalView.Grouping,
		IsShared:    false, // Copies start as not shared
		IsLocked:    false, // Copies start as not locked
		BACreatedBy: &baUserID,
	}

	if err := database.DB.Create(&newView).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, newView)
}
