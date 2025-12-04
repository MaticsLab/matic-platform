package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/Jsanchez767/matic-platform/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// InvitationRequest represents the request body for creating an invitation
type InvitationRequest struct {
	WorkspaceID string   `json:"workspace_id" binding:"required"`
	Email       string   `json:"email" binding:"required,email"`
	Role        string   `json:"role"`
	HubAccess   []string `json:"hub_access"`
}

// InvitationResponse represents a pending invitation (a workspace member with status='pending')
type InvitationResponse struct {
	ID          string     `json:"id"`
	WorkspaceID string     `json:"workspace_id"`
	Email       string     `json:"email"`
	Role        string     `json:"role"`
	Status      string     `json:"status"`
	InvitedByID *string    `json:"invited_by_id"`
	InviteToken string     `json:"invite_token,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at"`
	InvitedAt   *time.Time `json:"invited_at"`
	AcceptedAt  *time.Time `json:"accepted_at,omitempty"`
}

// generateToken creates a secure random token
func generateToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// CreateInvitation creates a new pending workspace member (invitation)
func CreateInvitation(c *gin.Context) {
	var req InvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get the inviter's user ID from context
	userID, exists := c.Get("user_id")
	if !exists {
		log.Printf("CreateInvitation: No user_id in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	inviterID, err := uuid.Parse(userID.(string))
	if err != nil {
		log.Printf("CreateInvitation: Invalid user_id format: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	workspaceID, err := uuid.Parse(req.WorkspaceID)
	if err != nil {
		log.Printf("CreateInvitation: Invalid workspace_id format: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	// Check if workspace exists
	var workspace models.Workspace
	if err := database.DB.First(&workspace, "id = ?", workspaceID).Error; err != nil {
		log.Printf("CreateInvitation: Workspace not found: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	// Check if inviter has permission (is a member of the workspace)
	var inviterMember models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND user_id = ? AND status = ?", workspaceID, inviterID, "active").First(&inviterMember).Error; err != nil {
		log.Printf("CreateInvitation: Inviter is not an active member of workspace: %v", err)
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to invite to this workspace"})
		return
	}

	// Check if there's already a pending invitation for this email
	var existingInvite models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND invited_email = ? AND status = ?", workspaceID, req.Email, "pending").First(&existingInvite).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "An invitation for this email already exists"})
		return
	}

	// Check if user is already a member (by looking up their user_id via email)
	// Note: This requires joining with auth.users or having the email stored somewhere
	// For now, we'll check if there's an active member with this email in invited_email
	var existingMember models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND invited_email = ? AND status = ?", workspaceID, req.Email, "active").First(&existingMember).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User is already a member of this workspace"})
		return
	}

	// Generate invite token
	token, err := generateToken()
	if err != nil {
		log.Printf("CreateInvitation: Failed to generate token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate invitation"})
		return
	}

	// Set expiration to 7 days from now
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	invitedAt := time.Now()

	// Set default role
	role := req.Role
	if role == "" {
		role = "member"
	}

	// Create pending workspace member
	pendingMember := models.WorkspaceMember{
		ID:              uuid.New(),
		WorkspaceID:     workspaceID,
		UserID:          nil, // NULL until invitation is accepted
		Role:            role,
		Status:          "pending",
		InvitedEmail:    req.Email,
		InvitedBy:       &inviterID,
		InviteToken:     token,
		InviteExpiresAt: &expiresAt,
		InvitedAt:       &invitedAt,
		HubAccess:       req.HubAccess,
	}

	if err := database.DB.Create(&pendingMember).Error; err != nil {
		log.Printf("CreateInvitation: Failed to create pending member: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invitation: " + err.Error()})
		return
	}

	// Send invitation email
	if err := sendInvitationEmail(req.Email, token, workspace.Name); err != nil {
		log.Printf("CreateInvitation: Failed to send email (invitation created anyway): %v", err)
		// Don't fail the request if email fails - invitation is still created
	}

	invitedByStr := inviterID.String()
	response := InvitationResponse{
		ID:          pendingMember.ID.String(),
		WorkspaceID: pendingMember.WorkspaceID.String(),
		Email:       pendingMember.InvitedEmail,
		Role:        pendingMember.Role,
		Status:      pendingMember.Status,
		InvitedByID: &invitedByStr,
		ExpiresAt:   pendingMember.InviteExpiresAt,
		InvitedAt:   pendingMember.InvitedAt,
	}

	c.JSON(http.StatusCreated, response)
}

// ListInvitations returns all pending invitations for a workspace
func ListInvitations(c *gin.Context) {
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

	var pendingMembers []models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND status = ?", wsID, "pending").Find(&pendingMembers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch invitations"})
		return
	}

	// Convert to response format
	var invitations []InvitationResponse
	for _, pm := range pendingMembers {
		var invitedByStr *string
		if pm.InvitedBy != nil {
			s := pm.InvitedBy.String()
			invitedByStr = &s
		}

		invitations = append(invitations, InvitationResponse{
			ID:          pm.ID.String(),
			WorkspaceID: pm.WorkspaceID.String(),
			Email:       pm.InvitedEmail,
			Role:        pm.Role,
			Status:      pm.Status,
			InvitedByID: invitedByStr,
			ExpiresAt:   pm.InviteExpiresAt,
			InvitedAt:   pm.InvitedAt,
		})
	}

	c.JSON(http.StatusOK, invitations)
}

