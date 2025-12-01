package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// ============================================================================
// Invitation Handlers
// ============================================================================

// CreateInvitationInput is the input for creating a new invitation
type CreateInvitationInput struct {
	WorkspaceID string   `json:"workspace_id" binding:"required"`
	Email       string   `json:"email" binding:"required,email"`
	Role        string   `json:"role"` // admin, editor, viewer
	HubAccess   []string `json:"hub_access,omitempty"`
}

// generateToken creates a random token for invitation links
func generateToken() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// CreateInvitation creates a new workspace invitation
func CreateInvitation(c *gin.Context) {
	var input CreateInvitationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	parsedWorkspaceID, err := uuid.Parse(input.WorkspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	// Verify user has admin access to this workspace
	var membership models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND user_id = ?", parsedWorkspaceID, parsedUserID).First(&membership).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this workspace"})
		return
	}

	if membership.Role != "admin" && membership.Role != "owner" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can invite members"})
		return
	}

	// Check if user is already a member
	var existingMember models.WorkspaceMember
	if err := database.DB.
		Joins("JOIN auth.users ON auth.users.id = workspace_members.user_id").
		Where("workspace_members.workspace_id = ? AND auth.users.email = ?", parsedWorkspaceID, input.Email).
		First(&existingMember).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "This user is already a member of the workspace"})
		return
	}

	// Check for pending invitation
	var existingInvite models.WorkspaceInvitation
	if err := database.DB.Where("workspace_id = ? AND email = ? AND status = 'pending'", parsedWorkspaceID, input.Email).First(&existingInvite).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "An invitation has already been sent to this email"})
		return
	}

	// Set default role if not provided
	role := input.Role
	if role == "" {
		role = "viewer"
	}

	// Validate role
	validRoles := map[string]bool{"admin": true, "editor": true, "viewer": true}
	if !validRoles[role] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Must be admin, editor, or viewer"})
		return
	}

	// Create invitation
	invitation := models.WorkspaceInvitation{
		WorkspaceID: parsedWorkspaceID,
		Email:       input.Email,
		Role:        role,
		HubAccess:   pq.StringArray(input.HubAccess),
		Status:      "pending",
		InvitedBy:   parsedUserID,
		Token:       generateToken(),
		ExpiresAt:   time.Now().AddDate(0, 0, 7), // 7 days expiry
	}

	if err := database.DB.Create(&invitation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invitation"})
		return
	}

	// TODO: Send email notification to invitee

	c.JSON(http.StatusCreated, invitation)
}

// ListInvitations lists all invitations for a workspace
func ListInvitations(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Verify user has access to this workspace
	var membership models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND user_id = ?", workspaceID, userID).First(&membership).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this workspace"})
		return
	}

	var invitations []models.WorkspaceInvitation
	if err := database.DB.Where("workspace_id = ?", workspaceID).Order("created_at DESC").Find(&invitations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch invitations"})
		return
	}

	c.JSON(http.StatusOK, invitations)
}

// RevokeInvitation cancels a pending invitation
func RevokeInvitation(c *gin.Context) {
	invitationID := c.Param("id")

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var invitation models.WorkspaceInvitation
	if err := database.DB.First(&invitation, "id = ?", invitationID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation not found"})
		return
	}

	// Verify user has admin access
	var membership models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND user_id = ?", invitation.WorkspaceID, userID).First(&membership).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this workspace"})
		return
	}

	if membership.Role != "admin" && membership.Role != "owner" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can revoke invitations"})
		return
	}

	if invitation.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only revoke pending invitations"})
		return
	}

	if err := database.DB.Delete(&invitation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke invitation"})
		return
	}

	c.Status(http.StatusNoContent)
}

// ResendInvitation resends an invitation email
func ResendInvitation(c *gin.Context) {
	invitationID := c.Param("id")

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var invitation models.WorkspaceInvitation
	if err := database.DB.First(&invitation, "id = ?", invitationID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation not found"})
		return
	}

	// Verify user has admin access
	var membership models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND user_id = ?", invitation.WorkspaceID, userID).First(&membership).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this workspace"})
		return
	}

	if membership.Role != "admin" && membership.Role != "owner" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can resend invitations"})
		return
	}

	if invitation.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only resend pending invitations"})
		return
	}

	// Generate new token and extend expiry
	invitation.Token = generateToken()
	invitation.ExpiresAt = time.Now().AddDate(0, 0, 7)

	if err := database.DB.Save(&invitation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update invitation"})
		return
	}

	// TODO: Send email notification

	c.JSON(http.StatusOK, invitation)
}

