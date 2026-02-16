package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// ReviewSubmissionExport represents a comprehensive view of a form submission
// optimized for export and review purposes. This model flattens data from
// multiple tables into a single exportable structure.
type ReviewSubmissionExport struct {
	// Core Submission Info
	SubmissionID uuid.UUID  `json:"submission_id"`
	FormID       uuid.UUID  `json:"form_id"`
	FormName     string     `json:"form_name"`
	Status       string     `json:"status"`
	SubmittedAt  *time.Time `json:"submitted_at"`
	StartedAt    time.Time  `json:"started_at"`
	LastSavedAt  time.Time  `json:"last_saved_at"`

	// Applicant Information
	ApplicantID    string `json:"applicant_id"` // Better Auth user ID (TEXT)
	ApplicantEmail string `json:"applicant_email"`
	ApplicantName  string `json:"applicant_name"`

	// Form Data (JSONB - will be flattened in export)
	FormData datatypes.JSON `json:"form_data"`

	// Progress Tracking
	CompletionPercentage int `json:"completion_percentage"`

	// Workflow/Review Information
	WorkflowID         *uuid.UUID `json:"workflow_id,omitempty"`
	AssignedReviewerID *string    `json:"assigned_reviewer_id,omitempty"`
	CurrentStage       *string    `json:"current_stage,omitempty"`
	ReviewScore        *float64   `json:"review_score,omitempty"`
	ReviewNotes        *string    `json:"review_notes,omitempty"`

	// Recommendations Summary
	RecommendationsCount     int                     `json:"recommendations_count"`
	RecommendationsPending   int                     `json:"recommendations_pending"`
	RecommendationsSubmitted int                     `json:"recommendations_submitted"`
	RecommendationDetails    []RecommendationSummary `json:"recommendation_details,omitempty"`

	// Timestamps
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// RecommendationSummary provides a compact view of a recommendation request
type RecommendationSummary struct {
	ID                      uuid.UUID  `json:"id"`
	RecommenderName         string     `json:"recommender_name"`
	RecommenderEmail        string     `json:"recommender_email"`
	RecommenderRelationship string     `json:"recommender_relationship,omitempty"`
	RecommenderOrganization string     `json:"recommender_organization,omitempty"`
	Status                  string     `json:"status"` // pending, submitted, expired, cancelled
	RequestedAt             time.Time  `json:"requested_at"`
	SubmittedAt             *time.Time `json:"submitted_at,omitempty"`
	ExpiresAt               *time.Time `json:"expires_at,omitempty"`
	ReminderCount           int        `json:"reminder_count"`
}

// CSVExportRow represents a single flattened row for CSV export
// This structure dynamically includes form fields as individual columns
type CSVExportRow struct {
	// Standard columns (always present)
	SubmissionID         string `json:"submission_id"`
	FormName             string `json:"form_name"`
	ApplicantEmail       string `json:"applicant_email"`
	ApplicantName        string `json:"applicant_name"`
	Status               string `json:"status"`
	SubmittedAt          string `json:"submitted_at"`
	CompletionPercentage int    `json:"completion_percentage"`
	RecommendationsCount int    `json:"recommendations_count"`

	// Dynamic form fields (populated from FormData JSONB)
	FormFields map[string]interface{} `json:"form_fields,omitempty"`

	// Recommendation columns (dynamic based on count)
	RecommendationColumns map[string]string `json:"recommendation_columns,omitempty"`
}

// ReviewExportFilters defines available filters for export queries
type ReviewExportFilters struct {
	WorkspaceID        string     `form:"workspace_id" binding:"required"`
	FormID             string     `form:"form_id"`
	Status             string     `form:"status"` // draft, submitted, in_progress, etc.
	SubmittedAfter     *time.Time `form:"submitted_after"`
	SubmittedBefore    *time.Time `form:"submitted_before"`
	HasRecommendations bool       `form:"has_recommendations"`
}
