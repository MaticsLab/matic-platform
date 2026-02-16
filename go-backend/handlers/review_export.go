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
)

// GetReviewExportData retrieves comprehensive submission data for review and export
// This endpoint aggregates data from multiple tables:
// - form_submissions (core submission data)
// - forms (form metadata)
// - ba_users (applicant information)
// - recommendation_requests (recommendation status)
//
// Example usage:
// GET /api/v1/review-export?workspace_id=<uuid>&form_id=<uuid>&status=submitted
func GetReviewExportData(c *gin.Context) {
	// Parse query parameters
	workspaceID := c.Query("workspace_id")
	formID := c.Query("form_id")
	status := c.Query("status")

	// Validate required parameters
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "workspace_id is required",
		})
		return
	}

	// Validate workspace_id is valid UUID
	if _, err := uuid.Parse(workspaceID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid workspace_id format",
		})
		return
	}

	// Build the base query with joins
	// This single query fetches most of the data we need
	type SubmissionRow struct {
		SubmissionID         uuid.UUID  `db:"submission_id"`
		FormID               uuid.UUID  `db:"form_id"`
		FormName             string     `db:"form_name"`
		Status               string     `db:"status"`
		SubmittedAt          *time.Time `db:"submitted_at"`
		StartedAt            time.Time  `db:"started_at"`
		LastSavedAt          time.Time  `db:"last_saved_at"`
		ApplicantID          string     `db:"applicant_id"`
		ApplicantEmail       string     `db:"applicant_email"`
		ApplicantName        string     `db:"applicant_name"`
		FormData             []byte     `db:"form_data"` // JSONB as bytes
		CompletionPercentage int        `db:"completion_percentage"`
		WorkflowID           *uuid.UUID `db:"workflow_id"`
		AssignedReviewerID   *string    `db:"assigned_reviewer_id"`
		CreatedAt            time.Time  `db:"created_at"`
		UpdatedAt            time.Time  `db:"updated_at"`
	}

	var rows []SubmissionRow

	// Optimized query with LEFT JOINs
	query := database.DB.
		Table("form_submissions fs").
		Select(`
			fs.id as submission_id,
			fs.form_id,
			f.name as form_name,
			fs.status,
			fs.submitted_at,
			fs.started_at,
			fs.last_saved_at,
			fs.user_id as applicant_id,
			COALESCE(u.email, '') as applicant_email,
			COALESCE(u.name, '') as applicant_name,
			fs.raw_data as form_data,
			fs.completion_percentage,
			fs.workflow_id,
			fs.assigned_reviewer_id,
			fs.created_at,
			fs.updated_at
		`).
		Joins("LEFT JOIN forms f ON f.id = fs.form_id").
		Joins("LEFT JOIN ba_users u ON u.id = fs.user_id").
		Where("f.workspace_id = ?", workspaceID).
		Order("fs.created_at DESC")

	// Apply optional filters
	if formID != "" {
		query = query.Where("fs.form_id = ?", formID)
	}

	if status != "" {
		query = query.Where("fs.status = ?", status)
	}

	// Execute query
	if err := query.Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to fetch submissions: %v", err),
		})
		return
	}

	// If no submissions found, return consistent structure with empty array
	if len(rows) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"data":  []models.ReviewSubmissionExport{},
			"count": 0,
			"filters": gin.H{
				"workspace_id": workspaceID,
				"form_id":      formID,
				"status":       status,
			},
		})
		return
	}

	// Collect all submission IDs for batch fetching recommendations
	submissionIDs := make([]uuid.UUID, len(rows))
	for i, row := range rows {
		submissionIDs[i] = row.SubmissionID
	}

	// Fetch all recommendations in a single query
	var recommendations []models.RecommendationRequest
	if err := database.DB.
		Where("submission_id IN ?", submissionIDs).
		Order("submission_id, created_at").
		Find(&recommendations).Error; err != nil {
		// Log error but don't fail the request
		fmt.Printf("Warning: Failed to fetch recommendations: %v\n", err)
	}

	// Group recommendations by submission_id
	recsBySubmission := make(map[uuid.UUID][]models.RecommendationSummary)
	for _, rec := range recommendations {
		summary := models.RecommendationSummary{
			ID:                      rec.ID,
			RecommenderName:         rec.RecommenderName,
			RecommenderEmail:        rec.RecommenderEmail,
			RecommenderRelationship: rec.RecommenderRelationship,
			RecommenderOrganization: rec.RecommenderOrganization,
			Status:                  rec.Status,
			RequestedAt:             rec.RequestedAt,
			SubmittedAt:             rec.SubmittedAt,
			ExpiresAt:               rec.ExpiresAt,
			ReminderCount:           rec.ReminderCount,
		}
		recsBySubmission[rec.SubmissionID] = append(recsBySubmission[rec.SubmissionID], summary)
	}

	// Build the final result set
	results := make([]models.ReviewSubmissionExport, 0, len(rows))
	for _, row := range rows {
		// Parse form_data JSONB
		var formData map[string]interface{}
		if len(row.FormData) > 0 && string(row.FormData) != "null" {
			if err := json.Unmarshal(row.FormData, &formData); err != nil {
				// Log error but continue with empty data
				fmt.Printf("Warning: Failed to parse form_data for submission %s: %v\n", row.SubmissionID, err)
				formData = make(map[string]interface{})
			}
		} else {
			formData = make(map[string]interface{})
		}

		// Get recommendations for this submission
		recs := recsBySubmission[row.SubmissionID]

		// Count recommendation statuses
		pendingCount := 0
		submittedCount := 0
		for _, rec := range recs {
			if rec.Status == "submitted" {
				submittedCount++
			} else if rec.Status == "pending" {
				pendingCount++
			}
		}

		// Marshal form data back to JSON for the response
		formDataJSON, _ := json.Marshal(formData)

		result := models.ReviewSubmissionExport{
			SubmissionID:             row.SubmissionID,
			FormID:                   row.FormID,
			FormName:                 row.FormName,
			Status:                   row.Status,
			SubmittedAt:              row.SubmittedAt,
			StartedAt:                row.StartedAt,
			LastSavedAt:              row.LastSavedAt,
			ApplicantID:              row.ApplicantID,
			ApplicantEmail:           row.ApplicantEmail,
			ApplicantName:            row.ApplicantName,
			FormData:                 formDataJSON,
			CompletionPercentage:     row.CompletionPercentage,
			WorkflowID:               row.WorkflowID,
			AssignedReviewerID:       row.AssignedReviewerID,
			RecommendationsCount:     len(recs),
			RecommendationsPending:   pendingCount,
			RecommendationsSubmitted: submittedCount,
			RecommendationDetails:    recs,
			CreatedAt:                row.CreatedAt,
			UpdatedAt:                row.UpdatedAt,
		}

		results = append(results, result)
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  results,
		"count": len(results),
		"filters": gin.H{
			"workspace_id": workspaceID,
			"form_id":      formID,
			"status":       status,
		},
	})
}

// GetReviewExportCSV generates a CSV export of review data
// This endpoint provides the same data as GetReviewExportData but formatted as CSV
//
// Example usage:
// GET /api/v1/review-export/csv?workspace_id=<uuid>&form_id=<uuid>
func GetReviewExportCSV(c *gin.Context) {
	// For now, return a message that CSV generation should be done client-side
	// In a future iteration, we could implement server-side CSV generation
	c.JSON(http.StatusOK, gin.H{
		"message":  "CSV generation is handled client-side. Use /review-export endpoint to get JSON data and convert to CSV in the frontend.",
		"endpoint": "/api/v1/review-export",
	})
}
