package models

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// ============================================
// UNIFIED FORM SCHEMA MODELS (Phase 1)
// These work alongside legacy tables during migration
// ============================================

// Form represents a form definition (replaces data_tables for forms)
type Form struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WorkspaceID uuid.UUID `gorm:"type:uuid;not null" json:"workspace_id"`

	// Link to legacy table if migrated
	LegacyTableID *uuid.UUID `gorm:"type:uuid" json:"legacy_table_id,omitempty"`

	// Basic info
	Name        string  `gorm:"not null" json:"name"`
	Slug        string  `gorm:"not null" json:"slug"`
	Description *string `json:"description,omitempty"`

	// Form settings (branding, behavior)
	Settings datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"settings"`

	// Status
	Status      string     `gorm:"default:'draft'" json:"status"` // draft, published, archived, closed
	PublishedAt *time.Time `json:"published_at,omitempty"`
	ClosesAt    *time.Time `json:"closes_at,omitempty"`

	// Limits
	MaxSubmissions           *int `json:"max_submissions,omitempty"`
	AllowMultipleSubmissions bool `gorm:"default:false" json:"allow_multiple_submissions"`
	RequireAuth              bool `gorm:"default:true" json:"require_auth"`

	// Versioning
	Version int `gorm:"default:1" json:"version"`

	// Timestamps
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	CreatedBy *string   `gorm:"type:text" json:"created_by,omitempty"` // TEXT to match ba_users.id

	// Relations (preload as needed)
	Sections []FormSection `gorm:"foreignKey:FormID" json:"sections,omitempty"`
	Fields   []FormField   `gorm:"foreignKey:FormID" json:"fields,omitempty"`
}

func (Form) TableName() string {
	return "forms"
}

// FormSettings represents the settings JSONB structure
type FormSettings struct {
	// Branding
	LogoURL         string `json:"logo_url,omitempty"`
	PrimaryColor    string `json:"primary_color,omitempty"`
	BackgroundColor string `json:"background_color,omitempty"`

	// Behavior
	ShowProgressBar  bool `json:"show_progress_bar,omitempty"`
	ShowSectionNav   bool `json:"show_section_nav,omitempty"`
	AutosaveInterval int  `json:"autosave_interval,omitempty"` // seconds

	// Confirmation
	ConfirmationMessage string `json:"confirmation_message,omitempty"`
	RedirectURL         string `json:"redirect_url,omitempty"`

	// Notifications
	NotifyOnSubmission bool     `json:"notify_on_submission,omitempty"`
	NotificationEmails []string `json:"notification_emails,omitempty"`
}

// FormSection represents a logical grouping of fields
type FormSection struct {
	ID     uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	FormID uuid.UUID `gorm:"type:uuid;not null" json:"form_id"`

	// Section info
	Name        string  `gorm:"not null" json:"name"`
	Description *string `json:"description,omitempty"`
	SortOrder   int     `gorm:"default:0" json:"sort_order"`

	// Conditional visibility
	Conditions datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"conditions"`

	// Timestamps
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	Fields []FormField `gorm:"foreignKey:SectionID" json:"fields,omitempty"`
}

func (FormSection) TableName() string {
	return "form_sections"
}

