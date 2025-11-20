package handlers

import (
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Helper function to parse date strings
func parseDate(dateStr string) (time.Time, error) {
	// Try parsing common date formats
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

// Activities Hub Handlers

func ListActivitiesHubs(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}
	includeInactive := c.Query("include_inactive") == "true"

	var hubs []models.ActivitiesHub
	query := database.DB.Where("workspace_id = ?", workspaceID)

	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	if err := query.Order("created_at DESC").Find(&hubs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, hubs)
}

func GetActivitiesHub(c *gin.Context) {
	hubID := c.Param("hub_id")

	var hub models.ActivitiesHub
	if err := database.DB.Preload("Tabs").
		Where("id = ?", hubID).
		First(&hub).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}

	c.JSON(http.StatusOK, hub)
}

func GetActivitiesHubBySlug(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}
	slug := c.Param("slug")

	var hub models.ActivitiesHub
	if err := database.DB.Preload("Tabs").
		Where("slug = ? AND workspace_id = ?", slug, workspaceID).
		First(&hub).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}

	c.JSON(http.StatusOK, hub)
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
	var existing models.ActivitiesHub
	if err := database.DB.Where("workspace_id = ? AND slug = ?", input.WorkspaceID, input.Slug).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Activities hub with this slug already exists"})
		return
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	status := "upcoming"
	if input.Status != "" {
		status = input.Status
	}

	// Get authenticated user ID from JWT token
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

	hub := models.ActivitiesHub{
		WorkspaceID:  input.WorkspaceID,
		Name:         input.Name,
		Slug:         input.Slug,
		Description:  input.Description,
		Category:     input.Category,
		Status:       status,
		Participants: input.Participants,
		Settings:     mapToJSON(input.Settings),
		IsActive:     isActive,
		CreatedBy:    parsedUserID,
	}

	// Parse dates if provided
	if input.BeginDate != nil && *input.BeginDate != "" {
		if beginDate, err := parseDate(*input.BeginDate); err == nil {
			hub.BeginDate = &beginDate
		}
	}
	if input.EndDate != nil && *input.EndDate != "" {
		if endDate, err := parseDate(*input.EndDate); err == nil {
			hub.EndDate = &endDate
		}
	}

	if err := database.DB.Create(&hub).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload with tabs
	database.DB.Preload("Tabs").First(&hub, hub.ID)

	c.JSON(http.StatusCreated, hub)
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

	var hub models.ActivitiesHub
	if err := database.DB.Where("id = ?", hubID).First(&hub).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}

	var input UpdateActivitiesHubInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check slug conflicts if updating
	if input.Slug != nil && *input.Slug != hub.Slug {
		var existing models.ActivitiesHub
		if err := database.DB.Where("workspace_id = ? AND slug = ? AND id != ?", hub.WorkspaceID, *input.Slug, hubID).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Activities hub with this slug already exists"})
			return
		}
	}

	// Update fields
	if input.Name != nil {
		hub.Name = *input.Name
	}
	if input.Slug != nil {
		hub.Slug = *input.Slug
	}
	if input.Description != nil {
		hub.Description = *input.Description
	}
	if input.Category != nil {
		hub.Category = *input.Category
	}
	if input.Status != nil {
		hub.Status = *input.Status
	}
	if input.Participants != nil {
		hub.Participants = *input.Participants
	}
	if input.BeginDate != nil {
		if *input.BeginDate == "" {
			hub.BeginDate = nil
		} else if beginDate, err := parseDate(*input.BeginDate); err == nil {
			hub.BeginDate = &beginDate
		}
	}
	if input.EndDate != nil {
		if *input.EndDate == "" {
			hub.EndDate = nil
		} else if endDate, err := parseDate(*input.EndDate); err == nil {
			hub.EndDate = &endDate
		}
	}
	if input.Settings != nil {
		hub.Settings = mapToJSON(*input.Settings)
	}
	if input.IsActive != nil {
		hub.IsActive = *input.IsActive
	}

	if err := database.DB.Save(&hub).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload with tabs
	database.DB.Preload("Tabs").First(&hub, hub.ID)

	c.JSON(http.StatusOK, hub)
}

func DeleteActivitiesHub(c *gin.Context) {
	hubID := c.Param("hub_id")

	var hub models.ActivitiesHub
	if err := database.DB.Where("id = ?", hubID).First(&hub).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}

	if err := database.DB.Delete(&hub).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// Activities Hub Tab Handlers

