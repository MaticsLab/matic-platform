package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// ============================================================
// FIELD TYPE REGISTRY
// ============================================================

// FieldTypeRegistry - Master registry of all field types
type FieldTypeRegistry struct {
	ID          string `gorm:"primaryKey" json:"id"`     // 'text', 'email', 'repeater', etc.
	Category    string `gorm:"not null" json:"category"` // primitive, container, layout, special
	Label       string `gorm:"not null" json:"label"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Color       string `json:"color"`

	// Schema definitions (JSON Schema format)
	InputSchema   datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"input_schema"`
	StorageSchema datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"storage_schema"`
	ConfigSchema  datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"config_schema"`

	// Behavior flags
	IsContainer  bool `gorm:"default:false" json:"is_container"`
	IsSearchable bool `gorm:"default:true" json:"is_searchable"`
	IsSortable   bool `gorm:"default:true" json:"is_sortable"`
	IsFilterable bool `gorm:"default:true" json:"is_filterable"`
	IsEditable   bool `gorm:"default:true" json:"is_editable"`
	SupportsPII  bool `gorm:"default:false" json:"supports_pii"`

	// Rendering hints
	TableRenderer  string `json:"table_renderer,omitempty"`
	FormRenderer   string `json:"form_renderer,omitempty"`
	ReviewRenderer string `json:"review_renderer,omitempty"`

	// AI Integration
	AISchema datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"ai_schema"`

	// Semantic type mapping
	DefaultSemanticType string `json:"default_semantic_type,omitempty"`

	// Edit tracking settings
	TrackChanges  bool `gorm:"default:true" json:"track_changes"`
	RequireReason bool `gorm:"default:false" json:"require_reason"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (FieldTypeRegistry) TableName() string {
	return "field_type_registry"
}

// ============================================================
// BATCH OPERATIONS
// ============================================================

// BatchOperation - Groups bulk changes together
type BatchOperation struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	WorkspaceID uuid.UUID  `gorm:"type:uuid;not null;index" json:"workspace_id"`
	TableID     *uuid.UUID `gorm:"type:uuid;index" json:"table_id,omitempty"`

	// Operation details
	OperationType string `gorm:"not null" json:"operation_type"` // bulk_update, bulk_delete, import, etc.
	Description   string `json:"description"`

	// Scope
	AffectedRowCount   int      `gorm:"default:0" json:"affected_row_count"`
	AffectedFieldNames []string `gorm:"type:text[]" json:"affected_field_names"`

	// Status
	Status       string `gorm:"default:'completed'" json:"status"` // pending, in_progress, completed, failed, rolled_back
	ErrorMessage string `json:"error_message,omitempty"`

	// Rollback support
	CanRollback  bool       `gorm:"default:true" json:"can_rollback"`
	RolledBackAt *time.Time `json:"rolled_back_at,omitempty"`
	RolledBackBy *uuid.UUID `gorm:"type:uuid" json:"rolled_back_by,omitempty"`

	// Authorship
	CreatedBy   uuid.UUID  `gorm:"type:uuid;not null" json:"created_by"`
	CreatedAt   time.Time  `gorm:"autoCreateTime" json:"created_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

func (BatchOperation) TableName() string {
	return "batch_operations"
}

// ============================================================
// ROW VERSIONS (History)
// ============================================================

// RowVersion - Complete row snapshot for history
type RowVersion struct {
	ID      uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	RowID   uuid.UUID `gorm:"type:uuid;not null;index" json:"row_id"`
	TableID uuid.UUID `gorm:"type:uuid;not null;index" json:"table_id"`

	// Version info
	VersionNumber int `gorm:"not null" json:"version_number"`

	// Complete data snapshot (stored unredacted)
	Data     datatypes.JSON `gorm:"type:jsonb;not null" json:"data"`
	Metadata datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"metadata"`

	// Change context
	ChangeType    string `gorm:"not null" json:"change_type"` // create, update, restore, import, ai_edit, approval, bulk
	ChangeReason  string `json:"change_reason,omitempty"`     // User-provided reason
	ChangeSummary string `json:"change_summary,omitempty"`    // Auto-generated summary

	// Batch operation reference
	BatchOperationID *uuid.UUID `gorm:"type:uuid;index" json:"batch_operation_id,omitempty"`

	// Authorship
	ChangedBy *uuid.UUID `gorm:"type:uuid" json:"changed_by,omitempty"`
	ChangedAt time.Time  `gorm:"autoCreateTime" json:"changed_at"`

	// AI context
	AIAssisted     bool       `gorm:"default:false" json:"ai_assisted"`
	AIConfidence   *float64   `json:"ai_confidence,omitempty"`
	AISuggestionID *uuid.UUID `gorm:"type:uuid" json:"ai_suggestion_id,omitempty"`

	// Archive/Delete support
	IsArchived       bool       `gorm:"default:false" json:"is_archived"`
	ArchivedAt       *time.Time `json:"archived_at,omitempty"`
	ArchivedBy       *uuid.UUID `gorm:"type:uuid" json:"archived_by,omitempty"`
	ArchiveExpiresAt *time.Time `json:"archive_expires_at,omitempty"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (RowVersion) TableName() string {
	return "row_versions"
}

// ============================================================
// FIELD CHANGES (Granular Diffs)
// ============================================================

// FieldChange - Granular field-level change tracking
type FieldChange struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	RowVersionID uuid.UUID  `gorm:"type:uuid;not null;index" json:"row_version_id"`
	RowID        uuid.UUID  `gorm:"type:uuid;not null;index" json:"row_id"`
	FieldID      *uuid.UUID `gorm:"type:uuid;index" json:"field_id,omitempty"`

	// Field identification (preserved if field is deleted)
	FieldName  string `gorm:"not null" json:"field_name"`
	FieldType  string `gorm:"not null" json:"field_type"`
	FieldLabel string `json:"field_label,omitempty"`

	// Change data (stored unredacted)
	OldValue datatypes.JSON `gorm:"type:jsonb" json:"old_value,omitempty"`
	NewValue datatypes.JSON `gorm:"type:jsonb" json:"new_value,omitempty"`

	// Change classification
	ChangeAction string `gorm:"not null" json:"change_action"` // add, update, remove, reorder

	// For container types, track nested path
	NestedPath []string `gorm:"type:text[]" json:"nested_path,omitempty"` // e.g., ['activities', '0', 'role']

	// AI analysis
	SimilarityScore    *float64 `json:"similarity_score,omitempty"`     // 0-1, 1=identical
	SemanticChangeType string   `json:"semantic_change_type,omitempty"` // typo_fix, correction, addition, major_revision

	// PII tracking
	ContainsPII bool `gorm:"default:false" json:"contains_pii"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (FieldChange) TableName() string {
	return "field_changes"
}

// ============================================================
// CHANGE APPROVALS
// ============================================================

// ChangeApproval - Approval workflow for edits
type ChangeApproval struct {
	ID      uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	RowID   uuid.UUID `gorm:"type:uuid;not null;index" json:"row_id"`
	TableID uuid.UUID `gorm:"type:uuid;not null;index" json:"table_id"`

	// Pending changes (not yet applied)
	PendingData    datatypes.JSON `gorm:"type:jsonb;not null" json:"pending_data"`
	PendingChanges datatypes.JSON `gorm:"type:jsonb;not null" json:"pending_changes"`
	ChangeReason   string         `json:"change_reason,omitempty"`

	// Approval context
	RequiresApprovalFrom string     `json:"requires_approval_from"` // table_owner, workspace_admin, specific_user, any_reviewer
	SpecificApproverID   *uuid.UUID `gorm:"type:uuid" json:"specific_approver_id,omitempty"`

	// Stage reference (if from workflow)
	StageID *uuid.UUID `gorm:"type:uuid" json:"stage_id,omitempty"`

	// Status
	Status string `gorm:"default:'pending'" json:"status"` // pending, approved, rejected, expired, cancelled

	// Requester
	RequestedBy uuid.UUID `gorm:"type:uuid;not null" json:"requested_by"`
	RequestedAt time.Time `gorm:"autoCreateTime" json:"requested_at"`

	// Approver
	ReviewedBy  *uuid.UUID `gorm:"type:uuid" json:"reviewed_by,omitempty"`
	ReviewedAt  *time.Time `json:"reviewed_at,omitempty"`
	ReviewNotes string     `json:"review_notes,omitempty"`

	// Expiration
	ExpiresAt *time.Time `json:"expires_at,omitempty"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (ChangeApproval) TableName() string {
	return "change_approvals"
}

// ============================================================
// AI FIELD SUGGESTIONS
// ============================================================

// AIFieldSuggestion - AI-powered field improvements
type AIFieldSuggestion struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	WorkspaceID uuid.UUID  `gorm:"type:uuid;not null;index" json:"workspace_id"`
	TableID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"table_id"`
	RowID       *uuid.UUID `gorm:"type:uuid;index" json:"row_id,omitempty"` // NULL for table-level suggestions
	FieldID     *uuid.UUID `gorm:"type:uuid;index" json:"field_id,omitempty"`

	// Suggestion type
	SuggestionType string `gorm:"not null" json:"suggestion_type"` // typo_correction, format_correction, etc.

	// Current state
	CurrentValue datatypes.JSON `gorm:"type:jsonb" json:"current_value,omitempty"`

	// Suggestion
	SuggestedValue datatypes.JSON `gorm:"type:jsonb;not null" json:"suggested_value"`
	Confidence     float64        `gorm:"not null" json:"confidence"` // 0-1
	Reasoning      string         `json:"reasoning,omitempty"`

	// Evidence
	SampleData     datatypes.JSON `gorm:"type:jsonb" json:"sample_data,omitempty"`
	PatternMatches *int           `json:"pattern_matches,omitempty"`
	TotalValues    *int           `json:"total_values,omitempty"`

	// Related suggestions
	RelatedSuggestionIDs []uuid.UUID `gorm:"type:uuid[]" json:"related_suggestion_ids,omitempty"`

	// Status
	Status string `gorm:"default:'pending'" json:"status"` // pending, accepted, rejected, dismissed, auto_applied

	// Review
	ReviewedBy  *uuid.UUID `gorm:"type:uuid" json:"reviewed_by,omitempty"`
	ReviewedAt  *time.Time `json:"reviewed_at,omitempty"`
	ReviewNotes string     `json:"review_notes,omitempty"`

	// If applied
	AppliedVersionID *uuid.UUID `gorm:"type:uuid" json:"applied_version_id,omitempty"`

	CreatedAt time.Time  `gorm:"autoCreateTime" json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

func (AIFieldSuggestion) TableName() string {
	return "ai_field_suggestions"
}

// ============================================================
// CONSTANTS
// ============================================================

// Field type categories
const (
	FieldCategoryPrimitive = "primitive"
	FieldCategoryContainer = "container"
	FieldCategoryLayout    = "layout"
	FieldCategorySpecial   = "special"
)

// Change types
const (
	ChangeTypeCreate   = "create"
	ChangeTypeUpdate   = "update"
	ChangeTypeRestore  = "restore"
	ChangeTypeImport   = "import"
	ChangeTypeAIEdit   = "ai_edit"
	ChangeTypeApproval = "approval"
	ChangeTypeBulk     = "bulk"
)

// Change actions
const (
	ChangeActionAdd     = "add"
	ChangeActionUpdate  = "update"
	ChangeActionRemove  = "remove"
	ChangeActionReorder = "reorder"
)

// Approval statuses
const (
	ApprovalStatusPending   = "pending"
	ApprovalStatusApproved  = "approved"
	ApprovalStatusRejected  = "rejected"
	ApprovalStatusExpired   = "expired"
	ApprovalStatusCancelled = "cancelled"
)

// Suggestion types
const (
	SuggestionTypeTypoCorrection     = "typo_correction"
	SuggestionTypeFormatCorrection   = "format_correction"
	SuggestionTypeSemanticTypeChange = "semantic_type_change"
	SuggestionTypeValidationRule     = "validation_rule"
	SuggestionTypeNormalizeValues    = "normalize_values"
	SuggestionTypeMissingValue       = "missing_value"
	SuggestionTypeDuplicateDetection = "duplicate_detection"
)

// Suggestion statuses
const (
	SuggestionStatusPending     = "pending"
	SuggestionStatusAccepted    = "accepted"
	SuggestionStatusRejected    = "rejected"
	SuggestionStatusDismissed   = "dismissed"
	SuggestionStatusAutoApplied = "auto_applied"
)
