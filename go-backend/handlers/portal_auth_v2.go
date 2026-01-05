package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ==================== REQUEST TYPES ====================

// PortalSignupV2Request for creating a new applicant account using Better Auth
type PortalSignupV2Request struct {
	FormID   string `json:"form_id" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	FullName string `json:"full_name"`
}

// PortalLoginV2Request for logging in as applicant
type PortalLoginV2Request struct {
	FormID   string `json:"form_id" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// PortalUserResponse is the response for authenticated applicant
type PortalUserResponse struct {
	ID           string     `json:"id"`
	Email        string     `json:"email"`
	Name         string     `json:"name"`
	UserType     string     `json:"user_type"`
	FormsApplied []string   `json:"forms_applied"`
	SessionToken string     `json:"session_token,omitempty"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
}

// ==================== HANDLERS ====================

// PortalSignupV2 creates a new applicant account using Better Auth tables
// POST /api/v1/portal/v2/signup
func PortalSignupV2(c *gin.Context) {
	var req PortalSignupV2Request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if form exists
	var table models.Table
	if err := database.DB.First(&table, "id = ?", req.FormID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	// Check if user already exists in ba_users
	var existingUser struct {
		ID       string `gorm:"column:id"`
		Metadata []byte `gorm:"column:metadata"`
	}

	err := database.DB.Raw("SELECT id, metadata FROM ba_users WHERE email = ?", req.Email).Scan(&existingUser).Error

	if err == nil && existingUser.ID != "" {
		// User exists - check if they've already applied to this form
		var metadata map[string]interface{}
		json.Unmarshal(existingUser.Metadata, &metadata)

		formsApplied, _ := metadata["forms_applied"].([]interface{})
		for _, f := range formsApplied {
			if f.(string) == req.FormID {
				c.JSON(http.StatusConflict, gin.H{
					"error":   "You already have an account for this application",
					"user_id": existingUser.ID,
					"action":  "login",
				})
				return
			}
		}

		// Add this form to their applied forms
		err = database.DB.Exec(`
			UPDATE ba_users 
			SET metadata = jsonb_set(
				COALESCE(metadata, '{}'::jsonb),
				'{forms_applied}',
				COALESCE(metadata->'forms_applied', '[]'::jsonb) || $1::jsonb
			),
			updated_at = NOW()
			WHERE id = $2
		`, fmt.Sprintf(`["%s"]`, req.FormID), existingUser.ID).Error

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
			return
		}

		// User exists but hasn't applied to this form - they should login
		c.JSON(http.StatusOK, gin.H{
			"message":  "Account exists. Please login with your existing password.",
			"user_id":  existingUser.ID,
			"action":   "login",
			"existing": true,
		})
		return
	}

	// Create new Better Auth user
	userID := uuid.New().String()
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	tx := database.DB.Begin()

	// Create ba_user with applicant type
	metadata := map[string]interface{}{
		"forms_applied": []string{req.FormID},
	}
	metadataBytes, _ := json.Marshal(metadata)

	if err := tx.Exec(`
		INSERT INTO ba_users (id, email, name, user_type, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, 'applicant', $4, NOW(), NOW())
	`, userID, req.Email, req.FullName, metadataBytes).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user: " + err.Error()})
		return
	}

	// Create ba_account for credential (password) auth
	accountID := uuid.New().String()
	if err := tx.Exec(`
		INSERT INTO ba_accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
		VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())
	`, accountID, req.Email, userID, string(hashedPassword)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create account: " + err.Error()})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	fmt.Printf("✅ Created new applicant: %s (%s) for form %s\n", userID, req.Email, req.FormID)

	c.JSON(http.StatusCreated, PortalUserResponse{
		ID:           userID,
		Email:        req.Email,
		Name:         req.FullName,
		UserType:     "applicant",
		FormsApplied: []string{req.FormID},
	})
}

// PortalLoginV2 authenticates an applicant and returns session
// POST /api/v1/portal/v2/login
func PortalLoginV2(c *gin.Context) {
	var req PortalLoginV2Request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find user
	var user struct {
		ID       string `gorm:"column:id"`
		Email    string `gorm:"column:email"`
		Name     string `gorm:"column:name"`
		UserType string `gorm:"column:user_type"`
		Metadata []byte `gorm:"column:metadata"`
	}

	if err := database.DB.Raw("SELECT id, email, name, user_type, metadata FROM ba_users WHERE email = ?", req.Email).Scan(&user).Error; err != nil || user.ID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Get password from ba_accounts
	var account struct {
		Password string `gorm:"column:password"`
	}

	if err := database.DB.Raw("SELECT password FROM ba_accounts WHERE user_id = ? AND provider_id = 'credential'", user.ID).Scan(&account).Error; err != nil || account.Password == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(account.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Parse metadata
	var metadata map[string]interface{}
	json.Unmarshal(user.Metadata, &metadata)

	// Check if user has access to this form
	formsApplied := []string{}
	if fa, ok := metadata["forms_applied"].([]interface{}); ok {
		for _, f := range fa {
			formsApplied = append(formsApplied, f.(string))
		}
	}

	// Add form to applied forms if not already
	formFound := false
	for _, f := range formsApplied {
		if f == req.FormID {
			formFound = true
			break
		}
	}

	if !formFound {
		formsApplied = append(formsApplied, req.FormID)
		database.DB.Exec(`
			UPDATE ba_users 
			SET metadata = jsonb_set(
				COALESCE(metadata, '{}'::jsonb),
				'{forms_applied}',
				$1::jsonb
			),
			updated_at = NOW()
			WHERE id = $2
		`, toJSONArray(formsApplied), user.ID)
	}

	// Create session
	sessionID := uuid.New().String()
	sessionToken := uuid.New().String()
	expiresAt := time.Now().Add(7 * 24 * time.Hour) // 7 days

	if err := database.DB.Exec(`
		INSERT INTO ba_sessions (id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
	`, sessionID, user.ID, sessionToken, expiresAt, c.ClientIP(), c.Request.UserAgent()).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}

	fmt.Printf("✅ Applicant logged in: %s (%s)\n", user.ID, req.Email)

	c.JSON(http.StatusOK, PortalUserResponse{
		ID:           user.ID,
		Email:        user.Email,
		Name:         user.Name,
		UserType:     user.UserType,
		FormsApplied: formsApplied,
		SessionToken: sessionToken,
		ExpiresAt:    &expiresAt,
	})
}

// PortalGetMeV2 returns current authenticated applicant info
// GET /api/v1/portal/v2/me
func PortalGetMeV2(c *gin.Context) {
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	var user struct {
		ID       string `gorm:"column:id"`
		Email    string `gorm:"column:email"`
		Name     string `gorm:"column:name"`
		UserType string `gorm:"column:user_type"`
		Metadata []byte `gorm:"column:metadata"`
	}

	if err := database.DB.Raw("SELECT id, email, name, user_type, metadata FROM ba_users WHERE id = ?", userID).Scan(&user).Error; err != nil || user.ID == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var metadata map[string]interface{}
	json.Unmarshal(user.Metadata, &metadata)

	formsApplied := []string{}
	if fa, ok := metadata["forms_applied"].([]interface{}); ok {
		for _, f := range fa {
			formsApplied = append(formsApplied, f.(string))
		}
	}

	c.JSON(http.StatusOK, PortalUserResponse{
		ID:           user.ID,
		Email:        user.Email,
		Name:         user.Name,
		UserType:     user.UserType,
		FormsApplied: formsApplied,
	})
}

// PortalLogoutV2 logs out the current session
// POST /api/v1/portal/v2/logout
func PortalLogoutV2(c *gin.Context) {
	// Get token from header
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
		return
	}

	// Extract token (Bearer <token>)
	token := authHeader
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		token = authHeader[7:]
	}

	// Delete session
	database.DB.Exec("DELETE FROM ba_sessions WHERE token = ?", token)

	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

// GetApplicantSubmissions gets all submissions for the authenticated applicant
// GET /api/v1/portal/v2/submissions
func GetApplicantSubmissions(c *gin.Context) {
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	var submissions []models.ApplicationSubmission
	if err := database.DB.Where("user_id = ?", userID).Order("updated_at DESC").Find(&submissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Enrich with form info
	type EnrichedSubmission struct {
		models.ApplicationSubmission
		FormName string `json:"form_name"`
	}

	results := make([]EnrichedSubmission, len(submissions))
	for i, s := range submissions {
		results[i] = EnrichedSubmission{ApplicationSubmission: s}

		var table models.Table
		if database.DB.First(&table, "id = ?", s.FormID).Error == nil {
			results[i].FormName = table.Name
		}
	}

	c.JSON(http.StatusOK, results)
}

// ==================== MIDDLEWARE ====================

// PortalAuthMiddlewareV2 validates Better Auth session token
func PortalAuthMiddlewareV2() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next() // Allow unauthenticated requests to pass through
			return
		}

		// Extract token
		token := authHeader
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		}

		// Validate session
		var session struct {
			UserID    string    `gorm:"column:user_id"`
			ExpiresAt time.Time `gorm:"column:expires_at"`
		}

		err := database.DB.Raw("SELECT user_id, expires_at FROM ba_sessions WHERE token = ?", token).Scan(&session).Error
		if err != nil || session.UserID == "" {
			c.Next() // Invalid token, continue without auth
			return
		}

		// Check expiration
		if time.Now().After(session.ExpiresAt) {
			// Session expired, delete it
			database.DB.Exec("DELETE FROM ba_sessions WHERE token = ?", token)
			c.Next()
			return
		}

		// Set user_id in context
		c.Set("user_id", session.UserID)
		c.Next()
	}
}

// ==================== HELPERS ====================

func toJSONArray(arr []string) string {
	bytes, _ := json.Marshal(arr)
	return string(bytes)
}
