package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/scrypt"
)

// ApplicantCRM represents an applicant with their form submissions
type ApplicantCRM struct {
	ID                     string        `json:"id"`
	Email                  string        `json:"email"`
	Name                   *string       `json:"name"`
	UserType               string        `json:"user_type"`
	CreatedAt              string        `json:"created_at"`
	LastLoginAt            *string       `json:"last_login_at,omitempty"`
	Applications           []application `json:"applications"`
	TotalForms             int           `json:"total_forms"`
	PasswordResetRequested *string       `json:"password_reset_requested,omitempty"`
}

// FormSummary represents a form application by an applicant
type application struct {
	FormID        string  `json:"form_id"`
	FormName      string  `json:"form_name"`
	FormSlug      *string `json:"form_slug,omitempty"`
	SubmissionID  *string `json:"submission_id,omitempty"`
	Status        string  `json:"status"`
	CompletionPct int     `json:"completion_percentage"`
	SubmittedAt   *string `json:"submitted_at,omitempty"`
	LastSavedAt   *string `json:"last_saved_at,omitempty"`
	CreatedAt     string  `json:"created_at"`
}

// GetApplicantsCRM returns all applicants with their form submissions for a workspace
// GET /api/v1/crm/applicants?workspace_id=xxx
func GetApplicantsCRM(c *gin.Context) {
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

	// Check workspace access
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	if _, isMember := checkWorkspaceMembership(wsID, userID); !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this workspace"})
		return
	}

	// Query all applicants who have applied to forms in this workspace
	// Uses form_submissions to link applicants to forms (unified schema)
	type ApplicantRow struct {
		UserID                 string  `json:"user_id"`
		Email                  string  `json:"email"`
		Name                   *string `json:"name"`
		UserType               string  `json:"user_type"`
		UserCreatedAt          string  `json:"user_created_at"`
		LastLoginAt            *string `json:"last_login_at"`
		PasswordResetRequested *string `json:"password_reset_requested"`
		FormID                 string  `json:"form_id"`
		FormName               string  `json:"form_name"`
		FormSlug               *string `json:"form_slug"`
		RowID                  *string `json:"row_id"`
		SubmissionID           *string `json:"submission_id"`
		Status                 string  `json:"status"`
		CompletionPct          int     `json:"completion_pct"`
		SubmittedAt            *string `json:"submitted_at"`
		LastSavedAt            *string `json:"last_saved_at"`
		AppCreatedAt           string  `json:"app_created_at"`
	}

	var rows []ApplicantRow
	err = database.DB.Raw(`
		SELECT 
			ba.id as user_id,
			ba.email,
			ba.name,
			ba.user_type,
			ba.created_at::text as user_created_at,
			ba.updated_at::text as last_login_at,
			(ba.metadata->>'password_reset_requested')::text as password_reset_requested,
			f.id::text as form_id,
			f.name as form_name,
			f.slug as form_slug,
			fs.id::text as row_id,
			fs.id::text as submission_id,
			COALESCE(fs.status, 'not_started') as status,
			CASE 
				WHEN fs.status = 'submitted' THEN 100
				WHEN fs.status = 'draft' THEN COALESCE(
					(SELECT (COUNT(DISTINCT CASE WHEN fr.id IS NOT NULL THEN ff.id END)::float * 100 / NULLIF(COUNT(DISTINCT ff.id), 0))::int
					 FROM form_fields ff
					 LEFT JOIN form_responses fr ON fr.field_id = ff.id AND fr.submission_id = fs.id
					 WHERE ff.form_id = f.id),
					0
				)
				ELSE 0
			END as completion_pct,
			fs.submitted_at::text as submitted_at,
			fs.updated_at::text as last_saved_at,
			COALESCE(fs.created_at::text, ba.created_at::text) as app_created_at
		FROM ba_users ba
		LEFT JOIN form_submissions fs ON fs.user_id = ba.id
		LEFT JOIN forms f ON f.id = fs.form_id
		WHERE ba.user_type LIKE 'applicant%'
		  AND (f.workspace_id = ? OR f.workspace_id IS NULL OR fs.id IS NULL)
		ORDER BY ba.created_at DESC, fs.created_at DESC NULLS LAST
	`, wsID).Scan(&rows).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch applicants", "details": err.Error()})
		return
	}

	// Group by applicant
	applicantMap := make(map[string]*ApplicantCRM)
	for _, row := range rows {
		if _, exists := applicantMap[row.UserID]; !exists {
			applicantMap[row.UserID] = &ApplicantCRM{
				ID:                     row.UserID,
				Email:                  row.Email,
				Name:                   row.Name,
				UserType:               row.UserType,
				CreatedAt:              row.UserCreatedAt,
				LastLoginAt:            row.LastLoginAt,
				PasswordResetRequested: row.PasswordResetRequested,
				Applications:           []application{},
				TotalForms:             0,
			}
		}

		applicant := applicantMap[row.UserID]
		applicant.Applications = append(applicant.Applications, application{
			FormID:        row.FormID,
			FormName:      row.FormName,
			FormSlug:      row.FormSlug,
			SubmissionID:  row.SubmissionID,
			Status:        row.Status,
			CompletionPct: row.CompletionPct,
			SubmittedAt:   row.SubmittedAt,
			LastSavedAt:   row.LastSavedAt,
			CreatedAt:     row.AppCreatedAt,
		})
		applicant.TotalForms++
	}

	// Convert map to slice
	var applicants []ApplicantCRM
	for _, a := range applicantMap {
		applicants = append(applicants, *a)
	}

	c.JSON(http.StatusOK, applicants)
}

