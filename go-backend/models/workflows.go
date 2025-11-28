package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type ReviewWorkflow struct {
	ID                   uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	WorkspaceID          uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	Name                 string         `gorm:"not null" json:"name"`
	Description          string         `json:"description"`
	ApplicationType      string         `json:"application_type"`
	IsActive             bool           `gorm:"default:true" json:"is_active"`
	DefaultRubricID      *uuid.UUID     `gorm:"type:uuid" json:"default_rubric_id"`
	DefaultStageSequence datatypes.JSON `json:"default_stage_sequence"` // Array of stage_ids
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
}

type ApplicationStage struct {
	ID               uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	WorkspaceID      uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	ReviewWorkflowID uuid.UUID      `gorm:"type:uuid;index" json:"review_workflow_id"`
	Name             string         `gorm:"not null" json:"name"`
	Description      string         `json:"description"`
	OrderIndex       int            `gorm:"default:0" json:"order_index"`
	StageType        string         `gorm:"default:'review'" json:"stage_type"`
	StartDate        *time.Time     `json:"start_date"`
	EndDate          *time.Time     `json:"end_date"`
	RelativeDeadline string         `json:"relative_deadline"`
	CustomStatuses   datatypes.JSON `json:"custom_statuses"`   // []string
	CustomTags       datatypes.JSON `json:"custom_tags"`       // []string
	LogicRules       datatypes.JSON `json:"logic_rules"`       // JSON
	HidePII          bool           `json:"hide_pii"`          // Enable PII hiding for this stage
	HiddenPIIFields  datatypes.JSON `json:"hidden_pii_fields"` // []string - field names to hide
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
}

type ReviewerType struct {
	ID                 uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	WorkspaceID        uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	Name               string         `gorm:"not null" json:"name"`
	Description        string         `json:"description"`
	Permissions        datatypes.JSON `json:"permissions"`
	DefaultPermissions datatypes.JSON `json:"default_permissions"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
}

type Rubric struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	Name        string         `gorm:"not null" json:"name"`
	Description string         `json:"description"`
	MaxScore    int            `json:"max_score"`
	TotalPoints int            `json:"total_points"`
	RubricType  string         `json:"rubric_type"` // analytic, holistic, single-point
	Categories  datatypes.JSON `json:"categories"`  // Array of RubricCategory objects
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

type StageReviewerConfig struct {
	ID                    uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	StageID               uuid.UUID      `gorm:"type:uuid;not null" json:"stage_id"`
	ReviewerTypeID        uuid.UUID      `gorm:"type:uuid;not null" json:"reviewer_type_id"`
	RubricID              *uuid.UUID     `gorm:"type:uuid" json:"rubric_id"`
	AssignedRubricID      *uuid.UUID     `gorm:"type:uuid" json:"assigned_rubric_id"`
	VisibilityConfig      datatypes.JSON `json:"visibility_config"`
	FieldVisibilityConfig datatypes.JSON `json:"field_visibility_config"`
	MinReviewsRequired    int            `gorm:"default:1" json:"min_reviews_required"`
	CanViewPriorScores    bool           `json:"can_view_prior_scores"`
	CanViewPriorComments  bool           `json:"can_view_prior_comments"`
	CreatedAt             time.Time      `json:"created_at"`
	UpdatedAt             time.Time      `json:"updated_at"`
}
