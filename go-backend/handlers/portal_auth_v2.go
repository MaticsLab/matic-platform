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

// ==================== LEGACY CODE - DEPRECATED ====================
// Legacy signup/login handlers kept for backward compatibility with matic folder.
// Main platform now uses Better Auth SDK (portalBetterAuthClient.signUp.email())
// followed by sync endpoint (/portal/sync-better-auth-applicant).
// See: docs/PORTAL_MIGRATION_TO_BETTER_AUTH_SDK.md

// ==================== REQUEST TYPES ====================

// ==================== LEGACY HANDLERS - DEPRECATED ====================
// These are kept for backward compatibility with matic folder only.
// Main platform uses Better Auth SDK (portalBetterAuthClient.signUp.email())
// followed by sync endpoint (/portal/sync-better-auth-applicant).

// PortalSignupV2 creates a new applicant account using Better Auth tables
// DEPRECATED: Use Better Auth SDK instead (see PublicPortalV2.tsx)
// POST /api/v1/portal/v2/signup
func PortalSignupV2(c *gin.Context) {
	type PortalSignupV2Request struct {
		FormID   string `json:"form_id" binding:"required"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=8"`
		FullName string `json:"full_name"`
	}
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

		// Get user email for portal_applicants
		var userEmail string
		database.DB.Raw("SELECT email FROM ba_users WHERE id = ?", existingUser.ID).Scan(&userEmail)

		// Check for existing orphaned submission for this user/form by email
		var existingRow struct {
			ID string `gorm:"column:id"`
		}
		database.DB.Raw(`
			SELECT tr.id 
			FROM table_rows tr
			WHERE tr.table_id = $1
			AND tr.ba_created_by IS NULL
			AND (
				tr.data->'personal'->>'personalEmail' = $2
				OR tr.data->'personal'->>'email' = $2
				OR tr.data->>'email' = $2
			)
			LIMIT 1
		`, req.FormID, req.Email).Scan(&existingRow)

		var rowID string
		if existingRow.ID != "" {
			// Link existing orphaned submission to this existing user
			rowID = existingRow.ID
			if err := database.DB.Exec(`
				UPDATE table_rows
				SET ba_created_by = $1, ba_updated_by = $1, updated_at = NOW()
				WHERE id = $2
			`, existingUser.ID, rowID).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to link existing submission"})
				return
			}
			fmt.Printf("🔗 Linked existing submission %s to existing user %s\n", rowID, existingUser.ID)
		} else {
			// Create new table_row for the form submission
			rowID = uuid.New().String()
			initialData := map[string]interface{}{
				"status":                "not_started",
				"completion_percentage": 0,
				"ba_user_id":            existingUser.ID,
				"applicant_email":       userEmail,
			}
			rowMetadata, _ := json.Marshal(initialData)

			if err := database.DB.Exec(`
				INSERT INTO table_rows (id, table_id, data, metadata, created_at, updated_at)
				VALUES ($1, $2, '{}'::jsonb, $3, NOW(), NOW())
			`, rowID, req.FormID, rowMetadata).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create form submission"})
				return
			}
			fmt.Printf("📝 Created new submission %s for existing user %s\n", rowID, existingUser.ID)
		}

		// Create portal_applicants record for this new form application
		portalApplicantID := uuid.New().String()
		if err := database.DB.Exec(`
			INSERT INTO portal_applicants (id, ba_user_id, form_id, email, row_id, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		`, portalApplicantID, existingUser.ID, req.FormID, userEmail, rowID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create portal applicant record"})
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
	// Use bcrypt for legacy support (Better Auth SDK uses scrypt automatically)
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

	// Check for existing orphaned submission for this user/form by email
	var existingRow struct {
		ID string `gorm:"column:id"`
	}
	tx.Raw(`
		SELECT tr.id 
		FROM table_rows tr
		WHERE tr.table_id = $1
		AND tr.ba_created_by IS NULL
		AND (
			tr.data->'personal'->>'personalEmail' = $2
			OR tr.data->'personal'->>'email' = $2
			OR tr.data->>'email' = $2
		)
		LIMIT 1
	`, req.FormID, req.Email).Scan(&existingRow)

	var rowID string
	if existingRow.ID != "" {
		// Link existing orphaned submission to this new user
		rowID = existingRow.ID
		if err := tx.Exec(`
			UPDATE table_rows
			SET ba_created_by = $1, ba_updated_by = $1, updated_at = NOW()
			WHERE id = $2
		`, userID, rowID).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to link existing submission: " + err.Error()})
			return
		}
		fmt.Printf("🔗 Linked existing submission %s to new user %s\n", rowID, userID)
	} else {
		// Create new table_row for the form submission
		rowID = uuid.New().String()
		initialData := map[string]interface{}{
			"status":                "not_started",
			"completion_percentage": 0,
			"ba_user_id":            userID,
			"applicant_email":       req.Email,
			"applicant_name":        req.FullName,
		}
		rowMetadata, _ := json.Marshal(initialData)

		if err := tx.Exec(`
			INSERT INTO table_rows (id, table_id, data, metadata, created_at, updated_at)
			VALUES ($1, $2, '{}'::jsonb, $3, NOW(), NOW())
		`, rowID, req.FormID, rowMetadata).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create form submission: " + err.Error()})
			return
		}
		fmt.Printf("📝 Created new submission %s for user %s\n", rowID, userID)
	}

	// Create portal_applicants record linking user to form and their table_row
	portalApplicantID := uuid.New().String()
	if err := tx.Exec(`
		INSERT INTO portal_applicants (id, ba_user_id, form_id, email, row_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
	`, portalApplicantID, userID, req.FormID, req.Email, rowID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create portal applicant record: " + err.Error()})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	fmt.Printf("✅ Created new applicant: %s (%s) for form %s\n", userID, req.Email, req.FormID)

	c.JSON(http.StatusCreated, gin.H{
		"id":            userID,
		"email":         req.Email,
		"name":          req.FullName,
		"user_type":     "applicant",
		"forms_applied": []string{req.FormID},
	})
}

