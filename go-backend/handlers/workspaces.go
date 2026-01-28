package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"regexp"
	"strings"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
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
		Where("(workspace_members.user_id::text = ? OR workspace_members.ba_user_id = ?) AND workspace_members.status = ?", userID, userID, "active")

	if organizationID != "" {
		query = query.Where("workspaces.organization_id = ?", organizationID)
	}

	if !includeArchived {
		query = query.Where("workspaces.is_archived = ?", false)
	}

	// PERFORMANCE OPTIMIZATION: Preload Members with BAUser in single query
	// This fixes N+1 query issue - previously queried ba_users for each member separately
	if err := query.
		Preload("Members", func(db *gorm.DB) *gorm.DB {
			return db.Preload("BAUser").Where("status = ?", "active")
		}).
		Order("workspaces.created_at DESC").
		Find(&workspaces).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, workspaces)
}

// GetWorkspacesInit returns all data needed for workspace page initialization
// Optimized endpoint that combines workspaces, organizations, and active workspace data
// in a single response to eliminate waterfall requests
// GET /api/v1/workspaces/init
func GetWorkspacesInit(c *gin.Context) {
	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	type WorkspacesInitResponse struct {
		Workspaces        []models.Workspace `json:"workspaces"`
		ActiveWorkspaceID *uuid.UUID         `json:"active_workspace_id"`
		ActiveWorkspace   *models.Workspace  `json:"active_workspace"`
		OrganizationID    *uuid.UUID         `json:"organization_id"`
	}

	var response WorkspacesInitResponse

	// Get all user's workspaces with members (optimized with Preload)
	var workspaces []models.Workspace
	if err := database.DB.
		Joins("JOIN workspace_members ON workspace_members.workspace_id = workspaces.id").
		Where("(workspace_members.user_id::text = ? OR workspace_members.ba_user_id = ?) AND workspace_members.status = ? AND workspaces.is_archived = ?", userID, userID, "active", false).
		Preload("Members", func(db *gorm.DB) *gorm.DB {
			return db.Preload("BAUser").Where("status = ?", "active")
		}).
		Order("workspaces.created_at DESC").
		Find(&workspaces).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch workspaces"})
		return
	}

	response.Workspaces = workspaces

	// Get active workspace ID (most recently accessed or first workspace)
	if len(workspaces) > 0 {
		// Try to get from user's last accessed workspace (could be stored in user metadata)
		// For now, default to first workspace
		response.ActiveWorkspaceID = &workspaces[0].ID
		response.ActiveWorkspace = &workspaces[0]
		response.OrganizationID = &workspaces[0].OrganizationID
	}

	c.JSON(http.StatusOK, response)
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
	// Check both user_id (Supabase UUID) and ba_user_id (Better Auth TEXT) for compatibility
	if err := database.DB.
		Joins("JOIN workspace_members ON workspace_members.workspace_id = workspaces.id").
		Where("workspaces.id = ? AND (workspace_members.user_id::text = ? OR workspace_members.ba_user_id = ?) AND workspace_members.status = ?", id, userID, userID, "active").
		Preload("Members").
		Preload("Tables").
		First(&workspace).Error; err != nil {
		log.Printf("GetWorkspace: Failed to find workspace '%s' for user %s: %v", id, userID, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found or access denied"})
		return
	}

	c.JSON(http.StatusOK, workspace)
}

