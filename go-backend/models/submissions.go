package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// ApplicationSubmission represents a user's application to a form
// Uses optimistic locking via Version field for conflict detection during autosave
type ApplicationSubmission struct {
	ID     uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID string    `gorm:"type:text;not null;index" json:"user_id"` // ba_users.id
	FormID uuid.UUID `gorm:"type:uuid;not null;index" json:"form_id"` // data_tables.id

	// Status: draft, submitted, under_review, approved, rejected, waitlisted, withdrawn
	Status  string     `gorm:"type:varchar(30);default:'draft'" json:"status"`
	StageID *uuid.UUID `gorm:"type:uuid;index" json:"stage_id,omitempty"` // application_stages.id

	// Form data stored as JSONB
	Data datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"data"`

	// Optimistic locking - incremented on each save
	Version int `gorm:"default:1;not null" json:"version"`

	// Timestamps
	SubmittedAt    *time.Time `json:"submitted_at,omitempty"`
	LastAutosaveAt *time.Time `json:"last_autosave_at,omitempty"`
	CreatedAt      time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
}

func (ApplicationSubmission) TableName() string {
	return "application_submissions"
}

// SubmissionVersion stores version history for submissions
type SubmissionVersion struct {
	ID            uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	SubmissionID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"submission_id"`
	Version       int            `gorm:"not null" json:"version"`
	Data          datatypes.JSON `gorm:"type:jsonb;not null" json:"data"`
	ChangedFields []string       `gorm:"type:text[]" json:"changed_fields,omitempty"`
	ChangeType    string         `gorm:"type:varchar(20);default:'autosave'" json:"change_type"` // autosave, manual_save, submit, restore
	CreatedAt     time.Time      `gorm:"autoCreateTime" json:"created_at"`
}

func (SubmissionVersion) TableName() string {
	return "submission_versions"
}

// SubmissionStatus constants
const (
	SubmissionStatusDraft       = "draft"
	SubmissionStatusSubmitted   = "submitted"
	SubmissionStatusUnderReview = "under_review"
	SubmissionStatusApproved    = "approved"
	SubmissionStatusRejected    = "rejected"
	SubmissionStatusWaitlisted  = "waitlisted"
	SubmissionStatusWithdrawn   = "withdrawn"
)

// SubmissionChangeType constants for version history
const (
	SubmissionChangeTypeAutosave   = "autosave"
	SubmissionChangeTypeManualSave = "manual_save"
	SubmissionChangeTypeSubmit     = "submit"
	SubmissionChangeTypeRestore    = "restore"
)