func ListActivitiesHubTabs(c *gin.Context) {
	hubID := c.Param("hub_id")
	includeHidden := c.Query("include_hidden") == "true"

	// Verify hub exists
	var hub models.ActivitiesHub
	if err := database.DB.Where("id = ?", hubID).First(&hub).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}

	var tabs []models.ActivitiesHubTab
	query := database.DB.Where("hub_id = ?", hubID)

	if !includeHidden {
		query = query.Where("is_visible = ?", true)
	}

	if err := query.Order("position ASC").Find(&tabs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tabs)
}

type CreateActivitiesHubTabInput struct {
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

	// Verify hub exists
	var hub models.ActivitiesHub
	if err := database.DB.Where("id = ?", hubID).First(&hub).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}

	var input CreateActivitiesHubTabInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check for duplicate slug
	var existing models.ActivitiesHubTab
	if err := database.DB.Where("hub_id = ? AND slug = ?", hubID, input.Slug).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Tab with this slug already exists"})
		return
	}

	isVisible := true
	if input.IsVisible != nil {
		isVisible = *input.IsVisible
	}

	tab := models.ActivitiesHubTab{
		HubID:     uuid.MustParse(hubID),
		Name:      input.Name,
		Slug:      input.Slug,
		Type:      input.Type,
		Icon:      input.Icon,
		Position:  input.Position,
		IsVisible: isVisible,
		Config:    mapToJSON(input.Config),
	}

	if err := database.DB.Create(&tab).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, tab)
}

type UpdateActivitiesHubTabInput struct {
	Name      *string                 `json:"name"`
	Slug      *string                 `json:"slug"`
	Type      *string                 `json:"type"`
	Icon      *string                 `json:"icon"`
	Position  *int                    `json:"position"`
	IsVisible *bool                   `json:"is_visible"`
	Config    *map[string]interface{} `json:"config"`
}

func UpdateActivitiesHubTab(c *gin.Context) {
	hubID := c.Param("hub_id")
	tabID := c.Param("tab_id")

	// Verify hub exists
	var hub models.ActivitiesHub
	if err := database.DB.Where("id = ?", hubID).First(&hub).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}

	var tab models.ActivitiesHubTab
	if err := database.DB.Where("id = ? AND hub_id = ?", tabID, hubID).First(&tab).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tab not found"})
		return
	}

	var input UpdateActivitiesHubTabInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check slug conflicts if updating
	if input.Slug != nil && *input.Slug != tab.Slug {
		var existing models.ActivitiesHubTab
		if err := database.DB.Where("hub_id = ? AND slug = ? AND id != ?", hubID, *input.Slug, tabID).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Tab with this slug already exists"})
			return
		}
	}

	// Update fields
	if input.Name != nil {
		tab.Name = *input.Name
	}
	if input.Slug != nil {
		tab.Slug = *input.Slug
	}
	if input.Type != nil {
		tab.Type = *input.Type
	}
	if input.Icon != nil {
		tab.Icon = *input.Icon
	}
	if input.Position != nil {
		tab.Position = *input.Position
	}
	if input.IsVisible != nil {
		tab.IsVisible = *input.IsVisible
	}
	if input.Config != nil {
		tab.Config = mapToJSON(*input.Config)
	}

	if err := database.DB.Save(&tab).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tab)
}

func DeleteActivitiesHubTab(c *gin.Context) {
	hubID := c.Param("hub_id")
	tabID := c.Param("tab_id")

	// Verify hub exists
	var hub models.ActivitiesHub
	if err := database.DB.Where("id = ?", hubID).First(&hub).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}

	var tab models.ActivitiesHubTab
	if err := database.DB.Where("id = ? AND hub_id = ?", tabID, hubID).First(&tab).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tab not found"})
		return
	}

	if err := database.DB.Delete(&tab).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

type ReorderTabInput struct {
	ID       uuid.UUID `json:"id" binding:"required"`
	Position int       `json:"position" binding:"required"`
}

type ReorderTabsInput struct {
	Tabs []ReorderTabInput `json:"tabs" binding:"required"`
}

func ReorderActivitiesHubTabs(c *gin.Context) {
	hubID := c.Param("hub_id")

	// Verify hub exists
	var hub models.ActivitiesHub
	if err := database.DB.Where("id = ?", hubID).First(&hub).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activities hub not found"})
		return
	}

	var input ReorderTabsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update positions in transaction
	tx := database.DB.Begin()
	for _, item := range input.Tabs {
		if err := tx.Model(&models.ActivitiesHubTab{}).
			Where("id = ? AND hub_id = ?", item.ID, hubID).
			Update("position", item.Position).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	tx.Commit()

	// Return updated tabs
	var tabs []models.ActivitiesHubTab
	if err := database.DB.Where("hub_id = ?", hubID).Order("position ASC").Find(&tabs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tabs)
}
