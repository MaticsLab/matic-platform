package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// ============================================================
// ACTIVITIES HUBS HANDLERS
// Now using data_tables with hub_type='activities'
// ============================================================

// Helper function to parse date strings
func parseDate(dateStr string) (time.Time, error) {
	formats := []string{
		"2006-01-02",
		"2006-01-02T15:04:05Z07:00",
		time.RFC3339,
	}
	for _, format := range formats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return t, nil
		}
	}
	return time.Time{}, nil
}

// ActivitiesHubResponse wraps Table for backwards compatibility
type ActivitiesHubResponse struct {
	ID           uuid.UUID              `json:"id"`
	WorkspaceID  uuid.UUID              `json:"workspace_id"`
	Name         string                 `json:"name"`
	Slug         string                 `json:"slug"`
	Description  string                 `json:"description"`
	Category     string                 `json:"category,omitempty"`
	BeginDate    *time.Time             `json:"begin_date,omitempty"`
	EndDate      *time.Time             `json:"end_date,omitempty"`
	Status       string                 `json:"status"`
	Participants int                    `json:"participants"`
	Settings     map[string]interface{} `json:"settings"`
	IsActive     bool                   `json:"is_active"`
	IsHidden     bool                   `json:"is_hidden"`
	CreatedBy    uuid.UUID              `json:"created_by"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
	HubType      string                 `json:"hub_type"`
	EntityType   string                 `json:"entity_type"`
	RowCount     int                    `json:"row_count"`
}

// tableToActivitiesHub converts a Table to ActivitiesHubResponse
func tableToActivitiesHub(table models.Table) ActivitiesHubResponse {
	var settings map[string]interface{}
	json.Unmarshal(table.Settings, &settings)
	if settings == nil {
		settings = map[string]interface{}{}
	}

	// Extract activities-specific fields from settings
	category, _ := settings["category"].(string)
	status, _ := settings["status"].(string)
	if status == "" {
		status = "upcoming"
	}
	participants := 0
	if p, ok := settings["participants"].(float64); ok {
		participants = int(p)
	}
	isActive := true
	if ia, ok := settings["is_active"].(bool); ok {
		isActive = ia
	}

	var beginDate, endDate *time.Time
	if bd, ok := settings["begin_date"].(string); ok && bd != "" {
		if t, err := parseDate(bd); err == nil {
			beginDate = &t
		}
	}
	if ed, ok := settings["end_date"].(string); ok && ed != "" {
		if t, err := parseDate(ed); err == nil {
			endDate = &t
		}
	}

	return ActivitiesHubResponse{
		ID:           table.ID,
		WorkspaceID:  table.WorkspaceID,
		Name:         table.Name,
		Slug:         table.Slug,
		Description:  table.Description,
		Category:     category,
		BeginDate:    beginDate,
		EndDate:      endDate,
		Status:       status,
		Participants: participants,
		Settings:     settings,
		IsActive:     isActive,
		IsHidden:     table.IsHidden,
		CreatedBy:    table.CreatedBy,
		CreatedAt:    table.CreatedAt,
		UpdatedAt:    table.UpdatedAt,
		HubType:      table.HubType,
		EntityType:   table.EntityType,
		RowCount:     table.RowCount,
	}
}

func ListActivitiesHubs(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}
	includeInactive := c.Query("include_inactive") == "true"
	includeHidden := c.Query("include_hidden") == "true"
	
	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Get user's hub access restrictions for this workspace
	var member models.WorkspaceMember
	wsID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}
	
	memberExists := database.DB.Where("workspace_id = ? AND user_id = ? AND status = ?", wsID, userID, "active").First(&member).Error == nil
	if !memberExists {
		c.JSON(http.StatusForbidden, gin.H{"error": "User is not a member of this workspace"})
		return
	}

	var tables []models.Table
	query := database.DB.Where("workspace_id = ? AND hub_type = ?", workspaceID, "activities")

	// If user has hub_access restrictions (non-empty array), filter to only those hubs
	if len(member.HubAccess) > 0 {
		query = query.Where("id = ANY(?)", member.HubAccess)
	}
	// If hub_access is empty/null, user has access to all hubs

	if !includeInactive {
		// Check is_active in settings JSONB
		query = query.Where("(settings->>'is_active')::boolean IS NOT FALSE")
	}

	if !includeHidden {
		// Filter out hidden hubs
		query = query.Where("is_hidden = ? OR is_hidden IS NULL", false)
	}

	if err := query.Order("created_at DESC").Find(&tables).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Convert to ActivitiesHubResponse
	var hubs []ActivitiesHubResponse
	for _, table := range tables {
		hubs = append(hubs, tableToActivitiesHub(table))
	}

	c.JSON(http.StatusOK, hubs)
}

func GetActivitiesHub(c *gin.Context) {
	hubID := c.Param("hub_id")
	
	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var table models.Table
	if err := database.DB.Preload("Fields").Preload("Views").
		Where("id = ? AND hub_type = ?", hubID, "activities").
		First(&table).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}
	
	// Check if user has access to this hub
	var member models.WorkspaceMember
	memberExists := database.DB.Where("workspace_id = ? AND user_id = ? AND status = ?", table.WorkspaceID, userID, "active").First(&member).Error == nil
	if !memberExists {
		c.JSON(http.StatusForbidden, gin.H{"error": "User is not a member of this workspace"})
		return
	}
	
	// If user has hub_access restrictions, check if this hub is allowed
	if len(member.HubAccess) > 0 {
		hasAccess := false
		for _, allowedHubID := range member.HubAccess {
			if allowedHubID == hubID {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
			c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this hub"})
			return
		}
	}

	c.JSON(http.StatusOK, tableToActivitiesHub(table))
}

func GetActivitiesHubBySlug(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}
	slug := c.Param("slug")
	
	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var table models.Table
	if err := database.DB.Preload("Fields").Preload("Views").
		Where("slug = ? AND workspace_id = ? AND hub_type = ?", slug, workspaceID, "activities").
		First(&table).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}
	
	// Check if user has access to this hub
	var member models.WorkspaceMember
	wsID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}
	
	memberExists := database.DB.Where("workspace_id = ? AND user_id = ? AND status = ?", wsID, userID, "active").First(&member).Error == nil
	if !memberExists {
		c.JSON(http.StatusForbidden, gin.H{"error": "User is not a member of this workspace"})
		return
	}
	
	// If user has hub_access restrictions, check if this hub is allowed
	if len(member.HubAccess) > 0 {
		hasAccess := false
		for _, allowedHubID := range member.HubAccess {
			if allowedHubID == table.ID.String() {
				hasAccess = true
				break
			}
		}
		if !hasAccess {
			c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this hub"})
			return
		}
	}

	c.JSON(http.StatusOK, tableToActivitiesHub(table))
}

type CreateActivitiesHubInput struct {
	WorkspaceID  uuid.UUID              `json:"workspace_id" binding:"required"`
	Name         string                 `json:"name" binding:"required"`
	Slug         string                 `json:"slug" binding:"required"`
	Description  string                 `json:"description"`
	Category     string                 `json:"category"`
	BeginDate    *string                `json:"begin_date"`
	EndDate      *string                `json:"end_date"`
	Status       string                 `json:"status"`
	Participants int                    `json:"participants"`
	Settings     map[string]interface{} `json:"settings"`
	IsActive     *bool                  `json:"is_active"`
}

func CreateActivitiesHub(c *gin.Context) {
	var input CreateActivitiesHubInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check for duplicate slug
	var existing models.Table
	if err := database.DB.Where("workspace_id = ? AND slug = ?", input.WorkspaceID, input.Slug).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Activities hub with this slug already exists"})
		return
	}

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user ID not found"})
		return
	}
	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	// Build settings
	settings := input.Settings
	if settings == nil {
		settings = map[string]interface{}{}
	}
	settings["category"] = input.Category
	settings["status"] = input.Status
	if settings["status"] == "" {
		settings["status"] = "upcoming"
	}
	settings["participants"] = input.Participants
	settings["is_active"] = true
	if input.IsActive != nil {
		settings["is_active"] = *input.IsActive
	}
	if input.BeginDate != nil {
		settings["begin_date"] = *input.BeginDate
	}
	if input.EndDate != nil {
		settings["end_date"] = *input.EndDate
	}

	settingsJSON, _ := json.Marshal(settings)

	table := models.Table{
		WorkspaceID: input.WorkspaceID,
		Name:        input.Name,
		Slug:        input.Slug,
		Description: input.Description,
		Icon:        "calendar",
		Color:       "#10B981",
		HubType:     "activities",
		EntityType:  "event",
		Settings:    datatypes.JSON(settingsJSON),
		CreatedBy:   parsedUserID,
	}

	if err := database.DB.Create(&table).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, tableToActivitiesHub(table))
}

type UpdateActivitiesHubInput struct {
	Name         *string                 `json:"name"`
	Slug         *string                 `json:"slug"`
	Description  *string                 `json:"description"`
	Category     *string                 `json:"category"`
	BeginDate    *string                 `json:"begin_date"`
	EndDate      *string                 `json:"end_date"`
	Status       *string                 `json:"status"`
	Participants *int                    `json:"participants"`
	Settings     *map[string]interface{} `json:"settings"`
	IsActive     *bool                   `json:"is_active"`
}

func UpdateActivitiesHub(c *gin.Context) {
	hubID := c.Param("hub_id")

	var table models.Table
	if err := database.DB.Where("id = ? AND hub_type = ?", hubID, "activities").First(&table).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}

	var input UpdateActivitiesHubInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check slug conflicts if updating
	if input.Slug != nil && *input.Slug != table.Slug {
		var existing models.Table
		if err := database.DB.Where("workspace_id = ? AND slug = ? AND id != ?", table.WorkspaceID, *input.Slug, hubID).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Activities hub with this slug already exists"})
			return
		}
		table.Slug = *input.Slug
	}

	if input.Name != nil {
		table.Name = *input.Name
	}
	if input.Description != nil {
		table.Description = *input.Description
	}

	// Update settings
	var settings map[string]interface{}
	json.Unmarshal(table.Settings, &settings)
	if settings == nil {
		settings = map[string]interface{}{}
	}

	if input.Category != nil {
		settings["category"] = *input.Category
	}
	if input.Status != nil {
		settings["status"] = *input.Status
	}
	if input.Participants != nil {
		settings["participants"] = *input.Participants
	}
	if input.IsActive != nil {
		settings["is_active"] = *input.IsActive
	}
	if input.BeginDate != nil {
		settings["begin_date"] = *input.BeginDate
	}
	if input.EndDate != nil {
		settings["end_date"] = *input.EndDate
	}
	if input.Settings != nil {
		for k, v := range *input.Settings {
			settings[k] = v
		}
	}

	settingsJSON, _ := json.Marshal(settings)
	table.Settings = datatypes.JSON(settingsJSON)

	if err := database.DB.Save(&table).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tableToActivitiesHub(table))
}

func DeleteActivitiesHub(c *gin.Context) {
	hubID := c.Param("hub_id")

	var table models.Table
	if err := database.DB.Where("id = ? AND hub_type = ?", hubID, "activities").First(&table).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}

	if err := database.DB.Delete(&table).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Activities hub deleted successfully"})
}

// ============================================================
// TABS - Now stored as Views with type='tab' on the table
// ============================================================

type TabResponse struct {
	ID        uuid.UUID              `json:"id"`
	HubID     uuid.UUID              `json:"hub_id"`
	Name      string                 `json:"name"`
	Slug      string                 `json:"slug"`
	Type      string                 `json:"type"`
	Icon      string                 `json:"icon"`
	Position  int                    `json:"position"`
	IsVisible bool                   `json:"is_visible"`
	Config    map[string]interface{} `json:"config"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
}

