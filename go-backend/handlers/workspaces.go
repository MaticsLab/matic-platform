package handlers

import (
	"log"
	"net/http"
	"regexp"
	"strings"

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

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var workspaces []models.Workspace
	query := database.DB.
		Joins("JOIN workspace_members ON workspace_members.workspace_id = workspaces.id").
		Where("workspace_members.user_id = ? AND workspace_members.status = ?", userID, "active")

	if organizationID != "" {
		query = query.Where("workspaces.organization_id = ?", organizationID)
	}

	if !includeArchived {
		query = query.Where("workspaces.is_archived = ?", false)
	}

	if err := query.Preload("Members").Order("workspaces.created_at DESC").Find(&workspaces).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, workspaces)
}

func GetWorkspace(c *gin.Context) {
	id := c.Param("id")

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var workspace models.Workspace
	// Verify user is an active member of this workspace
	if err := database.DB.
		Joins("JOIN workspace_members ON workspace_members.workspace_id = workspaces.id").
		Where("workspaces.id = ? AND workspace_members.user_id = ? AND workspace_members.status = ?", id, userID, "active").
		Preload("Members").
		Preload("Tables").
		First(&workspace).Error; err != nil {
		log.Printf("GetWorkspace: Failed to find workspace '%s' for user %s: %v", id, userID, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found or access denied"})
		return
	}

	c.JSON(http.StatusOK, workspace)
}

// GetWorkspaceBySlug returns a workspace by its slug
func GetWorkspaceBySlug(c *gin.Context) {
	slug := c.Param("slug")

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var workspace models.Workspace
	// Verify user is an active member of this workspace
	if err := database.DB.
		Joins("JOIN workspace_members ON workspace_members.workspace_id = workspaces.id").
		Where("workspaces.slug = ? AND workspace_members.user_id = ? AND workspace_members.status = ?", slug, userID, "active").
		Preload("Members").
		First(&workspace).Error; err != nil {
		log.Printf("GetWorkspaceBySlug: Failed to find workspace '%s' for user %s: %v", slug, userID, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found or access denied"})
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

	// Begin transaction to create workspace and add creator as member
	tx := database.DB.Begin()

	if err := tx.Create(&workspace).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add creator as admin member
	member := models.WorkspaceMember{
		WorkspaceID: workspace.ID,
		UserID:      &parsedUserID,
		Role:        "admin",
		Status:      "active",
	}

	if err := tx.Create(&member).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add user as workspace member"})
		return
	}

	tx.Commit()

	c.JSON(http.StatusCreated, workspace)
}

type UpdateWorkspaceInput struct {
	Name            *string                 `json:"name"`
	Slug            *string                 `json:"slug"`
	CustomSubdomain *string                 `json:"custom_subdomain,omitempty"` // Set to empty string to remove
	Description     *string                 `json:"description"`
	Color           *string                 `json:"color"`
	Icon            *string                 `json:"icon"`
	Settings        *map[string]interface{} `json:"settings"`
	IsArchived      *bool                   `json:"is_archived"`
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
	// Handle custom subdomain - can be set or cleared
	if input.CustomSubdomain != nil {
		if *input.CustomSubdomain == "" {
			workspace.CustomSubdomain = nil
		} else {
			// Validate subdomain
			subdomain := strings.ToLower(*input.CustomSubdomain)
			if !isValidSubdomain(subdomain) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subdomain. Must be 3-63 lowercase alphanumeric characters with optional hyphens, and not a reserved name."})
				return
			}
			// Check for uniqueness
			var existing models.Workspace
			if err := database.DB.Where("custom_subdomain = ? AND id != ?", subdomain, id).First(&existing).Error; err == nil {
				c.JSON(http.StatusConflict, gin.H{"error": "This subdomain is already taken"})
				return
			}
			workspace.CustomSubdomain = &subdomain
		}
	}

	if err := database.DB.Save(&workspace).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, workspace)
}

// isValidSubdomain validates a custom subdomain
func isValidSubdomain(subdomain string) bool {
	// Must be 3-63 characters (DNS subdomain limit)
	if len(subdomain) < 3 || len(subdomain) > 63 {
		return false
	}

	// Must match pattern: starts and ends with alphanumeric, can have hyphens in middle
	matched, _ := regexp.MatchString(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`, subdomain)
	if !matched {
		return false
	}

	// No consecutive hyphens
	if strings.Contains(subdomain, "--") {
		return false
	}

	// Check reserved subdomains
	reserved := []string{
		"forms", "www", "api", "app", "admin", "dashboard", "portal",
		"mail", "email", "ftp", "ssh", "help", "support", "status",
		"blog", "docs", "dev", "staging", "test", "demo", "cdn",
		"assets", "static", "img", "images", "media", "files",
		"auth", "login", "signup", "register", "account", "billing",
		"matic", "maticapp", "apply", "submit", "review", "external",
	}
	for _, r := range reserved {
		if subdomain == r {
			return false
		}
	}

	return true
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

// ListWorkspaceMembers returns all active members for a workspace
func ListWorkspaceMembers(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	wsID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	var members []models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND status = ?", wsID, "active").Find(&members).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch members"})
		return
	}

	c.JSON(http.StatusOK, members)
}

// UpdateWorkspaceMember updates a workspace member's role or hub access
func UpdateWorkspaceMember(c *gin.Context) {
	memberID := c.Param("id")
	if memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Member ID is required"})
		return
	}

	id, err := uuid.Parse(memberID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID"})
		return
	}

	var member models.WorkspaceMember
	if err := database.DB.First(&member, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	// Parse update payload
	var updates struct {
		Role      string   `json:"role"`
		HubAccess []string `json:"hub_access"`
	}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Apply updates
	if updates.Role != "" {
		member.Role = updates.Role
	}
	if updates.HubAccess != nil {
		member.HubAccess = updates.HubAccess
	}

	if err := database.DB.Save(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update member"})
		return
	}

	c.JSON(http.StatusOK, member)
}

// RemoveWorkspaceMember removes a member from a workspace
func RemoveWorkspaceMember(c *gin.Context) {
	memberID := c.Param("id")
	if memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Member ID is required"})
		return
	}

	id, err := uuid.Parse(memberID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID"})
		return
	}

	var member models.WorkspaceMember
	if err := database.DB.First(&member, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	if err := database.DB.Delete(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member removed successfully"})
}