// GetApplicantDetail returns detailed information about a single applicant
// GET /api/v1/crm/applicants/:id?workspace_id=xxx
func GetApplicantDetail(c *gin.Context) {
	applicantID := c.Param("id")
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

	// Check workspace access
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	if _, isMember := checkWorkspaceMembership(wsID, userID); !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this workspace"})
		return
	}

	// Get applicant details
	type ApplicantDetail struct {
		ID            string  `json:"id"`
		Email         string  `json:"email"`
		Name          *string `json:"name"`
		UserType      string  `json:"user_type"`
		CreatedAt     string  `json:"created_at"`
		UpdatedAt     *string `json:"updated_at,omitempty"`
		EmailVerified bool    `json:"email_verified"`
		LastLoginAt   *string `json:"last_login_at,omitempty"`
	}

	var applicant ApplicantDetail
	err = database.DB.Raw(`
		SELECT 
			bu.id,
			bu.email,
			bu.name,
			bu.user_type,
			bu.created_at::text,
			bu.updated_at::text as updated_at,
			bu.email_verified,
			(
				SELECT MAX(s.created_at)::text 
				FROM ba_sessions s 
				WHERE s.user_id = bu.id
			) as last_login_at
		FROM ba_users bu
		WHERE bu.id = ? AND bu.user_type LIKE 'applicant%'
	`, applicantID).Scan(&applicant).Error

	if err != nil || applicant.ID == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Applicant not found"})
		return
	}

	// Get their applications in this workspace
	type ApplicationDetail struct {
		FormID        string                 `json:"form_id"`
		FormName      string                 `json:"form_name"`
		FormSlug      *string                `json:"form_slug,omitempty"`
		SubmissionID  *string                `json:"submission_id,omitempty"`
		Status        string                 `json:"status"`
		CompletionPct int                    `json:"completion_percentage"`
		SubmittedAt   *string                `json:"submitted_at,omitempty"`
		LastSavedAt   *string                `json:"last_saved_at,omitempty"`
		CreatedAt     string                 `json:"created_at"`
		Data          map[string]interface{} `json:"data,omitempty"`
	}

	var applications []ApplicationDetail
	err = database.DB.Raw(`
		SELECT 
			f.id::text as form_id,
			f.name as form_name,
			f.slug as form_slug,
			fs.id::text as submission_id,
			COALESCE(fs.status, 'not_started') as status,
			CASE 
				WHEN fs.status = 'submitted' THEN 100
				WHEN fs.status = 'draft' THEN COALESCE(
					(SELECT (COUNT(DISTINCT CASE WHEN fr.id IS NOT NULL THEN ff.id END)::float * 100 / NULLIF(COUNT(DISTINCT ff.id), 0))::int
					 FROM form_fields ff
					 LEFT JOIN form_responses fr ON fr.field_id = ff.id AND fr.submission_id = fs.id
					 WHERE ff.form_id = f.id),
					0
				)
				ELSE 0
			END as completion_pct,
			fs.submitted_at::text as submitted_at,
			fs.updated_at::text as last_saved_at,
			fs.created_at::text as created_at
		FROM forms f
		LEFT JOIN form_submissions fs ON fs.form_id = f.id AND fs.user_id = ?
		WHERE f.workspace_id = ?
		ORDER BY fs.created_at DESC NULLS LAST
	`, applicantID, wsID).Scan(&applications).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch applications", "details": err.Error()})
		return
	}

	// Fetch form data for each submission
	for i, app := range applications {
		if app.SubmissionID != nil {
			var responses []struct {
				FieldKey     string      `json:"field_key"`
				FieldLabel   string      `json:"field_label"`
				ValueType    string      `json:"value_type"`
				ValueText    *string     `json:"value_text"`
				ValueNumber  *float64    `json:"value_number"`
				ValueBoolean *bool       `json:"value_boolean"`
				ValueJSON    interface{} `json:"value_json"`
			}

			err = database.DB.Raw(`
				SELECT 
					fr.field_key,
					COALESCE(ff.label, ff.field_key) as field_label,
					fr.value_type,
					fr.value_text,
					fr.value_number,
					fr.value_boolean,
					fr.value_json
				FROM form_responses fr
				LEFT JOIN form_fields ff ON ff.id = fr.field_id
				WHERE fr.submission_id = ?
				ORDER BY ff.order_index NULLS LAST, fr.created_at
			`, *app.SubmissionID).Scan(&responses).Error

			if err == nil && len(responses) > 0 {
				// Convert responses to a map for easier consumption
				dataMap := make(map[string]interface{})
				for _, resp := range responses {
					var value interface{}
					switch resp.ValueType {
					case "text":
						if resp.ValueText != nil {
							value = *resp.ValueText
						}
					case "number":
						if resp.ValueNumber != nil {
							value = *resp.ValueNumber
						}
					case "boolean":
						if resp.ValueBoolean != nil {
							value = *resp.ValueBoolean
						}
					case "json":
						value = resp.ValueJSON
					}
					if value != nil {
						dataMap[resp.FieldKey] = value
					}
				}
				applications[i].Data = dataMap
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"applicant":    applicant,
		"applications": applications,
	})
}