func viewToTab(view models.View, hubID uuid.UUID) TabResponse {
	var config map[string]interface{}
	json.Unmarshal(view.Config, &config)
	if config == nil {
		config = map[string]interface{}{}
	}

	slug, _ := config["slug"].(string)
	tabType, _ := config["tab_type"].(string)
	icon, _ := config["icon"].(string)
	position := 0
	if p, ok := config["position"].(float64); ok {
		position = int(p)
	}
	isVisible := true
	if iv, ok := config["is_visible"].(bool); ok {
		isVisible = iv
	}

	return TabResponse{
		ID:        view.ID,
		HubID:     hubID,
		Name:      view.Name,
		Slug:      slug,
		Type:      tabType,
		Icon:      icon,
		Position:  position,
		IsVisible: isVisible,
		Config:    config,
		CreatedAt: view.CreatedAt,
		UpdatedAt: view.UpdatedAt,
	}
}

func ListActivitiesHubTabs(c *gin.Context) {
	hubID := c.Param("hub_id")

	hubUUID, err := uuid.Parse(hubID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid hub ID"})
		return
	}

	// Verify hub exists
	var table models.Table
	if err := database.DB.Where("id = ? AND hub_type = ?", hubID, "activities").First(&table).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}

	// Get views with type='tab'
	var views []models.View
	database.DB.Where("table_id = ? AND type = ?", hubID, "tab").Order("name ASC").Find(&views)

	var tabs []TabResponse
	for _, view := range views {
		tabs = append(tabs, viewToTab(view, hubUUID))
	}

	c.JSON(http.StatusOK, tabs)
}

