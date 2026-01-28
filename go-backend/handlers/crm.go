package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ApplicantCRM represents an applicant with their form submissions
type ApplicantCRM struct {
	ID           string               `json:"id"`
	Email        string               `json:"email"`
	Name         *string              `json:"name"`
	UserType     string               `json:"user_type"`
	CreatedAt    string               `json:"created_at"`
	LastLoginAt  *string              `json:"last_login_at,omitempty"`
	Applications []ApplicationSummary `json:"applications"`
	TotalForms   int                  `json:"total_forms"`
}

// ApplicationSummary represents a form application by an applicant
type ApplicationSummary struct {
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
	// Uses portal_applicants to link applicants to forms
	type ApplicantRow struct {
		UserID        string  `json:"user_id"`
		Email         string  `json:"email"`
		Name          *string `json:"name"`
		UserType      string  `json:"user_type"`
		UserCreatedAt string  `json:"user_created_at"`
		LastLoginAt   *string `json:"last_login_at"`
		FormID        string  `json:"form_id"`
		FormName      string  `json:"form_name"`
		FormSlug      *string `json:"form_slug"`
		RowID         *string `json:"row_id"`
		SubmissionID  *string `json:"submission_id"`
		Status        string  `json:"status"`
		CompletionPct int     `json:"completion_pct"`
		SubmittedAt   *string `json:"submitted_at"`
		LastSavedAt   *string `json:"last_saved_at"`
		AppCreatedAt  string  `json:"app_created_at"`
	}

	var rows []ApplicantRow
	err = database.DB.Raw(`
		SELECT 
			ba.id as user_id,
			ba.email,
			ba.name,
			ba.user_type,
			ba.created_at::text as user_created_at,
			pa.last_login_at::text as last_login_at,
			COALESCE(dt.id::text, pa.form_id::text) as form_id,
			COALESCE(dt.name, 'Unknown Form') as form_name,
			dt.custom_slug as form_slug,
			pa.row_id::text as row_id,
			pa.row_id::text as submission_id,
			COALESCE(
				(tr.metadata->>'status')::text,
				CASE WHEN tr.id IS NOT NULL THEN 'in_progress' ELSE 'not_started' END
			) as status,
			COALESCE(
				(tr.metadata->>'completion_percentage')::int,
				0
			) as completion_pct,
			(tr.metadata->>'submitted_at')::text as submitted_at,
			tr.updated_at::text as last_saved_at,
			pa.created_at::text as app_created_at
		FROM ba_users ba
		LEFT JOIN portal_applicants pa ON pa.ba_user_id = ba.id
		LEFT JOIN table_rows tr ON pa.row_id = tr.id
		LEFT JOIN data_tables dt ON tr.table_id = dt.id AND dt.workspace_id = ?
		WHERE ba.user_type LIKE 'applicant%'
		ORDER BY ba.created_at DESC, pa.created_at DESC
	`, wsID).Scan(&rows).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch applicants"})
		return
	}

	// Group by applicant
	applicantMap := make(map[string]*ApplicantCRM)
	for _, row := range rows {
		if _, exists := applicantMap[row.UserID]; !exists {
			applicantMap[row.UserID] = &ApplicantCRM{
				ID:           row.UserID,
				Email:        row.Email,
				Name:         row.Name,
				UserType:     row.UserType,
				CreatedAt:    row.UserCreatedAt,
				LastLoginAt:  row.LastLoginAt,
				Applications: []ApplicationSummary{},
				TotalForms:   0,
			}
		}

		applicant := applicantMap[row.UserID]
		applicant.Applications = append(applicant.Applications, ApplicationSummary{
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
		EmailVerified bool    `json:"email_verified"`
	}

	var applicant ApplicantDetail
	err = database.DB.Raw(`
		SELECT 
			id,
			email,
			name,
			user_type,
			created_at::text,
			email_verified
		FROM ba_users
		WHERE id = ? AND user_type LIKE 'applicant%'
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
		WITH workspace_forms AS (
			SELECT id, name, custom_slug 
			FROM data_tables 
			WHERE workspace_id = ? AND icon = 'form'
		)
		SELECT 
			wf.id::text as form_id,
			wf.name as form_name,
			wf.custom_slug as form_slug,
			pa.row_id::text as submission_id,
			COALESCE(
				(tr.metadata->>'status')::text,
				CASE WHEN tr.id IS NOT NULL THEN 'in_progress' ELSE 'not_started' END
			) as status,
			COALESCE(
				(tr.metadata->>'completion_percentage')::int,
				0
			) as completion_pct,
			(tr.metadata->>'submitted_at')::text as submitted_at,
			tr.updated_at::text as last_saved_at,
			pa.created_at::text as created_at
		FROM portal_applicants pa
		JOIN workspace_forms wf ON pa.form_id = wf.id
		LEFT JOIN table_rows tr ON pa.row_id = tr.id
		WHERE pa.ba_user_id = ?
		ORDER BY pa.created_at DESC
	`, wsID, applicantID).Scan(&applications).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch applications"})
		return
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
