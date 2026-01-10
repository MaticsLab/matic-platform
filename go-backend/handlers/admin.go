package handlers

import (
	"fmt"
	"net/http"
	"strings"

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

	// Check if requesting Better Auth users (ba_users) or legacy auth.users
	// Check both query parameter and form value for flexibility
	queryType := c.Query("type")
	if queryType == "" {
		// Also check if it's in the form data
		queryType = c.PostForm("type")
	}
	// Normalize to lowercase for case-insensitive matching
	queryType = strings.ToLower(queryType)
	useBetterAuth := queryType == "better_auth" || queryType == "ba" || queryType == "betterauth"

	// Debug logging
	fmt.Printf("🔍 ListAuthUsers: queryType=%s, useBetterAuth=%v, requestingUserID=%s, URL=%s\n",
		queryType, useBetterAuth, requestingUserID, c.Request.URL.String())

	if useBetterAuth {
		// For Better Auth users (CRM), we want to show only portal users (applicants)
		// These are users who created accounts through applicant portals
		// Since this is for CRM (client relationship management), we should allow
		// any authenticated Better Auth user to view the list, not just workspace members
		// This makes sense because CRM users might not be workspace members yet

		// Verify the user exists in ba_users (basic auth check)
		var userExists bool
		userCheckErr := database.DB.Raw("SELECT EXISTS(SELECT 1 FROM ba_users WHERE id = ?)", requestingUserID).Scan(&userExists).Error

		fmt.Printf("🔍 Better Auth user check: userExists=%v, userCheckErr=%v, requestingUserID=%s\n", userExists, userCheckErr, requestingUserID)

		if userCheckErr != nil || !userExists {
			c.JSON(http.StatusForbidden, gin.H{"error": "Invalid user"})
			return
		}

		// Get all portal applicants from portal_applicants table
		// For CRM, we want to show users who created accounts through portals
		// Note: portal_applicants can have multiple entries per email (one per form)
		// We'll deduplicate by email, showing the most recent entry per email
		type BetterAuthUser struct {
			ID         string  `json:"id"`
			Email      string  `json:"email"`
			Name       string  `json:"name"`
			FullName   *string `json:"full_name,omitempty"`
			AvatarURL  *string `json:"avatar_url,omitempty"`
			UserType   string  `json:"user_type"`
			CreatedAt  string  `json:"created_at"`
			UpdatedAt  string  `json:"updated_at"`
			LastSignIn *string `json:"last_sign_in_at,omitempty"`
		}

		// First, let's check if the table exists and has data
		var count int64
		countErr := database.DB.Raw("SELECT COUNT(*) FROM portal_applicants").Scan(&count).Error
		if countErr != nil {
			fmt.Printf("❌ Error counting portal applicants: %v\n", countErr)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count portal applicants: " + countErr.Error()})
			return
		}
		fmt.Printf("📊 Total portal applicants in table: %d\n", count)

		var users []BetterAuthUser
		queryErr := database.DB.Raw(`
			SELECT DISTINCT ON (email)
				id::text as id,
				email,
				COALESCE(full_name, email) as name,
				full_name,
				NULL::text as avatar_url,
				'applicant' as user_type,
				created_at::text as created_at,
				updated_at::text as updated_at,
				last_login_at::text as last_sign_in_at
			FROM portal_applicants
			ORDER BY email, created_at DESC
		`).Scan(&users).Error

		if queryErr != nil {
			fmt.Printf("❌ Error fetching portal applicants: %v\n", queryErr)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch portal applicants: " + queryErr.Error()})
			return
		}

		fmt.Printf("✅ Fetched %d portal applicants from portal_applicants table\n", len(users))
		if len(users) > 0 {
			fmt.Printf("📝 First user: %+v\n", users[0])
		}

		// Ensure we always return an array, not null
		if users == nil {
			users = []BetterAuthUser{}
		}

		c.JSON(http.StatusOK, users)
		return
	}

	// For legacy auth.users, require owner role
	var isOwner bool
	err := database.DB.Raw(`
		SELECT EXISTS (
			SELECT 1 FROM workspace_members 
			WHERE (user_id::text = ? OR ba_user_id = ?) AND role = 'owner' AND status = 'active'
		)
	`, requestingUserID, requestingUserID).Scan(&isOwner).Error

	if err != nil || !isOwner {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	// Get all users from auth.users (legacy Supabase)
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