// GetWorkspaceBySlug returns a workspace by its slug or ID
// Supports both slug (e.g., "BPNC") and UUID (e.g., "9a13130f-a0ec-47c9-8fe2-8254f9fcfa7e")
func GetWorkspaceBySlug(c *gin.Context) {
	slugOrID := c.Param("slug")

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var workspace models.Workspace
	query := database.DB.
		Joins("JOIN workspace_members ON workspace_members.workspace_id = workspaces.id").
		Where("(workspace_members.user_id::text = ? OR workspace_members.ba_user_id = ?) AND workspace_members.status = ?", userID, userID, "active").
		Preload("Members")

	// Check if the input is a UUID (workspace ID) or a slug
	if _, err := uuid.Parse(slugOrID); err == nil {
		// It's a valid UUID, query by ID
		query = query.Where("workspaces.id = ?", slugOrID)
	} else {
		// It's a slug, query by slug
		query = query.Where("workspaces.slug = ?", slugOrID)
	}

	if err := query.First(&workspace).Error; err != nil {
		log.Printf("GetWorkspaceBySlug: Failed to find workspace '%s' for user %s: %v", slugOrID, userID, err)
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

	// Get authenticated user ID from JWT token (Better Auth TEXT ID)
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user ID not found"})
		return
	}

	// Get legacy UUID for backward compatibility
	legacyUserID := getLegacyUserID(userID)
	baUserID := userID // Better Auth user ID (TEXT)

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
		BACreatedBy:    &baUserID, // Better Auth user ID (TEXT)
	}

	// Begin transaction to create workspace and add creator as member
	tx := database.DB.Begin()

	if err := tx.Create(&workspace).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add creator as owner member
	member := models.WorkspaceMember{
		WorkspaceID: workspace.ID,
		UserID:      legacyUserID,
		BAUserID:    &baUserID, // Better Auth user ID (TEXT)
		Role:        "owner",
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

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var workspace models.Workspace
	if err := database.DB.First(&workspace, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	// Check if user is owner or admin of this workspace
	var member models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND (user_id::text = ? OR ba_user_id = ?) AND role IN ('owner', 'admin')", workspace.ID, userID, userID).First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to update this workspace"})
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

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var workspace models.Workspace
	if err := database.DB.First(&workspace, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	// Check if user is owner of this workspace (only owner can delete)
	var member models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND (user_id::text = ? OR ba_user_id = ?) AND role = ?", workspace.ID, userID, userID, "owner").First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the workspace owner can delete this workspace"})
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

	log.Printf("ListWorkspaceMembers: Looking for members in workspace %s", wsID)

	var members []models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND status = ?", wsID, "active").Find(&members).Error; err != nil {
		log.Printf("ListWorkspaceMembers: Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch members"})
		return
	}

	log.Printf("ListWorkspaceMembers: Found %d members", len(members))

	// Fetch names from both auth.users (Supabase) and ba_users (Better Auth)
	if len(members) > 0 {
		// Get legacy Supabase user IDs
		userIDs := make([]uuid.UUID, 0)
		baUserIDs := make([]string, 0)

		for _, m := range members {
			if m.UserID != nil {
				userIDs = append(userIDs, *m.UserID)
			}
			if m.BAUserID != nil {
				baUserIDs = append(baUserIDs, *m.BAUserID)
			}
		}

		// Query Supabase users
		if len(userIDs) > 0 {
			type UserProfile struct {
				ID        uuid.UUID
				FirstName string
				LastName  string
			}
			var profiles []UserProfile
			database.DB.Raw(`
				SELECT id, 
					COALESCE(raw_user_meta_data->>'first_name', '') as first_name,
					COALESCE(raw_user_meta_data->>'last_name', '') as last_name
				FROM auth.users WHERE id IN ?
			`, userIDs).Scan(&profiles)

			// Create a map for quick lookup
			profileMap := make(map[uuid.UUID]UserProfile)
			for _, p := range profiles {
				profileMap[p.ID] = p
			}

			// Populate names in members
			for i, m := range members {
				if m.UserID != nil {
					if profile, exists := profileMap[*m.UserID]; exists {
						members[i].FirstName = profile.FirstName
						members[i].LastName = profile.LastName
					}
				}
			}
		}

		// Query Better Auth users
		if len(baUserIDs) > 0 {
			type BAUserProfile struct {
				ID       string
				Name     string
				Email    string
				FullName *string
			}
			var baProfiles []BAUserProfile
			database.DB.Raw(`
				SELECT id, name, email, full_name
				FROM ba_users WHERE id IN ?
			`, baUserIDs).Scan(&baProfiles)

			// Create a map for quick lookup
			baProfileMap := make(map[string]BAUserProfile)
			for _, p := range baProfiles {
				baProfileMap[p.ID] = p
			}

			// Populate names in members
			for i, m := range members {
				if m.BAUserID != nil {
					if profile, exists := baProfileMap[*m.BAUserID]; exists {
						if profile.FullName != nil && *profile.FullName != "" {
							// Split full name into first and last
							nameParts := strings.Fields(*profile.FullName)
							if len(nameParts) > 0 {
								members[i].FirstName = nameParts[0]
								if len(nameParts) > 1 {
									members[i].LastName = strings.Join(nameParts[1:], " ")
								}
							}
						} else if profile.Name != "" {
							// Split name into first and last
							nameParts := strings.Fields(profile.Name)
							if len(nameParts) > 0 {
								members[i].FirstName = nameParts[0]
								if len(nameParts) > 1 {
									members[i].LastName = strings.Join(nameParts[1:], " ")
								}
							}
						}
						// Set email if not set from invitation
						if members[i].InvitedEmail == "" {
							members[i].InvitedEmail = profile.Email
						}
					}
				}
			}
		}
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

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var member models.WorkspaceMember
	if err := database.DB.First(&member, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	// Check if user is owner or admin of this workspace
	var requesterMember models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND (user_id::text = ? OR ba_user_id = ?) AND role IN ('owner', 'admin')", member.WorkspaceID, userID, userID).First(&requesterMember).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to update workspace members"})
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

	// Get authenticated user ID
	currentUserID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var member models.WorkspaceMember
	if err := database.DB.First(&member, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	// Check if user is owner or admin of this workspace
	var requesterMember models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND (user_id::text = ? OR ba_user_id = ?) AND role IN ('owner', 'admin')", member.WorkspaceID, currentUserID, currentUserID).First(&requesterMember).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to remove workspace members"})
		return
	}

	// Prevent users from removing themselves
	if member.UserID != nil && member.UserID.String() == currentUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You cannot remove yourself from a workspace"})
		return
	}

	// Prevent removing the last owner from a workspace
	if member.Role == "owner" {
		var ownerCount int64
		database.DB.Model(&models.WorkspaceMember{}).Where("workspace_id = ? AND role = ? AND status = ?", member.WorkspaceID, "owner", "active").Count(&ownerCount)
		if ownerCount <= 1 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Cannot remove the last owner from a workspace"})
			return
		}
	}

	if err := database.DB.Delete(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member removed successfully"})
}