// PortalLoginV2 authenticates an applicant and returns session
// DEPRECATED: Login now handled by Better Auth (/api/portal-auth/sign-in)
// POST /api/v1/portal/v2/login
func PortalLoginV2(c *gin.Context) {
	type PortalLoginV2Request struct {
		FormID   string `json:"form_id" binding:"required"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}
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

	// Verify password using bcrypt (legacy support only)
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

		// Check for existing orphaned submission for this user/form by email
		var existingRow struct {
			ID string `gorm:"column:id"`
		}
		database.DB.Raw(`
			SELECT tr.id 
			FROM table_rows tr
			WHERE tr.table_id = $1
			AND tr.ba_created_by IS NULL
			AND (
				tr.data->'personal'->>'personalEmail' = $2
				OR tr.data->'personal'->>'email' = $2
				OR tr.data->>'email' = $2
			)
			LIMIT 1
		`, req.FormID, user.Email).Scan(&existingRow)

		if existingRow.ID != "" {
			// Link existing orphaned submission to this user
			if err := database.DB.Exec(`
				UPDATE table_rows
				SET ba_created_by = $1, ba_updated_by = $1, updated_at = NOW()
				WHERE id = $2
			`, user.ID, existingRow.ID).Error; err == nil {
				fmt.Printf("🔗 Linked existing submission %s to logged-in user %s\n", existingRow.ID, user.ID)
			}
		}
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

	c.JSON(http.StatusOK, gin.H{
		"id":            user.ID,
		"email":         user.Email,
		"name":          user.Name,
		"user_type":     user.UserType,
		"forms_applied": formsApplied,
		"session_token": sessionToken,
		"expires_at":    &expiresAt,
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

	c.JSON(http.StatusOK, gin.H{
		"id":            user.ID,
		"email":         user.Email,
		"name":          user.Name,
		"user_type":     user.UserType,
		"forms_applied": formsApplied,
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

	// Query form_submissions (new unified schema)
	type EnrichedSubmission struct {
		ID                   uuid.UUID  `json:"id"`
		FormID               uuid.UUID  `json:"form_id"`
		FormName             string     `json:"form_name"`
		Status               string     `json:"status"`
		CompletionPercentage int        `json:"completion_percentage"`
		SubmittedAt          *time.Time `json:"submitted_at"`
		LastSavedAt          time.Time  `json:"last_saved_at"`
		CreatedAt            time.Time  `json:"created_at"`
		UpdatedAt            time.Time  `json:"updated_at"`
	}

	var results []EnrichedSubmission
	if err := database.DB.Table("form_submissions").
		Select("form_submissions.id, form_submissions.form_id, forms.name as form_name, form_submissions.status, form_submissions.completion_percentage, form_submissions.submitted_at, form_submissions.last_saved_at, form_submissions.created_at, form_submissions.updated_at").
		Joins("LEFT JOIN forms ON form_submissions.form_id = forms.id").
		Where("form_submissions.user_id = ?", userID).
		Order("form_submissions.updated_at DESC").
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
		// Allow OPTIONS preflight requests to pass through without auth
		if c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

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
	// Check for existing portal_applicants record first
	fmt.Printf("📋 Syncing Better Auth user %s with legacy form (table) %s\n", req.BetterAuthUserID, req.FormID)

	var portalApplicant struct {
		ID    string `gorm:"column:id"`
		RowID string `gorm:"column:row_id"`
		Email string `gorm:"column:email"`
	}

	err = database.DB.Raw(`
		SELECT id, row_id, email 
		FROM portal_applicants 
		WHERE ba_user_id = ? AND form_id = ?
	`, req.BetterAuthUserID, formUUID).Scan(&portalApplicant).Error

	if err == nil && portalApplicant.ID != "" {
		// Found existing portal_applicants record - get the associated row
		var row models.Row
		if portalApplicant.RowID != "" {
			database.DB.First(&row, "id = ?", portalApplicant.RowID)
		}

		status := "not_started"
		var submissionData map[string]interface{}

		if row.ID != uuid.Nil {
			status = "in_progress"
			var metadata map[string]interface{}
			if row.Metadata != nil {
				json.Unmarshal(row.Metadata, &metadata)
				if s, ok := metadata["status"].(string); ok {
					status = s
				}
			}

			if row.Data != nil {
				json.Unmarshal(row.Data, &submissionData)
			}
		}

		fmt.Printf("✅ Found existing portal_applicants record for user %s on form %s\n", req.BetterAuthUserID, req.FormID)
		c.JSON(http.StatusOK, gin.H{
			"id":              req.BetterAuthUserID,
			"email":           req.Email,
			"name":            req.Name,
			"form_id":         formUUID,
			"row_id":          portalApplicant.RowID,
			"status":          status,
			"submission_data": submissionData,
			"synced":          true,
			"v2":              false,
		})
		return
	}

	// No existing portal_applicants record - create one for new signup
	fmt.Printf("🆕 Creating new portal records for user %s on form %s\n", req.BetterAuthUserID, req.FormID)

	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Update ba_users metadata to include user_type and forms_applied
	err = tx.Exec(`
		UPDATE ba_users 
		SET 
			user_type = 'applicant',
			metadata = COALESCE(metadata, '{}'::jsonb) || 
				jsonb_build_object('forms_applied', 
					COALESCE(metadata->'forms_applied', '[]'::jsonb) || $1::jsonb
				),
			updated_at = NOW()
		WHERE id = $2
	`, fmt.Sprintf(`["%s"]`, formUUID), req.BetterAuthUserID).Error

	if err != nil {
		tx.Rollback()
		fmt.Printf("⚠️ Failed to update ba_users metadata: %v\n", err)
		// Don't fail - this is not critical
	}

	// Create table_row for the form submission
	rowID := uuid.New().String()
	initialData := map[string]interface{}{
		"status":                "not_started",
		"completion_percentage": 0,
		"ba_user_id":            req.BetterAuthUserID,
		"applicant_email":       req.Email,
		"applicant_name":        req.Name,
	}
	rowMetadata, _ := json.Marshal(initialData)

	err = tx.Exec(`
		INSERT INTO table_rows (id, table_id, data, metadata, created_at, updated_at)
		VALUES ($1, $2, '{}'::jsonb, $3, NOW(), NOW())
	`, rowID, formUUID, rowMetadata).Error

	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create form submission: " + err.Error()})
		return
	}

	// Create portal_applicants record
	portalApplicantID := uuid.New().String()
	err = tx.Exec(`
		INSERT INTO portal_applicants (id, ba_user_id, form_id, email, row_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
	`, portalApplicantID, req.BetterAuthUserID, formUUID, req.Email, rowID).Error

	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create portal applicant record: " + err.Error()})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction: " + err.Error()})
		return
	}

	fmt.Printf("✅ Created portal records for user %s: row_id=%s, portal_applicant_id=%s\n",
		req.BetterAuthUserID, rowID, portalApplicantID)

	c.JSON(http.StatusOK, gin.H{
		"id":                    req.BetterAuthUserID,
		"email":                 req.Email,
		"name":                  req.Name,
		"form_id":               formUUID,
		"row_id":                rowID,
		"status":                "not_started",
		"completion_percentage": 0,
		"synced":                true,
		"v2":                    false,
		"created":               true,
	})
}

// ==================== HELPERS ====================

func toJSONArray(arr []string) string {
	bytes, _ := json.Marshal(arr)
	return string(bytes)
}