// FormField represents an individual form question/field
type FormField struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	FormID    uuid.UUID  `gorm:"type:uuid;not null" json:"form_id"`
	SectionID *uuid.UUID `gorm:"type:uuid" json:"section_id,omitempty"`

	// Link to legacy field if migrated
	LegacyFieldID *uuid.UUID `gorm:"type:uuid" json:"legacy_field_id,omitempty"`

	// Field identification
	FieldKey string `gorm:"not null" json:"field_key"`

	// Field definition
	FieldType   string  `gorm:"not null" json:"field_type"`
	Label       string  `gorm:"not null" json:"label"`
	Description *string `json:"description,omitempty"`
	Placeholder *string `json:"placeholder,omitempty"`

	// Validation
	Required   bool           `gorm:"default:false" json:"required"`
	Validation datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"validation"`

	// Options (for select, radio, checkbox)
	Options datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"options"`

	// Conditional logic
	Conditions datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"conditions"`

	// Display
	SortOrder int    `gorm:"default:0" json:"sort_order"`
	Width     string `gorm:"default:'full'" json:"width"` // full, half, third

	// Versioning
	Version int `gorm:"default:1" json:"version"`

	// Timestamps
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (FormField) TableName() string {
	return "form_fields"
}

// FieldValidation represents validation rules
type FieldValidation struct {
	Min              *float64 `json:"min,omitempty"`
	Max              *float64 `json:"max,omitempty"`
	MinLength        *int     `json:"min_length,omitempty"`
	MaxLength        *int     `json:"max_length,omitempty"`
	Pattern          string   `json:"pattern,omitempty"`
	PatternMessage   string   `json:"pattern_message,omitempty"`
	AllowedFileTypes []string `json:"allowed_file_types,omitempty"`
	MaxFileSize      *int64   `json:"max_file_size,omitempty"` // bytes
}

// FieldOption represents a select/radio/checkbox option
type FieldOption struct {
	Value       string `json:"value"`
	Label       string `json:"label"`
	Description string `json:"description,omitempty"`
	Disabled    bool   `json:"disabled,omitempty"`
}

// FieldCondition represents conditional logic
type FieldCondition struct {
	FieldKey string `json:"field_key"`
	Operator string `json:"operator"` // equals, not_equals, contains, etc.
	Value    any    `json:"value"`
	Action   string `json:"action"` // show, hide, require, disable
}

// FormSubmission represents a user's submission to a form
type FormSubmission struct {
	ID     uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	FormID uuid.UUID `gorm:"type:uuid;not null" json:"form_id"`
	UserID string    `gorm:"type:text;not null" json:"user_id"` // TEXT to match ba_users.id

	// Link to legacy row if migrated
	LegacyRowID *uuid.UUID `gorm:"type:uuid" json:"legacy_row_id,omitempty"`

	// Submission metadata
	Status string `gorm:"default:'draft'" json:"status"` // draft, in_progress, submitted, etc.

	// Progress tracking
	CurrentSectionID     *uuid.UUID `gorm:"type:uuid" json:"current_section_id,omitempty"`
	CompletionPercentage int        `gorm:"default:0" json:"completion_percentage"`

	// Important timestamps
	StartedAt   time.Time  `gorm:"default:now()" json:"started_at"`
	LastSavedAt time.Time  `gorm:"default:now()" json:"last_saved_at"`
	SubmittedAt *time.Time `json:"submitted_at,omitempty"`

	// Form version at time of submission
	FormVersion int `gorm:"default:1" json:"form_version"`

	// Review workflow integration
	WorkflowID         *uuid.UUID `gorm:"type:uuid" json:"workflow_id,omitempty"`
	CurrentStageID     *uuid.UUID `gorm:"type:uuid" json:"current_stage_id,omitempty"`
	AssignedReviewerID *string    `gorm:"type:text" json:"assigned_reviewer_id,omitempty"` // TEXT to match ba_users.id

	// Timestamps
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	Form      *Form           `gorm:"foreignKey:FormID" json:"form,omitempty"`
	User      *BetterAuthUser `gorm:"foreignKey:UserID;references:ID" json:"user,omitempty"`
	Responses []FormResponse  `gorm:"foreignKey:SubmissionID" json:"responses,omitempty"`
}

func (FormSubmission) TableName() string {
	return "form_submissions"
}

// FormResponse represents an individual field response (normalized)
type FormResponse struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SubmissionID uuid.UUID `gorm:"type:uuid;not null" json:"submission_id"`
	FieldID      uuid.UUID `gorm:"type:uuid;not null" json:"field_id"`

	// Typed value columns
	ValueText     *string        `json:"value_text,omitempty"`
	ValueNumber   *float64       `json:"value_number,omitempty"`
	ValueBoolean  *bool          `json:"value_boolean,omitempty"`
	ValueDate     *time.Time     `gorm:"type:date" json:"value_date,omitempty"`
	ValueDatetime *time.Time     `json:"value_datetime,omitempty"`
	ValueJSON     datatypes.JSON `gorm:"type:jsonb" json:"value_json,omitempty"`

	// Which column has the data
	ValueType string `gorm:"not null" json:"value_type"` // text, number, boolean, date, datetime, json

	// Validation status
	IsValid          bool           `gorm:"default:true" json:"is_valid"`
	ValidationErrors datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"validation_errors"`

	// Timestamps
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	Field       *FormField       `gorm:"foreignKey:FieldID" json:"field,omitempty"`
	Attachments []FormAttachment `gorm:"foreignKey:ResponseID" json:"attachments,omitempty"`
}