type CreateTabInput struct {
	Name      string                 `json:"name" binding:"required"`
	Slug      string                 `json:"slug" binding:"required"`
	Type      string                 `json:"type" binding:"required"`
	Icon      string                 `json:"icon"`
	Position  int                    `json:"position"`
	IsVisible *bool                  `json:"is_visible"`
	Config    map[string]interface{} `json:"config"`
}

func CreateActivitiesHubTab(c *gin.Context) {
	hubID := c.Param("hub_id")

	hubUUID, err := uuid.Parse(hubID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid hub ID"})
		return
	}

	// Verify hub exists
	var table models.Table
	if err := database.DB.Where("id = ? AND hub_type = ?", hubID, "activities").First(&table).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}

	var input CreateTabInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	parsedUserID, _ := uuid.Parse(userID)

	// Build config
	config := input.Config
	if config == nil {
		config = map[string]interface{}{}
	}
	config["slug"] = input.Slug
	config["tab_type"] = input.Type
	config["icon"] = input.Icon
	config["position"] = input.Position
	config["is_visible"] = true
	if input.IsVisible != nil {
		config["is_visible"] = *input.IsVisible
	}

	configJSON, _ := json.Marshal(config)

	view := models.View{
		TableID:   hubUUID,
		Name:      input.Name,
		Type:      "tab",
		Config:    datatypes.JSON(configJSON),
		CreatedBy: parsedUserID,
	}

	if err := database.DB.Create(&view).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, viewToTab(view, hubUUID))
}