// UpdateApplicantRequest represents the request body for updating an applicant
type UpdateApplicantRequest struct {
	Name          *string                `json:"name,omitempty"`
	Email         *string                `json:"email,omitempty"`
	EmailVerified *bool                  `json:"email_verified,omitempty"`
	UserType      *string                `json:"user_type,omitempty"`
	FullName      *string                `json:"full_name,omitempty"`
	AvatarURL     *string                `json:"avatar_url,omitempty"`
	Image         *string                `json:"image,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// UpdateApplicant updates a ba_user's information
// PATCH /api/v1/crm/applicants/:id
func UpdateApplicant(c *gin.Context) {
	applicantID := c.Param("id")
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

	// Check workspace access
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	if _, isMember := checkWorkspaceMembership(wsID, userID); !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this workspace"})
		return
	}

	// Parse request body
	var req UpdateApplicantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Find the applicant
	var applicant models.BetterAuthUser
	if err := database.DB.Where("id = ?", applicantID).First(&applicant).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Applicant not found"})
		return
	}

	// Build updates map
	updates := make(map[string]interface{})

	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Email != nil {
		updates["email"] = *req.Email
	}
	if req.EmailVerified != nil {
		updates["email_verified"] = *req.EmailVerified
	}
	if req.UserType != nil {
		updates["user_type"] = *req.UserType
	}
	if req.FullName != nil {
		updates["full_name"] = *req.FullName
	}
	if req.AvatarURL != nil {
		updates["avatar_url"] = *req.AvatarURL
	}
	if req.Image != nil {
		updates["image"] = *req.Image
	}
	if req.Metadata != nil {
		// Merge with existing metadata
		var existingMetadata map[string]interface{}
		if applicant.Metadata != nil {
			json.Unmarshal(applicant.Metadata, &existingMetadata)
		}
		if existingMetadata == nil {
			existingMetadata = make(map[string]interface{})
		}
		for k, v := range req.Metadata {
			existingMetadata[k] = v
		}
		metadataBytes, _ := json.Marshal(existingMetadata)
		updates["metadata"] = metadataBytes
	}

	// Always update updated_at
	updates["updated_at"] = time.Now()

	// Apply updates
	if len(updates) > 0 {
		if err := database.DB.Model(&applicant).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update applicant"})
			return
		}
	}

	// Fetch updated applicant
	if err := database.DB.Where("id = ?", applicantID).First(&applicant).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated applicant"})
		return
	}

	c.JSON(http.StatusOK, applicant)
}

// ImportBAUsersRequest represents the request body for importing ba_users to workspace_members
type ImportBAUsersRequest struct {
	UserType string `json:"user_type,omitempty"` // Optional filter: "applicant", "staff", "reviewer", or empty for all
	Role     string `json:"role,omitempty"`      // Role to assign: "viewer", "editor", "owner" (default: "viewer")
}

// ImportBAUsersToWorkspace imports ba_users as workspace_members
// POST /api/v1/crm/import-users?workspace_id=xxx
func ImportBAUsersToWorkspace(c *gin.Context) {
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

	// Check workspace access - must be owner or admin
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	member, isMember := checkWorkspaceMembership(wsID, userID)
	if !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this workspace"})
		return
	}

	// Check if user is owner or editor
	if member.Role != "owner" && member.Role != "editor" {
		c.JSON(http.StatusForbidden, gin.H{"error": "You must be an owner or editor to import users"})
		return
	}

	// Parse request body
	var req ImportBAUsersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Allow empty body - use defaults
		req = ImportBAUsersRequest{}
	}

	// Default role is viewer
	role := req.Role
	if role == "" {
		role = "viewer"
	}

	// Validate role
	if role != "viewer" && role != "editor" && role != "owner" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Must be 'viewer', 'editor', or 'owner'"})
		return
	}

	// Get all ba_users, optionally filtered by user_type
	var baUsers []models.BetterAuthUser
	query := database.DB.Model(&models.BetterAuthUser{})
	if req.UserType != "" {
		query = query.Where("user_type LIKE ?", req.UserType+"%")
	}
	if err := query.Find(&baUsers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	// Get existing workspace members to avoid duplicates
	var existingMembers []models.WorkspaceMember
	if err := database.DB.Where("workspace_id = ?", wsID).Find(&existingMembers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch existing members"})
		return
	}

	// Build set of existing ba_user_ids
	existingBAUserIDs := make(map[string]bool)
	for _, m := range existingMembers {
		if m.BAUserID != nil {
			existingBAUserIDs[*m.BAUserID] = true
		}
	}

	// Import users
	var imported []models.WorkspaceMember
	var skipped int
	now := time.Now()

	for _, baUser := range baUsers {
		// Skip if already a member
		if existingBAUserIDs[baUser.ID] {
			skipped++
			continue
		}

		baUserID := baUser.ID
		newMember := models.WorkspaceMember{
			ID:           uuid.New(),
			WorkspaceID:  wsID,
			BAUserID:     &baUserID,
			Role:         role,
			Status:       "active",
			InvitedEmail: baUser.Email,
			AddedAt:      now,
			UpdatedAt:    now,
		}

		if err := database.DB.Create(&newMember).Error; err != nil {
			// Log error but continue with others
			continue
		}

		imported = append(imported, newMember)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Users imported successfully",
		"total_users":   len(baUsers),
		"imported":      len(imported),
		"skipped":       skipped,
		"already_exist": skipped,
	})
}

// ResetApplicantPasswordRequest for resetting an applicant's password
type ResetApplicantPasswordRequest struct {
	ApplicantID string `json:"applicant_id" binding:"required"`
	WorkspaceID string `json:"workspace_id" binding:"required"`
}

// ResetApplicantPasswordResponse contains the temporary password
type ResetApplicantPasswordResponse struct {
	Success           bool   `json:"success"`
	TemporaryPassword string `json:"temporary_password"`
	Email             string `json:"email"`
	Name              string `json:"name"`
	Message           string `json:"message"`
}

// ResetApplicantPassword generates a temporary password for an applicant
// POST /api/v1/crm/applicants/reset-password
func ResetApplicantPassword(c *gin.Context) {
	var req ResetApplicantPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check workspace access
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	wsID, err := uuid.Parse(req.WorkspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	if _, isMember := checkWorkspaceMembership(wsID, userID); !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this workspace"})
		return
	}

	// Get applicant details
	var applicant struct {
		ID    string  `gorm:"column:id"`
		Email string  `gorm:"column:email"`
		Name  *string `gorm:"column:name"`
	}

	if err := database.DB.Raw(`
		SELECT id, email, name 
		FROM ba_users 
		WHERE id = ? AND user_type = 'applicant'
	`, req.ApplicantID).Scan(&applicant).Error; err != nil || applicant.ID == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Applicant not found"})
		return
	}

	// Generate temporary password (12 characters: letters + numbers + special chars)
	tempPassword := generateTemporaryPassword()

	// Hash the temporary password using scrypt (Better Auth compatible)
	hashedPassword, err := hashPasswordScrypt(tempPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate password"})
		return
	}

	// Update password in ba_accounts
	result := database.DB.Exec(`
		UPDATE ba_accounts 
		SET password = $1, updated_at = NOW()
		WHERE user_id = $2 AND provider_id = 'credential'
	`, hashedPassword, req.ApplicantID)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No credential account found for this applicant"})
		return
	}

	// Clear the password_reset_requested flag after successful reset
	database.DB.Exec(`
		UPDATE ba_users 
		SET metadata = metadata - 'password_reset_requested',
		updated_at = NOW()
		WHERE id = $1
	`, req.ApplicantID)

	name := "Unknown"
	if applicant.Name != nil {
		name = *applicant.Name
	}

	c.JSON(http.StatusOK, ResetApplicantPasswordResponse{
		Success:           true,
		TemporaryPassword: tempPassword,
		Email:             applicant.Email,
		Name:              name,
		Message:           "Password reset successfully. Share this temporary password with the applicant.",
	})
}

// SetApplicantPasswordRequest for setting a custom password
type SetApplicantPasswordRequest struct {
	ApplicantID string `json:"applicant_id" binding:"required"`
	WorkspaceID string `json:"workspace_id" binding:"required"`
	Password    string `json:"password" binding:"required,min=8"`
}

// SetApplicantPasswordResponse contains the result
type SetApplicantPasswordResponse struct {
	Success bool   `json:"success"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Message string `json:"message"`
}