func (FormResponse) TableName() string {
	return "form_responses"
}

// GetValue returns the appropriate typed value
func (r *FormResponse) GetValue() any {
	switch r.ValueType {
	case "text":
		if r.ValueText != nil {
			return *r.ValueText
		}
	case "number":
		if r.ValueNumber != nil {
			return *r.ValueNumber
		}
	case "boolean":
		if r.ValueBoolean != nil {
			return *r.ValueBoolean
		}
	case "date":
		if r.ValueDate != nil {
			return r.ValueDate.Format("2006-01-02")
		}
	case "datetime":
		if r.ValueDatetime != nil {
			return r.ValueDatetime.Format(time.RFC3339)
		}
	case "json":
		return r.ValueJSON
	}
	return nil
}

// SetValue sets the appropriate typed value based on field type
func (r *FormResponse) SetValue(value any, fieldType string) {
	// Determine value type from field type
	switch fieldType {
	case "number", "currency", "percentage", "rating", "scale":
		r.ValueType = "number"
		if v, ok := value.(float64); ok {
			r.ValueNumber = &v
		} else if v, ok := value.(int); ok {
			f := float64(v)
			r.ValueNumber = &f
		}
	case "checkbox", "boolean":
		r.ValueType = "boolean"
		if v, ok := value.(bool); ok {
			r.ValueBoolean = &v
		}
	case "date":
		r.ValueType = "date"
		if v, ok := value.(string); ok {
			if t, err := time.Parse("2006-01-02", v); err == nil {
				r.ValueDate = &t
			}
		}
	case "datetime", "time":
		r.ValueType = "datetime"
		if v, ok := value.(string); ok {
			if t, err := time.Parse(time.RFC3339, v); err == nil {
				r.ValueDatetime = &t
			}
		}
	case "select", "multiselect", "file", "image", "address", "name", "repeater":
		r.ValueType = "json"
		// Convert to JSON
		if jsonBytes, err := datatypes.JSON(nil).MarshalJSON(); err == nil {
			_ = jsonBytes // Handle properly
		}
		r.ValueJSON = datatypes.JSON([]byte(`null`))
		if value != nil {
			if jsonData, err := json.Marshal(value); err == nil {
				r.ValueJSON = jsonData
			}
		}
	default:
		r.ValueType = "text"
		if v, ok := value.(string); ok {
			r.ValueText = &v
		} else if value != nil {
			s := fmt.Sprintf("%v", value)
			r.ValueText = &s
		}
	}
}