// GetWorkspaceMembersWithAuth returns workspace members with Better Auth user data
func GetWorkspaceMembersWithAuth(c *gin.Context) {
	workspaceID := c.Param("id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	wsID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	// Check if user has access to this workspace
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Verify user is a member of this workspace
	var userMember models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND (user_id::text = ? OR ba_user_id = ?) AND status = ?", wsID, userID, userID, "active").First(&userMember).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this workspace"})
		return
	}

	type MemberWithAuth struct {
		ID                string  `json:"id"`
		WorkspaceID       string  `json:"workspace_id"`
		BAUserID          *string `json:"ba_user_id"`
		Role              string  `json:"role"`
		CreatedAt         string  `json:"created_at"`
		UpdatedAt         string  `json:"updated_at"`
		UserName          *string `json:"user_name"`
		UserEmail         string  `json:"user_email"`
		UserImage         *string `json:"user_image"`
		UserEmailVerified bool    `json:"user_email_verified"`
		UserCreatedAt     string  `json:"user_created_at"`
	}

	var members []MemberWithAuth
	err = database.DB.Raw(`
		SELECT 
			wm.id,
			wm.workspace_id,
			wm.ba_user_id,
			wm.role,
			ba.created_at::text as created_at,
			ba.updated_at::text as updated_at,
			ba.name as user_name,
			ba.email as user_email,
			ba.image as user_image,
			ba.email_verified as user_email_verified,
			ba.created_at::text as user_created_at
		FROM workspace_members wm
		LEFT JOIN ba_users ba ON wm.ba_user_id = ba.id
		WHERE wm.workspace_id = ? AND wm.status = 'active'
			AND (ba.user_type IS NULL OR ba.user_type != 'applicant')
		ORDER BY ba.created_at ASC
	`, wsID).Scan(&members).Error

	if err != nil {
		log.Printf("GetWorkspaceMembersWithAuth: Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch members"})
		return
	}

	c.JSON(http.StatusOK, members)
}

// GetWorkspaceInvitations is a wrapper that calls ListInvitations
// with the workspace ID from the URL parameter instead of query parameter
func GetWorkspaceInvitations(c *gin.Context) {
	workspaceID := c.Param("id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	// Set the workspace_id as a query parameter and call the existing handler
	c.Request.URL.RawQuery = fmt.Sprintf("workspace_id=%s&%s", workspaceID, c.Request.URL.RawQuery)
	ListInvitations(c)
}

// CreateWorkspaceInvitation is a wrapper that adds the workspace ID from the URL
// to the request body before calling the existing CreateInvitation handler
func CreateWorkspaceInvitation(c *gin.Context) {
	workspaceID := c.Param("id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	// Read the request body
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Add workspace_id to the body
	body["workspace_id"] = workspaceID

	// Re-bind the modified body back to the context
	jsonData, _ := json.Marshal(body)
	c.Request.Body = ioutil.NopCloser(bytes.NewBuffer(jsonData))

	// Call the existing handler
	CreateInvitation(c)
}
