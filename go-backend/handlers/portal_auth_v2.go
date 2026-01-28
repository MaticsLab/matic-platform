package handlers

import (
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/crypto/scrypt"
)

// verifyScryptPassword verifies a password against Better Auth's scrypt hash format
// Better Auth stores passwords as: base64(salt):base64(hash)
func verifyScryptPassword(storedPassword, inputPassword string) bool {
	parts := strings.Split(storedPassword, ":")
	if len(parts) != 2 {
		return false
	}

	salt, err := base64.StdEncoding.DecodeString(parts[0])
	if err != nil {
		return false
	}

	storedHash, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return false
	}

	// Better Auth uses N=16384, r=8, p=1, keyLen=64
	derivedKey, err := scrypt.Key([]byte(inputPassword), salt, 16384, 8, 1, 64)
	if err != nil {
		return false
	}

	return subtle.ConstantTimeCompare(derivedKey, storedHash) == 1
}

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

	// Verify password - try scrypt first (Better Auth format), then bcrypt (legacy)
	passwordValid := false
	if strings.Contains(account.Password, ":") {
		// Better Auth scrypt format: base64(salt):base64(hash)
		passwordValid = verifyScryptPassword(account.Password, req.Password)
	} else {
		// Legacy bcrypt format
		if err := bcrypt.CompareHashAndPassword([]byte(account.Password), []byte(req.Password)); err == nil {
			passwordValid = true
		}
	}

	if !passwordValid {
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

	// PERFORMANCE OPTIMIZATION: Use JOIN instead of N+1 query loop
	// Single query with JOIN to get submissions + form names
	type EnrichedSubmission struct {
		models.ApplicationSubmission
		FormName string `json:"form_name"`
	}

	var results []EnrichedSubmission
	if err := database.DB.Table("application_submissions").
		Select("application_submissions.*, data_tables.name as form_name").
		Joins("LEFT JOIN data_tables ON application_submissions.form_id = data_tables.id").
		Where("application_submissions.user_id = ?", userID).
		Order("application_submissions.updated_at DESC").
		Scan(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
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

// ==================== SYNC ENDPOINT ====================

// PortalSyncBetterAuthApplicantRequest for syncing Better Auth users with form submissions
type PortalSyncBetterAuthApplicantRequest struct {
	FormID           string `json:"form_id" binding:"required"`
	Email            string `json:"email" binding:"required,email"`
	BetterAuthUserID string `json:"better_auth_user_id" binding:"required"`
	Name             string `json:"name"`
	FirstName        string `json:"first_name"`
	LastName         string `json:"last_name"`
}

// PortalSyncBetterAuthApplicant syncs a Better Auth user with form submissions
// This checks for existing submissions and returns the user's form status
// It uses the NEW v2 form_submissions system, not the legacy portal_applicants
// POST /api/v1/portal/sync-better-auth-applicant
func PortalSyncBetterAuthApplicant(c *gin.Context) {
	var req PortalSyncBetterAuthApplicantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse form ID - this can be a data_table ID or a forms (v2) ID
	formUUID, err := uuid.Parse(req.FormID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form_id"})
		return
	}

	// First, check if this is a v2 Form (new system)
	var v2Form models.Form
	err = database.DB.Where("id = ?", formUUID).First(&v2Form).Error

	if err == nil {
		// It's a v2 Form! Use the new form_submissions system
		fmt.Printf("📋 Syncing Better Auth user %s with v2 form %s\n", req.BetterAuthUserID, req.FormID)

		// Check for existing submission by this user
		var submission models.FormSubmission
		err = database.DB.Where("form_id = ? AND user_id = ?", formUUID, req.BetterAuthUserID).First(&submission).Error

		if err == nil {
			// Submission exists - return it
			fmt.Printf("✅ Found existing v2 submission for user %s on form %s\n", req.BetterAuthUserID, req.FormID)
			c.JSON(http.StatusOK, gin.H{
				"id":                    submission.ID,
				"email":                 req.Email,
				"name":                  req.Name,
				"form_id":               submission.FormID,
				"submission_id":         submission.ID,
				"status":                submission.Status,
				"completion_percentage": submission.CompletionPercentage,
				"synced":                true,
				"v2":                    true,
			})
			return
		}

		// No submission yet - return that user is synced but hasn't started
		c.JSON(http.StatusOK, gin.H{
			"id":                    req.BetterAuthUserID,
			"email":                 req.Email,
			"name":                  req.Name,
			"form_id":               formUUID,
			"submission_id":         nil,
			"status":                "not_started",
			"completion_percentage": 0,
			"synced":                true,
			"v2":                    true,
		})
		return
	}

	// Not a v2 Form - check if it's a legacy data_table
	var table models.Table
	if err := database.DB.First(&table, "id = ?", formUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	// It's a legacy table-based form
	// Check for existing row by email in the table
	fmt.Printf("📋 Syncing Better Auth user %s with legacy form (table) %s\n", req.BetterAuthUserID, req.FormID)

	var row models.Row
	// Look for email in multiple possible locations
	err = database.DB.Where("table_id = ?", formUUID).
		Where("data->>'_applicant_email' = ? OR data->>'email' = ? OR data->>'Email' = ? OR data->'personal'->>'personalEmail' = ?",
			req.Email, req.Email, req.Email, req.Email).
		First(&row).Error

	if err == nil {
		// Found existing row/submission
		status := "in_progress"
		var metadata map[string]interface{}
		if row.Metadata != nil {
			json.Unmarshal(row.Metadata, &metadata)
			if s, ok := metadata["status"].(string); ok {
				status = s
			}
		}

		// Parse row data for submission_data
		var submissionData map[string]interface{}
		if row.Data != nil {
			json.Unmarshal(row.Data, &submissionData)
		}

		fmt.Printf("✅ Found existing legacy submission (row) for %s on form %s\n", req.Email, req.FormID)
		c.JSON(http.StatusOK, gin.H{
			"id":              req.BetterAuthUserID,
			"email":           req.Email,
			"name":            req.Name,
			"form_id":         formUUID,
			"row_id":          row.ID,
			"status":          status,
			"submission_data": submissionData,
			"synced":          true,
			"v2":              false,
		})
		return
	}

	// No existing submission
	c.JSON(http.StatusOK, gin.H{
		"id":      req.BetterAuthUserID,
		"email":   req.Email,
		"name":    req.Name,
		"form_id": formUUID,
		"row_id":  nil,
		"status":  "not_started",
		"synced":  true,
		"v2":      false,
	})
}

// ==================== HELPERS ====================

func toJSONArray(arr []string) string {
	bytes, _ := json.Marshal(arr)
	return string(bytes)
}