// AcceptInvitation accepts an invitation and adds user to workspace
func AcceptInvitation(c *gin.Context) {
	token := c.Param("token")

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var invitation models.WorkspaceInvitation
	if err := database.DB.First(&invitation, "token = ?", token).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation not found or expired"})
		return
	}

	if invitation.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invitation has already been " + invitation.Status})
		return
	}

	if time.Now().After(invitation.ExpiresAt) {
		invitation.Status = "expired"
		database.DB.Save(&invitation)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invitation has expired"})
		return
	}

	// Verify the email matches the authenticated user
	// Get user email from auth.users
	var userEmail string
	if err := database.DB.Raw("SELECT email FROM auth.users WHERE id = ?", parsedUserID).Scan(&userEmail).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify user email"})
		return
	}

	if userEmail != invitation.Email {
		c.JSON(http.StatusForbidden, gin.H{"error": "This invitation was sent to a different email address"})
		return
	}

	// Check if already a member
	var existingMember models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND user_id = ?", invitation.WorkspaceID, parsedUserID).First(&existingMember).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "You are already a member of this workspace"})
		return
	}

	// Begin transaction
	tx := database.DB.Begin()

	// Add user as member
	member := models.WorkspaceMember{
		WorkspaceID: invitation.WorkspaceID,
		UserID:      parsedUserID,
		Role:        invitation.Role,
		HubAccess:   invitation.HubAccess,
	}

	if err := tx.Create(&member).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add you to the workspace"})
		return
	}

	// Update invitation status
	now := time.Now()
	invitation.Status = "accepted"
	invitation.AcceptedAt = &now

	if err := tx.Save(&invitation).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update invitation"})
		return
	}

	tx.Commit()

	// Get workspace info for response
	var workspace models.Workspace
	database.DB.First(&workspace, "id = ?", invitation.WorkspaceID)

	c.JSON(http.StatusOK, gin.H{
		"message":   "Successfully joined workspace",
		"workspace": workspace,
		"member":    member,
	})
}

// GetInvitationByToken gets invitation details by token (for preview before accepting)
func GetInvitationByToken(c *gin.Context) {
	token := c.Param("token")

	var invitation models.WorkspaceInvitation
	if err := database.DB.First(&invitation, "token = ?", token).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation not found"})
		return
	}

	// Get workspace info
	var workspace models.Workspace
	if err := database.DB.First(&workspace, "id = ?", invitation.WorkspaceID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	// Don't expose the token in the response
	invitation.Token = ""

	c.JSON(http.StatusOK, gin.H{
		"invitation": invitation,
		"workspace": gin.H{
			"id":   workspace.ID,
			"name": workspace.Name,
			"slug": workspace.Slug,
		},
		"is_expired": time.Now().After(invitation.ExpiresAt),
	})
}

// ============================================================================
// Workspace Member Handlers
// ============================================================================

// ListWorkspaceMembers lists all members of a workspace
func ListWorkspaceMembers(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Verify user has access to this workspace
	var membership models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND user_id = ?", workspaceID, userID).First(&membership).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this workspace"})
		return
	}

	// Get members with emails from auth.users
	type MemberWithEmail struct {
		models.WorkspaceMember
		Email string `json:"email"`
	}

	var members []MemberWithEmail
	if err := database.DB.Table("workspace_members").
		Select("workspace_members.*, auth.users.email").
		Joins("LEFT JOIN auth.users ON auth.users.id = workspace_members.user_id").
		Where("workspace_members.workspace_id = ?", workspaceID).
		Order("workspace_members.added_at ASC").
		Scan(&members).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch members"})
		return
	}

	c.JSON(http.StatusOK, members)
}

// UpdateMemberInput is the input for updating a workspace member
type UpdateMemberInput struct {
	Role      *string  `json:"role,omitempty"`
	HubAccess []string `json:"hub_access,omitempty"`
}

// UpdateWorkspaceMember updates a member's role or hub access
func UpdateWorkspaceMember(c *gin.Context) {
	memberID := c.Param("id")

	var input UpdateMemberInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var member models.WorkspaceMember
	if err := database.DB.First(&member, "id = ?", memberID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	// Verify user has admin access to this workspace
	var currentMembership models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND user_id = ?", member.WorkspaceID, userID).First(&currentMembership).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this workspace"})
		return
	}

	if currentMembership.Role != "admin" && currentMembership.Role != "owner" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can update members"})
		return
	}

	// Prevent modifying your own role
	if member.UserID.String() == userID && input.Role != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot modify your own role"})
		return
	}

	// Update fields
	if input.Role != nil {
		validRoles := map[string]bool{"admin": true, "editor": true, "viewer": true}
		if !validRoles[*input.Role] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
			return
		}
		member.Role = *input.Role
	}

	if input.HubAccess != nil {
		member.HubAccess = pq.StringArray(input.HubAccess)
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

	// Get authenticated user ID
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var member models.WorkspaceMember
	if err := database.DB.First(&member, "id = ?", memberID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	// Verify user has admin access
	var currentMembership models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND user_id = ?", member.WorkspaceID, userID).First(&currentMembership).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this workspace"})
		return
	}

	if currentMembership.Role != "admin" && currentMembership.Role != "owner" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can remove members"})
		return
	}

	// Prevent removing yourself
	if member.UserID.String() == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot remove yourself from the workspace"})
		return
	}

	// Prevent removing the last admin
	if member.Role == "admin" || member.Role == "owner" {
		var adminCount int64
		database.DB.Model(&models.WorkspaceMember{}).Where("workspace_id = ? AND role IN ('admin', 'owner')", member.WorkspaceID).Count(&adminCount)
		if adminCount <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot remove the last admin from the workspace"})
			return
		}
	}

	if err := database.DB.Delete(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member"})
		return
	}

	c.Status(http.StatusNoContent)
}