// GetInvitationByToken retrieves an invitation by its token
func GetInvitationByToken(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token is required"})
		return
	}

	var pendingMember models.WorkspaceMember
	if err := database.DB.Preload("Workspace").Where("invite_token = ? AND status = ?", token, "pending").First(&pendingMember).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation not found or already used"})
		return
	}

	// Check if expired
	if pendingMember.InviteExpiresAt != nil && pendingMember.InviteExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusGone, gin.H{"error": "Invitation has expired"})
		return
	}

	var invitedByStr *string
	if pendingMember.InvitedBy != nil {
		s := pendingMember.InvitedBy.String()
		invitedByStr = &s
	}

	response := InvitationResponse{
		ID:          pendingMember.ID.String(),
		WorkspaceID: pendingMember.WorkspaceID.String(),
		Email:       pendingMember.InvitedEmail,
		Role:        pendingMember.Role,
		Status:      pendingMember.Status,
		InvitedByID: invitedByStr,
		ExpiresAt:   pendingMember.InviteExpiresAt,
		InvitedAt:   pendingMember.InvitedAt,
	}

	// Include workspace name if preloaded
	c.JSON(http.StatusOK, gin.H{
		"invitation":     response,
		"workspace_name": pendingMember.Workspace.Name,
	})
}

// AcceptInvitation accepts a pending invitation and activates membership
func AcceptInvitation(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token is required"})
		return
	}

	// Get the accepting user's ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	acceptingUserID, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var pendingMember models.WorkspaceMember
	if err := database.DB.Where("invite_token = ? AND status = ?", token, "pending").First(&pendingMember).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation not found or already used"})
		return
	}

	// Check if expired
	if pendingMember.InviteExpiresAt != nil && pendingMember.InviteExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusGone, gin.H{"error": "Invitation has expired"})
		return
	}

	// Check if user is already an active member of this workspace
	var existingMember models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND user_id = ? AND status = ?", pendingMember.WorkspaceID, acceptingUserID, "active").First(&existingMember).Error; err == nil {
		// User is already a member, delete the pending invitation
		database.DB.Delete(&pendingMember)
		c.JSON(http.StatusConflict, gin.H{"error": "You are already a member of this workspace"})
		return
	}

	// Update the pending member to active
	now := time.Now()
	pendingMember.UserID = &acceptingUserID
	pendingMember.Status = "active"
	pendingMember.InviteToken = "" // Clear the token
	pendingMember.AcceptedAt = &now

	if err := database.DB.Save(&pendingMember).Error; err != nil {
		log.Printf("AcceptInvitation: Failed to update member: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to accept invitation"})
		return
	}

	// Fetch the workspace for the response
	var workspace models.Workspace
	database.DB.First(&workspace, "id = ?", pendingMember.WorkspaceID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Invitation accepted successfully",
		"workspace": gin.H{
			"id":   workspace.ID.String(),
			"name": workspace.Name,
			"slug": workspace.Slug,
		},
		"member": pendingMember,
	})
}