// SetApplicantPassword sets a custom password for an applicant
// POST /api/v1/crm/applicants/set-password
func SetApplicantPassword(c *gin.Context) {
	var req SetApplicantPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check workspace access
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	wsID, err := uuid.Parse(req.WorkspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	if _, isMember := checkWorkspaceMembership(wsID, userID); !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this workspace"})
		return
	}

	// Get applicant details
	var applicant struct {
		ID    string  `gorm:"column:id"`
		Email string  `gorm:"column:email"`
		Name  *string `gorm:"column:name"`
	}

	if err := database.DB.Raw(`
		SELECT id, email, name 
		FROM ba_users 
		WHERE id = ? AND user_type = 'applicant'
	`, req.ApplicantID).Scan(&applicant).Error; err != nil || applicant.ID == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Applicant not found"})
		return
	}

	// Hash the custom password using scrypt (Better Auth compatible)
	hashedPassword, err := hashPasswordScrypt(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Update password in ba_accounts
	result := database.DB.Exec(`
		UPDATE ba_accounts 
		SET password = $1, updated_at = NOW()
		WHERE user_id = $2 AND provider_id = 'credential'
	`, hashedPassword, req.ApplicantID)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No credential account found for this applicant"})
		return
	}

	// Clear the password_reset_requested flag after successful password set
	database.DB.Exec(`
		UPDATE ba_users 
		SET metadata = metadata - 'password_reset_requested',
		updated_at = NOW()
		WHERE id = $1
	`, req.ApplicantID)

	name := "Unknown"
	if applicant.Name != nil {
		name = *applicant.Name
	}

	c.JSON(http.StatusOK, SetApplicantPasswordResponse{
		Success: true,
		Email:   applicant.Email,
		Name:    name,
		Message: "Password set successfully.",
	})
}

