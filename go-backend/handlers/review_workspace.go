package handlers

import (
	"fmt"
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ReviewWorkspaceSubmission represents a form submission for the review workspace
type ReviewWorkspaceSubmission struct {
	ID                   string                 `json:"id"`
	FormID               string                 `json:"form_id"`
	Status               string                 `json:"status"`
	CompletionPercentage int                    `json:"completion_percentage"`
	SubmittedAt          *string                `json:"submitted_at"`
	LastSavedAt          *string                `json:"last_saved_at"`
	CreatedAt            string                 `json:"created_at"`
	UpdatedAt            string                 `json:"updated_at"`
	Data                 map[string]interface{} `json:"data"`
	BAUser               *models.BetterAuthUser `json:"ba_user,omitempty"`
	// Additional fields for compatibility
	ApplicantName  string `json:"applicant_name"`
	ApplicantEmail string `json:"applicant_email"`
}

// GetReviewWorkspaceSubmissions returns all submissions for a form with proper data aggregation
// GET /api/v1/review-workspace/forms/:form_id/submissions?workspace_id=xxx
func GetReviewWorkspaceSubmissions(c *gin.Context) {
	formID := c.Param("form_id")
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

	formUUID, err := uuid.Parse(formID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form ID"})
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

	// Verify form exists and belongs to workspace
	var form models.Form
	if err := database.DB.Where("id = ? AND workspace_id = ?", formUUID, wsID).First(&form).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	fmt.Printf("📊 GetReviewWorkspaceSubmissions: Loading submissions for form %s\n", formID)

	// Query submissions with user data in a single SQL query
	type SubmissionRow struct {
		SubmissionID  string  `json:"submission_id"`
		FormID        string  `json:"form_id"`
		Status        string  `json:"status"`
		CompletionPct int     `json:"completion_pct"`
		SubmittedAt   *string `json:"submitted_at"`
		LastSavedAt   *string `json:"last_saved_at"`
		CreatedAt     string  `json:"created_at"`
		UpdatedAt     string  `json:"updated_at"`
		UserID        string  `json:"user_id"`
		UserEmail     string  `json:"user_email"`
		UserName      *string `json:"user_name"`
	}

	var rows []SubmissionRow
	err = database.DB.Raw(`
		SELECT 
			fs.id::text as submission_id,
			fs.form_id::text as form_id,
			COALESCE(fs.status, 'draft') as status,
			CASE 
				WHEN fs.status = 'submitted' THEN 100
				WHEN fs.status = 'draft' THEN COALESCE(
					(SELECT (COUNT(DISTINCT CASE WHEN fr.id IS NOT NULL THEN ff.id END)::float * 100 / NULLIF(COUNT(DISTINCT ff.id), 0))::int
					 FROM form_fields ff
					 LEFT JOIN form_responses fr ON fr.field_id = ff.id AND fr.submission_id = fs.id
					 WHERE ff.form_id = fs.form_id AND ff.category = 'data'),
					0
				)
				ELSE 0
			END as completion_pct,
			fs.submitted_at::text as submitted_at,
			fs.updated_at::text as last_saved_at,
			fs.created_at::text as created_at,
			fs.updated_at::text as updated_at,
			ba.id as user_id,
			ba.email as user_email,
			ba.name as user_name
		FROM form_submissions fs
		LEFT JOIN ba_users ba ON fs.user_id = ba.id
		WHERE fs.form_id = ?
		ORDER BY fs.created_at DESC
	`, formUUID).Scan(&rows).Error

	if err != nil {
		fmt.Printf("❌ GetReviewWorkspaceSubmissions: Error querying: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch submissions", "details": err.Error()})
		return
	}

	fmt.Printf("✅ GetReviewWorkspaceSubmissions: Found %d submissions\n", len(rows))

	// For each submission, aggregate form_responses
	results := make([]ReviewWorkspaceSubmission, 0, len(rows))
	for _, row := range rows {
		submissionUUID, _ := uuid.Parse(row.SubmissionID)

		// Aggregate form_responses for this submission
		var responses []models.FormResponse
		if err := database.DB.Where("submission_id = ?", submissionUUID).Find(&responses).Error; err != nil {
			fmt.Printf("⚠️ GetReviewWorkspaceSubmissions: Error loading responses for submission %s: %v\n", row.SubmissionID, err)
		}

		// Build data map with field IDs as keys
		data := make(map[string]interface{})
		for _, resp := range responses {
			data[resp.FieldID.String()] = resp.GetValue()
		}

		fmt.Printf("  Submission %s: %d responses, %d data keys\n", row.SubmissionID, len(responses), len(data))

		// Extract name and email for compatibility
		applicantName := ""
		applicantEmail := row.UserEmail
		if row.UserName != nil {
			applicantName = *row.UserName
		}

		submission := ReviewWorkspaceSubmission{
			ID:                   row.SubmissionID,
			FormID:               row.FormID,
			Status:               row.Status,
			CompletionPercentage: row.CompletionPct,
			SubmittedAt:          row.SubmittedAt,
			LastSavedAt:          row.LastSavedAt,
			CreatedAt:            row.CreatedAt,
			UpdatedAt:            row.UpdatedAt,
			Data:                 data,
			ApplicantName:        applicantName,
			ApplicantEmail:       applicantEmail,
		}

		if row.UserEmail != "" {
			submission.BAUser = &models.BetterAuthUser{
				ID:    row.UserID,
				Email: row.UserEmail,
			}
			if row.UserName != nil {
				submission.BAUser.Name = *row.UserName
			}
		}

		results = append(results, submission)
	}

	fmt.Printf("✅ GetReviewWorkspaceSubmissions: Returning %d submissions with data\n", len(results))
	c.JSON(http.StatusOK, results)
}