// RevokeInvitation cancels a pending invitation
func RevokeInvitation(c *gin.Context) {
	invitationID := c.Param("id")
	if invitationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invitation ID is required"})
		return
	}

	id, err := uuid.Parse(invitationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invitation ID"})
		return
	}

	// Get the revoker's user ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	revokerID, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var pendingMember models.WorkspaceMember
	if err := database.DB.Where("id = ? AND status = ?", id, "pending").First(&pendingMember).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pending invitation not found"})
		return
	}

	// Check if revoker has permission (is an active member of the workspace)
	var revokerMember models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND user_id = ? AND status = ?", pendingMember.WorkspaceID, revokerID, "active").First(&revokerMember).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to revoke this invitation"})
		return
	}

	// Delete the pending member record
	if err := database.DB.Delete(&pendingMember).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke invitation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Invitation revoked successfully"})
}

// ResendInvitation resends an invitation email with a new token
func ResendInvitation(c *gin.Context) {
	invitationID := c.Param("id")
	if invitationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invitation ID is required"})
		return
	}

	id, err := uuid.Parse(invitationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invitation ID"})
		return
	}

	// Get the resender's user ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	resenderID, err := uuid.Parse(userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var pendingMember models.WorkspaceMember
	if err := database.DB.Preload("Workspace").Where("id = ? AND status = ?", id, "pending").First(&pendingMember).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pending invitation not found"})
		return
	}

	// Check if resender has permission
	var resenderMember models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND user_id = ? AND status = ?", pendingMember.WorkspaceID, resenderID, "active").First(&resenderMember).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to resend this invitation"})
		return
	}

	// Generate new token and extend expiration
	newToken, err := generateToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate new token"})
		return
	}

	newExpiresAt := time.Now().Add(7 * 24 * time.Hour)
	pendingMember.InviteToken = newToken
	pendingMember.InviteExpiresAt = &newExpiresAt

	if err := database.DB.Save(&pendingMember).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update invitation"})
		return
	}

	// Send new invitation email
	if err := sendInvitationEmail(pendingMember.InvitedEmail, newToken, pendingMember.Workspace.Name); err != nil {
		log.Printf("ResendInvitation: Failed to send email: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send invitation email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Invitation resent successfully"})
}

// DeclineInvitation allows a user to decline an invitation
func DeclineInvitation(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token is required"})
		return
	}

	var pendingMember models.WorkspaceMember
	if err := database.DB.Where("invite_token = ? AND status = ?", token, "pending").First(&pendingMember).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation not found or already processed"})
		return
	}

	// Update status to declined
	pendingMember.Status = "declined"
	pendingMember.InviteToken = "" // Clear the token

	if err := database.DB.Save(&pendingMember).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decline invitation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Invitation declined"})
}

// sendInvitationEmail sends an invitation email via Supabase Auth
func sendInvitationEmail(email, token, workspaceName string) error {
	// Build the invite URL with our custom token
	siteURL := os.Getenv("SITE_URL")
	if siteURL == "" {
		siteURL = "https://maticsapp.com"
		if os.Getenv("GIN_MODE") == "debug" {
			siteURL = "http://localhost:3000"
		}
	}
	inviteURL := fmt.Sprintf("%s/invite/%s", siteURL, token)

	log.Printf("📧 Sending invitation email to %s for workspace '%s'", email, workspaceName)
	log.Printf("📧 Invite URL: %s", inviteURL)

	// Use Supabase Auth service to send magic link email
	supabaseAuth := services.NewSupabaseAuthService()

	// Try to invite the user via Supabase Auth Admin API
	// This will send an email through Supabase's email service
	_, err := supabaseAuth.InviteUserByEmail(email, inviteURL)
	if err != nil {
		log.Printf("⚠️ Supabase invite failed (user may already exist): %v", err)

		// If invite fails (user might already exist), try sending a magic link instead
		err = supabaseAuth.SendMagicLinkEmail(email, inviteURL)
		if err != nil {
			log.Printf("⚠️ Supabase magic link also failed: %v", err)
			// Don't fail the whole request - the invitation is still created
			// User can use the direct invite link
			return nil
		}
		log.Printf("✅ Magic link email sent to %s", email)
	} else {
		log.Printf("✅ Invitation email sent to %s via Supabase", email)
	}

	return nil
}