func UpdateActivitiesHubTab(c *gin.Context) {
	hubID := c.Param("hub_id")
	tabID := c.Param("tab_id")

	hubUUID, _ := uuid.Parse(hubID)

	var view models.View
	if err := database.DB.Where("id = ? AND table_id = ? AND type = ?", tabID, hubID, "tab").First(&view).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tab not found"})
		return
	}

	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if name, ok := input["name"].(string); ok {
		view.Name = name
	}

	// Update config
	var config map[string]interface{}
	json.Unmarshal(view.Config, &config)
	if config == nil {
		config = map[string]interface{}{}
	}

	for _, key := range []string{"slug", "type", "icon", "position", "is_visible"} {
		if val, ok := input[key]; ok {
			if key == "type" {
				config["tab_type"] = val
			} else {
				config[key] = val
			}
		}
	}
	if cfg, ok := input["config"].(map[string]interface{}); ok {
		for k, v := range cfg {
			config[k] = v
		}
	}

	configJSON, _ := json.Marshal(config)
	view.Config = datatypes.JSON(configJSON)

	if err := database.DB.Save(&view).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, viewToTab(view, hubUUID))
}

func DeleteActivitiesHubTab(c *gin.Context) {
	hubID := c.Param("hub_id")
	tabID := c.Param("tab_id")

	var view models.View
	if err := database.DB.Where("id = ? AND table_id = ? AND type = ?", tabID, hubID, "tab").First(&view).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tab not found"})
		return
	}

	if err := database.DB.Delete(&view).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tab deleted successfully"})
}

type ReorderTabsInput struct {
	TabIDs []string `json:"tab_ids" binding:"required"`
}

func ReorderActivitiesHubTabs(c *gin.Context) {
	hubID := c.Param("hub_id")

	var input ReorderTabsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for i, tabID := range input.TabIDs {
		var view models.View
		if err := database.DB.Where("id = ? AND table_id = ?", tabID, hubID).First(&view).Error; err == nil {
			var config map[string]interface{}
			json.Unmarshal(view.Config, &config)
			if config == nil {
				config = map[string]interface{}{}
			}
			config["position"] = i
			configJSON, _ := json.Marshal(config)
			view.Config = datatypes.JSON(configJSON)
			database.DB.Save(&view)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tabs reordered successfully"})
}

// ToggleHubVisibility toggles the is_hidden status of a hub (table)
// Only admins should be able to call this
type ToggleHubVisibilityInput struct {
	IsHidden bool `json:"is_hidden"`
}

func ToggleHubVisibility(c *gin.Context) {
	hubID := c.Param("hub_id")

	// Parse UUID
	hubUUID, err := uuid.Parse(hubID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid hub ID"})
		return
	}

	var input ToggleHubVisibilityInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var table models.Table
	if err := database.DB.Where("id = ?", hubUUID).First(&table).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Hub not found"})
		return
	}

	// Update the is_hidden field
	table.IsHidden = input.IsHidden
	if err := database.DB.Save(&table).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":        table.ID,
		"is_hidden": table.IsHidden,
		"message":   "Hub visibility updated successfully",
	})
}