// generateTemporaryPassword creates a random 12-character password
// with uppercase, lowercase, numbers, and special characters
func generateTemporaryPassword() string {
	const (
		uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
		lowercase = "abcdefghijklmnopqrstuvwxyz"
		numbers   = "0123456789"
		special   = "!@#$%^&*"
		all       = uppercase + lowercase + numbers + special
		length    = 12
	)

	password := make([]byte, length)

	// Ensure at least one of each type
	password[0] = uppercase[randomInt(len(uppercase))]
	password[1] = lowercase[randomInt(len(lowercase))]
	password[2] = numbers[randomInt(len(numbers))]
	password[3] = special[randomInt(len(special))]

	// Fill the rest randomly
	for i := 4; i < length; i++ {
		password[i] = all[randomInt(len(all))]
	}

	// Shuffle the password
	for i := range password {
		j := randomInt(len(password))
		password[i], password[j] = password[j], password[i]
	}

	return string(password)
}

// randomInt generates a random integer between 0 and max (exclusive)
func randomInt(max int) int {
	b := make([]byte, 1)
	rand.Read(b)
	return int(b[0]) % max
}

// hashPasswordScrypt hashes a password using scrypt (Better Auth compatible)
// Returns hash in format: {salt}:{key} where both are hex-encoded
func hashPasswordScrypt(password string) (string, error) {
	// Generate 16-byte random salt (same as Better Auth)
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	// Encode salt as hex string (Better Auth uses hex.encode())
	saltHex := hex.EncodeToString(salt)

	// Use same parameters as Better Auth:
	// N=16384, r=16, p=1, dkLen=64, maxmem=128*N*r*2
	// Note: Better Auth uses the hex-encoded salt string directly in scrypt
	// Note: Better Auth normalizes password with NFKC, but Go's standard library
	//       doesn't include unicode normalization by default, and our passwords
	//       are ASCII alphanumeric + symbols, so this shouldn't cause issues
	key, err := scrypt.Key([]byte(password), []byte(saltHex), 16384, 16, 1, 64)
	if err != nil {
		return "", err
	}
	keyHex := hex.EncodeToString(key)

	// Return in Better Auth format: salt:key
	return saltHex + ":" + keyHex, nil
}