// FormResponseHistory tracks changes to responses
type FormResponseHistory struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ResponseID uuid.UUID `gorm:"type:uuid;not null" json:"response_id"`

	// Previous value snapshot
	PreviousValueText     *string        `json:"previous_value_text,omitempty"`
	PreviousValueNumber   *float64       `json:"previous_value_number,omitempty"`
	PreviousValueBoolean  *bool          `json:"previous_value_boolean,omitempty"`
	PreviousValueDate     *time.Time     `gorm:"type:date" json:"previous_value_date,omitempty"`
	PreviousValueDatetime *time.Time     `json:"previous_value_datetime,omitempty"`
	PreviousValueJSON     datatypes.JSON `gorm:"type:jsonb" json:"previous_value_json,omitempty"`
	PreviousValueType     *string        `json:"previous_value_type,omitempty"`

	// Change metadata
	ChangedBy    *string   `gorm:"type:text" json:"changed_by,omitempty"` // TEXT to match ba_users.id
	ChangedAt    time.Time `gorm:"default:now()" json:"changed_at"`
	ChangeReason *string   `json:"change_reason,omitempty"`
}

func (FormResponseHistory) TableName() string {
	return "form_response_history"
}

// FormAttachment represents a file upload
type FormAttachment struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ResponseID uuid.UUID `gorm:"type:uuid;not null" json:"response_id"`

	// File info
	Filename         string `gorm:"not null" json:"filename"`
	OriginalFilename string `gorm:"not null" json:"original_filename"`
	MimeType         string `gorm:"not null" json:"mime_type"`
	SizeBytes        int64  `gorm:"not null" json:"size_bytes"`

	// Storage
	StorageProvider string  `gorm:"default:'supabase'" json:"storage_provider"`
	StoragePath     string  `gorm:"not null" json:"storage_path"`
	StorageURL      *string `json:"storage_url,omitempty"`

	// Metadata
	UploadedBy *string   `gorm:"type:text" json:"uploaded_by,omitempty"` // TEXT to match ba_users.id
	UploadedAt time.Time `gorm:"default:now()" json:"uploaded_at"`

	// Security
	IsPublic    bool    `gorm:"default:false" json:"is_public"`
	AccessToken *string `json:"access_token,omitempty"`
}

func (FormAttachment) TableName() string {
	return "form_attachments"
}

// ============================================
// VIEW MODELS (for queries)
// ============================================

// FormSubmissionFull represents the full submission with aggregated data
type FormSubmissionFull struct {
	ID                   uuid.UUID      `json:"id"`
	FormID               uuid.UUID      `json:"form_id"`
	UserID               string         `json:"user_id"` // TEXT to match ba_users.id
	LegacyRowID          *uuid.UUID     `json:"legacy_row_id,omitempty"`
	Status               string         `json:"status"`
	CompletionPercentage int            `json:"completion_percentage"`
	SubmittedAt          *time.Time     `json:"submitted_at,omitempty"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	UserEmail            string         `json:"user_email"`
	UserName             *string        `json:"user_name,omitempty"`
	FormName             string         `json:"form_name"`
	FormSlug             string         `json:"form_slug"`
	WorkspaceID          uuid.UUID      `json:"workspace_id"`
	FormData             map[string]any `gorm:"type:jsonb" json:"form_data"`
}

// UserFormSubmissionItem represents a single submission in user's list
type UserFormSubmissionItem struct {
	FormID               uuid.UUID  `json:"form_id"`
	FormName             string     `json:"form_name"`
	FormSlug             string     `json:"form_slug"`
	WorkspaceID          uuid.UUID  `json:"workspace_id"`
	SubmissionID         uuid.UUID  `json:"submission_id"`
	Status               string     `json:"status"`
	CompletionPercentage int        `json:"completion_percentage"`
	StartedAt            time.Time  `json:"started_at"`
	SubmittedAt          *time.Time `json:"submitted_at,omitempty"`
	LastSavedAt          time.Time  `json:"last_saved_at"`
}

// UserFormSubmissions represents all submissions for a user
type UserFormSubmissions struct {
	UserID      string                   `json:"user_id"` // TEXT to match ba_users.id
	Email       string                   `json:"email"`
	UserName    *string                  `json:"user_name,omitempty"`
	Submissions []UserFormSubmissionItem `json:"submissions"`
}
