package handlers

import (
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// DeleteUserRequest represents the request to delete a user
type DeleteUserRequest struct {
	UserID         string  `json:"user_id" binding:"required"`
	ReassignToUser *string `json:"reassign_to_user_id"` // Optional: reassign data to this user instead of deleting
}

// DeleteUser deletes a user and all associated data using the database function
// Only workspace owners/admins can delete users
func DeleteUser(c *gin.Context) {
	// Get the requesting user
	requestingUserID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req DeleteUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	targetUserID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Prevent self-deletion
	if targetUserID.String() == requestingUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You cannot delete your own account"})
		return
	}

	// Check if requesting user is an owner of any workspace the target user belongs to
	var isOwner bool
	err = database.DB.Raw(`
		SELECT EXISTS (
			SELECT 1 FROM workspace_members wm1
			JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
			WHERE wm1.user_id = ? AND wm1.role = 'owner' AND wm1.status = 'active'
			AND wm2.user_id = ?
		)
	`, requestingUserID, targetUserID).Scan(&isOwner).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify permissions"})
		return
	}

	if !isOwner {
		c.JSON(http.StatusForbidden, gin.H{"error": "You must be a workspace owner to delete users"})
		return
	}

	// Call the database function to delete the user
	var result string
	if req.ReassignToUser != nil && *req.ReassignToUser != "" {
		reassignID, err := uuid.Parse(*req.ReassignToUser)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid reassign user ID"})
			return
		}
		err = database.DB.Raw("SELECT delete_user_cascade(?, ?)", targetUserID, reassignID).Scan(&result).Error
	} else {
		err = database.DB.Raw("SELECT delete_user_cascade(?)", targetUserID).Scan(&result).Error
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": result})
}

// ListAuthUsers lists all users in auth.users (admin only)
func ListAuthUsers(c *gin.Context) {
	// Get the requesting user
	requestingUserID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Check if user is an owner of any workspace
	var isOwner bool
	err := database.DB.Raw(`
		SELECT EXISTS (
			SELECT 1 FROM workspace_members 
			WHERE user_id = ? AND role = 'owner' AND status = 'active'
		)
	`, requestingUserID).Scan(&isOwner).Error

	if err != nil || !isOwner {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	// Get all users from auth.users
	type AuthUser struct {
		ID         string  `json:"id"`
		Email      string  `json:"email"`
		CreatedAt  string  `json:"created_at"`
		LastSignIn *string `json:"last_sign_in_at"`
	}

	var users []AuthUser
	err = database.DB.Raw(`
		SELECT id, email, created_at, last_sign_in_at
		FROM auth.users
		ORDER BY created_at DESC
	`).Scan(&users).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	c.JSON(http.StatusOK, users)
}
