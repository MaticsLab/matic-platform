package handlers

import (
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Workspace Handlers

func ListWorkspaces(c *gin.Context) {
	organizationID := c.Query("organization_id")
	includeArchived := c.Query("include_archived") == "true"

	var workspaces []models.Workspace
	query := database.DB

	if organizationID != "" {
		query = query.Where("organization_id = ?", organizationID)
	}

	if !includeArchived {
		query = query.Where("is_archived = ?", false)
	}

	if err := query.Preload("Members").Order("created_at DESC").Find(&workspaces).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, workspaces)
}

func GetWorkspace(c *gin.Context) {
	id := c.Param("id")

	var workspace models.Workspace
	if err := database.DB.Preload("Members").
		Preload("DataTables").
		Preload("Forms").
		Preload("ActivitiesHubs").
		First(&workspace, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	c.JSON(http.StatusOK, workspace)
}

type CreateWorkspaceInput struct {
	OrganizationID uuid.UUID              `json:"organization_id" binding:"required"`
	Name           string                 `json:"name" binding:"required"`
	Slug           string                 `json:"slug" binding:"required"`
	Description    string                 `json:"description"`
	Color          string                 `json:"color"`
	Icon           string                 `json:"icon"`
	Settings       map[string]interface{} `json:"settings"`
}

func CreateWorkspace(c *gin.Context) {
	var input CreateWorkspaceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
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

	// Check for duplicate slug within organization
	var existing models.Workspace
	if err := database.DB.Where("organization_id = ? AND slug = ?", input.OrganizationID, input.Slug).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Workspace with this slug already exists in this organization"})
		return
	}

	color := input.Color
	if color == "" {
		color = "#3B82F6"
	}

	icon := input.Icon
	if icon == "" {
		icon = "folder"
	}

	workspace := models.Workspace{
		OrganizationID: input.OrganizationID,
		Name:           input.Name,
		Slug:           input.Slug,
		Description:    input.Description,
		Color:          color,
		Icon:           icon,
		Settings:       mapToJSON(input.Settings),
		CreatedBy:      parsedUserID,
	}

	if err := database.DB.Create(&workspace).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, workspace)
}

type UpdateWorkspaceInput struct {
	Name        *string                 `json:"name"`
	Slug        *string                 `json:"slug"`
	Description *string                 `json:"description"`
	Color       *string                 `json:"color"`
	Icon        *string                 `json:"icon"`
	Settings    *map[string]interface{} `json:"settings"`
	IsArchived  *bool                   `json:"is_archived"`
}

func UpdateWorkspace(c *gin.Context) {
	id := c.Param("id")

	var workspace models.Workspace
	if err := database.DB.First(&workspace, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	var input UpdateWorkspaceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check slug conflicts if updating
	if input.Slug != nil && *input.Slug != workspace.Slug {
		var existing models.Workspace
		if err := database.DB.Where("organization_id = ? AND slug = ? AND id != ?", workspace.OrganizationID, *input.Slug, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Workspace with this slug already exists"})
			return
		}
	}

	// Update fields
	if input.Name != nil {
		workspace.Name = *input.Name
	}
	if input.Slug != nil {
		workspace.Slug = *input.Slug
	}
	if input.Description != nil {
		workspace.Description = *input.Description
	}
	if input.Color != nil {
		workspace.Color = *input.Color
	}
	if input.Icon != nil {
		workspace.Icon = *input.Icon
	}
	if input.Settings != nil {
		workspace.Settings = mapToJSON(*input.Settings)
	}
	if input.IsArchived != nil {
		workspace.IsArchived = *input.IsArchived
	}

	if err := database.DB.Save(&workspace).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, workspace)
}

func DeleteWorkspace(c *gin.Context) {
	id := c.Param("id")

	var workspace models.Workspace
	if err := database.DB.First(&workspace, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	if err := database.DB.Delete(&workspace).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
