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
	Color            string         `json:"color"` // Stage color: blue, green, yellow, orange, red, purple, pink, teal, indigo, slate
	StartDate        *time.Time     `json:"start_date"`
	EndDate          *time.Time     `json:"end_date"`
	RelativeDeadline string         `json:"relative_deadline"`
	CustomStatuses   datatypes.JSON `json:"custom_statuses"`   // []CustomStatus - status action buttons
	CustomTags       datatypes.JSON `json:"custom_tags"`       // []string - available tags for this stage
	StatusActions    datatypes.JSON `json:"status_actions"`    // map[statusName]StatusActionConfig - actions triggered by statuses
	LogicRules       datatypes.JSON `json:"logic_rules"`       // JSON
	HidePII          bool           `json:"hide_pii"`          // Enable PII hiding for this stage
	HiddenPIIFields  datatypes.JSON `json:"hidden_pii_fields"` // []string - field names to hide
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
}

// StatusOption represents a simple status option in stage's custom_statuses JSON column
// This is the simple version for backward compatibility
type StatusOption struct {
	Name  string `json:"name"`
	Color string `json:"color"` // green, red, yellow, blue, purple, gray
	Icon  string `json:"icon"`  // check, x, clock, arrow-right, etc.
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

// ApplicationGroup represents GLOBAL groups visible everywhere (e.g., Rejected, Waitlist, Accepted)
// Applications in these groups are OUT of the normal pipeline
type ApplicationGroup struct {
	ID               uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	WorkspaceID      uuid.UUID `gorm:"type:uuid;not null;index" json:"workspace_id"`
	ReviewWorkflowID uuid.UUID `gorm:"type:uuid;not null;index" json:"review_workflow_id"`
	Name             string    `gorm:"not null" json:"name"`
	Description      string    `json:"description"`
	Color            string    `gorm:"default:'gray'" json:"color"`
	Icon             string    `gorm:"default:'folder'" json:"icon"`
	OrderIndex       int       `gorm:"default:0" json:"order_index"`
	IsSystem         bool      `gorm:"default:false" json:"is_system"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (ApplicationGroup) TableName() string {
	return "application_groups"
}

// StageGroup represents groups WITHIN a stage (e.g., "Needs More Info", "Under Committee Review")
// Applications stay in the stage but are organized into sub-groups
type StageGroup struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	StageID     uuid.UUID `gorm:"type:uuid;not null;index" json:"stage_id"`
	WorkspaceID uuid.UUID `gorm:"type:uuid;not null;index" json:"workspace_id"`
	Name        string    `gorm:"not null" json:"name"`
	Description string    `json:"description"`
	Color       string    `gorm:"default:'blue'" json:"color"`
	Icon        string    `gorm:"default:'folder'" json:"icon"`
	OrderIndex  int       `gorm:"default:0" json:"order_index"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (StageGroup) TableName() string {
	return "stage_groups"
}

// CustomStatus represents an action button that appears in the review interface
// Each status can trigger multiple actions when applied
type CustomStatus struct {
	ID              uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	StageID         uuid.UUID      `gorm:"type:uuid;not null;index" json:"stage_id"`
	WorkspaceID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	Name            string         `gorm:"not null" json:"name"` // e.g., "Approve", "Request Info", "Reject"
	Description     string         `json:"description"`
	Color           string         `gorm:"default:'blue'" json:"color"` // blue, green, red, yellow, purple, gray
	Icon            string         `gorm:"default:'circle'" json:"icon"`
	IsPrimary       bool           `gorm:"default:false" json:"is_primary"` // Show as main button vs dropdown
	OrderIndex      int            `gorm:"default:0" json:"order_index"`
	RequiresComment bool           `gorm:"default:false" json:"requires_comment"`
	RequiresScore   bool           `gorm:"default:false" json:"requires_score"`
	Actions         datatypes.JSON `json:"actions"` // []StatusActionConfig
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

func (CustomStatus) TableName() string {
	return "custom_statuses"
}

// StatusActionConfig defines a single action triggered by a status
// Stored as JSON array in CustomStatus.Actions
type StatusActionConfig struct {
	ActionType         string   `json:"action_type"`                     // move_to_stage, move_to_group, move_to_stage_group, add_tags, remove_tags, send_email, set_field
	TargetStageID      string   `json:"target_stage_id,omitempty"`       // For move_to_stage
	TargetGroupID      string   `json:"target_group_id,omitempty"`       // For move_to_group (application group)
	TargetStageGroupID string   `json:"target_stage_group_id,omitempty"` // For move_to_stage_group
	Tags               []string `json:"tags,omitempty"`                  // For add_tags, remove_tags
	EmailTemplateID    string   `json:"email_template_id,omitempty"`     // For send_email
	FieldName          string   `json:"field_name,omitempty"`            // For set_field
	FieldValue         string   `json:"field_value,omitempty"`           // For set_field
}

// TagAutomation represents an automated action triggered when a tag is applied/removed
type TagAutomation struct {
	ID               uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	WorkspaceID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	ReviewWorkflowID uuid.UUID      `gorm:"type:uuid;not null;index" json:"review_workflow_id"`
	StageID          *uuid.UUID     `gorm:"type:uuid;index" json:"stage_id"` // Optional: only trigger in specific stage
	Name             string         `gorm:"not null" json:"name"`
	Description      string         `json:"description"`
	TriggerType      string         `gorm:"not null" json:"trigger_type"` // tag_added, tag_removed, tag_present
	TriggerTag       string         `gorm:"not null" json:"trigger_tag"`  // The tag that triggers this automation
	Conditions       datatypes.JSON `json:"conditions"`                   // Additional conditions (e.g., score > 80)
	Actions          datatypes.JSON `json:"actions"`                      // []StatusActionConfig
	IsActive         bool           `gorm:"default:true" json:"is_active"`
	OrderIndex       int            `gorm:"default:0" json:"order_index"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
}

func (TagAutomation) TableName() string {
	return "tag_automations"
}

// CustomTag represents a tag that can be applied to applications
type CustomTag struct {
	ID               uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	WorkspaceID      uuid.UUID  `gorm:"type:uuid;not null;index" json:"workspace_id"`
	ReviewWorkflowID uuid.UUID  `gorm:"type:uuid;not null;index" json:"review_workflow_id"`
	StageID          *uuid.UUID `gorm:"type:uuid;index" json:"stage_id"` // Optional: tag only available in specific stage
	Name             string     `gorm:"not null" json:"name"`
	Color            string     `gorm:"default:'gray'" json:"color"`
	Description      string     `json:"description"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

func (CustomTag) TableName() string {
	return "custom_tags"
}

// WorkflowAction - DEPRECATED: Use CustomStatus instead
// Kept for backward compatibility
type WorkflowAction struct {
	ID               uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	WorkspaceID      uuid.UUID  `gorm:"type:uuid;not null;index" json:"workspace_id"`
	ReviewWorkflowID uuid.UUID  `gorm:"type:uuid;not null;index" json:"review_workflow_id"`
	Name             string     `gorm:"not null" json:"name"`
	Description      string     `json:"description"`
	Color            string     `gorm:"default:'gray'" json:"color"`
	Icon             string     `gorm:"default:'circle'" json:"icon"`
	ActionType       string     `gorm:"default:'move_to_group'" json:"action_type"`
	TargetGroupID    *uuid.UUID `gorm:"type:uuid" json:"target_group_id"`
	TargetStageID    *uuid.UUID `gorm:"type:uuid" json:"target_stage_id"`
	RequiresComment  bool       `gorm:"default:false" json:"requires_comment"`
	IsSystem         bool       `gorm:"default:false" json:"is_system"`
	OrderIndex       int        `gorm:"default:0" json:"order_index"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

func (WorkflowAction) TableName() string {
	return "workflow_actions"
}

// StageAction - DEPRECATED: Use CustomStatus instead
type StageAction struct {
	ID              uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	StageID         uuid.UUID  `gorm:"type:uuid;not null;index" json:"stage_id"`
	Name            string     `gorm:"not null" json:"name"`
	Description     string     `json:"description"`
	Color           string     `gorm:"default:'blue'" json:"color"`
	Icon            string     `gorm:"default:'check'" json:"icon"`
	ActionType      string     `gorm:"default:'set_status'" json:"action_type"`
	TargetGroupID   *uuid.UUID `gorm:"type:uuid" json:"target_group_id"`
	TargetStageID   *uuid.UUID `gorm:"type:uuid" json:"target_stage_id"`
	StatusValue     string     `json:"status_value"`
	RequiresComment bool       `gorm:"default:false" json:"requires_comment"`
	OrderIndex      int        `gorm:"default:0" json:"order_index"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (StageAction) TableName() string {
	return "stage_actions"
}
