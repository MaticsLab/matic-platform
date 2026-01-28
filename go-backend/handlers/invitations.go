package handlers

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"

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
	// Get authenticated user ID from context (Better Auth TEXT ID)
	userID, exists := c.Get("user_id")
	if !exists {
		log.Printf("CreateInvitation: No user_id in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userIDStr := userID.(string)
	// For Better Auth users, don't set legacy invited_by to avoid foreign key constraints
	baInviterID := userIDStr // Better Auth user ID (TEXT)

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
	if err := database.DB.Where("workspace_id = ? AND (user_id::text = ? OR ba_user_id = ?) AND status = ?", workspaceID, userIDStr, userIDStr, "active").First(&inviterMember).Error; err != nil {
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

	// Create pending workspace member (Better Auth approach)
	pendingMember := models.WorkspaceMember{
		ID:              uuid.New(),
		WorkspaceID:     workspaceID,
		UserID:          nil, // NULL until invitation is accepted
		BAUserID:        nil, // NULL until invitation is accepted
		Role:            role,
		Status:          "pending",
		InvitedEmail:    req.Email,
		BAInvitedBy:     &baInviterID, // Better Auth user ID (TEXT)
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
	if err := sendInvitationEmail(req.Email, token, &workspace); err != nil {
		log.Printf("CreateInvitation: Failed to send email (invitation created anyway): %v", err)
		// Don't fail the request if email fails - invitation is still created
	}

	invitedByStr := userIDStr // Use Better Auth user ID
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
		invitations = append(invitations, InvitationResponse{
			ID:          pm.ID.String(),
			WorkspaceID: pm.WorkspaceID.String(),
			Email:       pm.InvitedEmail,
			Role:        pm.Role,
			Status:      pm.Status,
			InvitedByID: pm.BAInvitedBy,
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

	response := InvitationResponse{
		ID:          pendingMember.ID.String(),
		WorkspaceID: pendingMember.WorkspaceID.String(),
		Email:       pendingMember.InvitedEmail,
		Role:        pendingMember.Role,
		Status:      pendingMember.Status,
		InvitedByID: pendingMember.BAInvitedBy,
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

	// Get the accepting user's ID (Better Auth TEXT ID)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	acceptingUserIDStr := userID.(string)
	acceptingUserID := getLegacyUserID(acceptingUserIDStr) // Legacy UUID (if available)
	baAcceptingUserID := acceptingUserIDStr                // Better Auth user ID (TEXT)

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
	if err := database.DB.Where("workspace_id = ? AND (user_id::text = ? OR ba_user_id = ?) AND status = ?", pendingMember.WorkspaceID, acceptingUserIDStr, acceptingUserIDStr, "active").First(&existingMember).Error; err == nil {
		// User is already a member, delete the pending invitation
		database.DB.Delete(&pendingMember)
		c.JSON(http.StatusConflict, gin.H{"error": "You are already a member of this workspace"})
		return
	}

	// Update the pending member to active
	now := time.Now()
	pendingMember.UserID = acceptingUserID      // Legacy UUID (if available)
	pendingMember.BAUserID = &baAcceptingUserID // Better Auth user ID (TEXT)
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

	// Get the revoker's user ID (Better Auth TEXT ID)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	revokerIDStr := userID.(string)
	// revokerID not needed - we use revokerIDStr in the query

	var pendingMember models.WorkspaceMember
	if err := database.DB.Where("id = ? AND status = ?", id, "pending").First(&pendingMember).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pending invitation not found"})
		return
	}

	// Check if revoker has permission (is an active member of the workspace)
	var revokerMember models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND (user_id::text = ? OR ba_user_id = ?) AND status = ?", pendingMember.WorkspaceID, revokerIDStr, revokerIDStr, "active").First(&revokerMember).Error; err != nil {
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

	// Get resender's user ID (Better Auth TEXT ID)
	resenderIDStr := userID.(string)
	// resenderID not needed - we use resenderIDStr in the query

	var pendingMember models.WorkspaceMember
	if err := database.DB.Preload("Workspace").Where("id = ? AND status = ?", id, "pending").First(&pendingMember).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pending invitation not found"})
		return
	}

	// Check if resender has permission
	var resenderMember models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ? AND (user_id::text = ? OR ba_user_id = ?) AND status = ?", pendingMember.WorkspaceID, resenderIDStr, resenderIDStr, "active").First(&resenderMember).Error; err != nil {
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
	if err := sendInvitationEmail(pendingMember.InvitedEmail, newToken, &pendingMember.Workspace); err != nil {
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

// sendInvitationEmail sends an invitation email via Resend
func sendInvitationEmail(email, token string, workspace *models.Workspace) error {
	workspaceName := workspace.Name
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

	// Check for global Resend API key first for system emails
	globalResendKey := os.Getenv("RESEND_API_KEY")
	if globalResendKey == "" {
		log.Printf("⚠️ No global RESEND_API_KEY found in environment variables")
		log.Printf("💡 To send invitation emails, please set RESEND_API_KEY in your .env file")
		log.Printf("💡 You can get an API key from https://resend.com/api-keys")
		log.Printf("💡 The invitation was created successfully - user can still use the direct link: %s", inviteURL)
		return fmt.Errorf("RESEND_API_KEY not configured")
	}

	// Create email content
	subject := fmt.Sprintf("You're invited to join %s on Matic", workspaceName)

	// HTML email template
	htmlBody := fmt.Sprintf(`<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />
    <title>Matic workspace invitation</title>
  </head>
  <body
    style="
      margin: 0;
      padding: 24px 0;
      background-color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
        Roboto, Arial, sans-serif;
    "
  >
    <!-- Outer wrapper -->
    <table
      role="presentation"
      cellspacing="0"
      cellpadding="0"
      border="0"
      width="100%%"
    >
      <tr>
        <td align="center">
          <!-- Card -->
          <table
            role="presentation"
            cellspacing="0"
            cellpadding="0"
            border="0"
            width="100%%"
            style="
              max-width: 560px;
              background-color: #ffffff;
              border-radius: 12px;
              border: 1px solid #e5e7eb;
            "
          >
            <!-- Header -->
            <tr>
              <td
                style="
                  padding: 20px 24px 12px 24px;
                  border-bottom: 1px solid #f3f4f6;
                "
              >
                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  width="100%%"
                >
                  <tr>
                    <td align="left">
                      <div
                        style="
                          font-size: 13px;
                          letter-spacing: 0.08em;
                          text-transform: uppercase;
                          color: #9ca3af;
                          font-weight: 500;
                        "
                      >
                        Matic
                      </div>
                      <div
                        style="
                          margin-top: 4px;
                          font-size: 20px;
                          line-height: 1.4;
                          color: #111827;
                          font-weight: 600;
                        "
                      >
                        Workspace invitation
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding: 24px 24px 8px 24px;">
                <div
                  style="
                    font-size: 15px;
                    line-height: 1.6;
                    color: #111827;
                    margin-bottom: 12px;
                  "
                >
                  You've been invited to join the
                  <span style="font-weight: 600;">%s</span> workspace on
                  Matic.
                </div>
                <div
                  style="
                    font-size: 14px;
                    line-height: 1.6;
                    color: #4b5563;
                    margin-bottom: 24px;
                  "
                >
                  Matic helps teams collect, organize, and review data using
                  structured forms and review workflows, so your whole team
                  can work from the same source of truth.
                </div>

                <!-- Primary CTA -->
                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  width="100%%"
                  style="margin: 0 0 20px 0;"
                >
                  <tr>
                    <td align="center">
                      <a
                        href="%s"
                        style="
                          display: inline-block;
                          padding: 12px 20px;
                          border-radius: 999px;
                          background-color: #111827;
                          color: #ffffff;
                          font-size: 14px;
                          font-weight: 500;
                          text-decoration: none;
                          text-align: center;
                        "
                      >
                        Accept invitation
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Fallback link -->
                <div
                  style="
                    font-size: 12px;
                    line-height: 1.6;
                    color: #6b7280;
                    margin-bottom: 4px;
                  "
                >
                  If the button does not work, copy and paste this link into
                  your browser:
                </div>
                <div
                  style="
                    font-size: 12px;
                    line-height: 1.6;
                    color: #111827;
                    word-break: break-all;
                  "
                >
                  <a
                    href="%s"
                    style="color: #111827; text-decoration: underline;"
                  >
                    %s
                  </a>
                </div>
              </td>
            </tr>

            <!-- Meta -->
            <tr>
              <td
                style="
                  padding: 16px 24px 20px 24px;
                  border-top: 1px solid #f3f4f6;
                "
              >
                <div
                  style="
                    font-size: 12px;
                    line-height: 1.5;
                    color: #6b7280;
                    margin-bottom: 4px;
                  "
                >
                  This invitation will expire in 7 days.
                </div>
                <div
                  style="
                    font-size: 12px;
                    line-height: 1.5;
                    color: #9ca3af;
                  "
                >
                  You're receiving this email because someone added you to a
                  workspace in Matic.
                </div>
              </td>
            </tr>
          </table>

          <!-- Footer -->
          <table
            role="presentation"
            cellspacing="0"
            cellpadding="0"
            border="0"
            width="100%%"
            style="max-width: 560px; margin-top: 12px;"
          >
            <tr>
              <td
                align="center"
                style="
                  font-size: 11px;
                  line-height: 1.6;
                  color: #9ca3af;
                "
              >
                Powered by
                <a
                  href="https://maticsapp.com"
                  style="
                    color: #6b7280;
                    text-decoration: underline;
                  "
                  >Matic</a
                >
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`, workspaceName, inviteURL, inviteURL, inviteURL)

	// Plain text fallback
	textBody := fmt.Sprintf(`You're invited to join \"%s\" on Matic!

You've been invited to collaborate in the %s workspace. Matic helps teams collect, organize, and review data with powerful forms and workflows.

To accept your invitation and set up your account, visit:
%s

This invitation will expire in 7 days.

Powered by Matic - https://maticsapp.com`, workspaceName, workspaceName, inviteURL)

	// Send directly via Resend API using global key
	resendURL := "https://api.resend.com/emails"

	// Get sender name from portal settings or workspace name
	senderName := workspaceName

	// Try to extract portal name from workspace settings
	var settings map[string]interface{}
	if err := json.Unmarshal(workspace.Settings, &settings); err == nil {
		if portalName, ok := settings["name"].(string); ok && portalName != "" {
			senderName = portalName
		}
	}

	// Get email address from environment or use default
	emailAddress := "hello@notifications.maticsapp.com"
	if envEmail := os.Getenv("EMAIL_FROM"); envEmail != "" {
		// Extract email from "Name <email@domain.com>" format
		if strings.Contains(envEmail, "<") && strings.Contains(envEmail, ">") {
			startIdx := strings.Index(envEmail, "<") + 1
			endIdx := strings.Index(envEmail, ">")
			emailAddress = envEmail[startIdx:endIdx]
		} else {
			// If no brackets, assume it's just the email
			emailAddress = strings.TrimSpace(envEmail)
		}
	}

	// Format as "Portal Name <email@domain.com>"
	emailFrom := fmt.Sprintf("%s <%s>", senderName, emailAddress)

	// Get reply-to email from portal settings or use default
	replyToEmail := "support@maticsapp.com"
	if emailSettings, ok := settings["emailSettings"].(map[string]interface{}); ok {
		if replyTo, ok := emailSettings["replyToEmail"].(string); ok && replyTo != "" {
			replyToEmail = replyTo
		}
	}

	payload := map[string]interface{}{
		"from":     emailFrom,
		"reply_to": replyToEmail,
		"to":       []string{email},
		"subject":  subject,
		"text":     textBody,
		"html":     htmlBody,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		log.Printf("⚠️ Failed to marshal email payload: %v", err)
		return err
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", resendURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		log.Printf("⚠️ Failed to create HTTP request: %v", err)
		return err
	}

	req.Header.Set("Authorization", "Bearer "+globalResendKey)
	req.Header.Set("Content-Type", "application/json")

	// Send the request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("⚠️ Failed to send HTTP request to Resend: %v", err)
		return err
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Printf("⚠️ Failed to read response body: %v", err)
		return err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("⚠️ Resend API returned error (status %d): %s", resp.StatusCode, string(respBody))
		return fmt.Errorf("resend API error: %d - %s", resp.StatusCode, string(respBody))
	}

	// Parse response to get message ID
	var resendResponse map[string]interface{}
	if err := json.Unmarshal(respBody, &resendResponse); err == nil {
		if messageID, ok := resendResponse["id"].(string); ok {
			log.Printf("✅ Invitation email sent to %s via Resend (MessageID: %s)", email, messageID)
		} else {
			log.Printf("✅ Invitation email sent to %s via Resend", email)
		}
	} else {
		log.Printf("✅ Invitation email sent to %s via Resend", email)
	}

	return nil
}
