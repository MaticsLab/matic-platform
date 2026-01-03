package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// ============================================================
// SUB-MODULES
// ============================================================

// SubModule represents a child module within a parent module
// For example, "Events" within the Attendance module
type SubModule struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	ParentModuleID string    `gorm:"not null" json:"parent_module_id"`
	HubID          uuid.UUID `gorm:"type:uuid;not null" json:"hub_id"`
	Name           string    `gorm:"not null" json:"name"`
	Slug           string    `gorm:"not null" json:"slug"`
	Description    string    `json:"description"`
	Icon           string    `json:"icon"`

	// Data storage options
	DataTableID     *uuid.UUID     `gorm:"type:uuid" json:"data_table_id,omitempty"`
	UsesParentTable bool           `gorm:"default:true" json:"uses_parent_table"`
	FilterConfig    datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"filter_config"`

	// Configuration
	Settings  datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"settings"`
	IsEnabled bool           `gorm:"default:true" json:"is_enabled"`
	Position  int            `gorm:"default:0" json:"position"`

	// Metadata
	CreatedBy *uuid.UUID `gorm:"type:uuid" json:"created_by,omitempty"` // Legacy Supabase UUID
	BACreatedBy *string   `gorm:"type:text;index" json:"ba_created_by,omitempty"` // Better Auth user ID (TEXT)
	CreatedAt time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time  `gorm:"autoUpdateTime" json:"updated_at"`

	// Relationships
	ParentModule *ModuleDefinition `gorm:"foreignKey:ParentModuleID" json:"parent_module,omitempty"`
	Hub          *Table            `gorm:"foreignKey:HubID" json:"hub,omitempty"`
	DataTable    *Table            `gorm:"foreignKey:DataTableID" json:"data_table,omitempty"`
}

func (SubModule) TableName() string {
	return "sub_modules"
}

// ============================================================
// MODULE FIELD CONFIGS
// ============================================================

// ModuleFieldConfig defines which fields are required/optional per module
type ModuleFieldConfig struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	ModuleID      string         `gorm:"not null" json:"module_id"`
	FieldTypeID   string         `gorm:"not null" json:"field_type_id"`
	IsRequired    bool           `gorm:"default:false" json:"is_required"`
	IsAutoCreated bool           `gorm:"default:false" json:"is_auto_created"`
	DefaultConfig datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"default_config"`
	DisplayOrder  int            `gorm:"default:0" json:"display_order"`
	CreatedAt     time.Time      `gorm:"autoCreateTime" json:"created_at"`

	// Relationships
	Module    *ModuleDefinition  `gorm:"foreignKey:ModuleID" json:"module,omitempty"`
	FieldType *FieldTypeRegistry `gorm:"foreignKey:FieldTypeID" json:"field_type,omitempty"`
}

func (ModuleFieldConfig) TableName() string {
	return "module_field_configs"
}

// ============================================================
// MODULE HISTORY SETTINGS
// ============================================================

// ModuleHistorySettings overrides history/approval settings per module
type ModuleHistorySettings struct {
	ID                uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	HubModuleConfigID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex" json:"hub_module_config_id"`

	// Version tracking overrides (null = use table defaults)
	TrackChanges         *bool `json:"track_changes,omitempty"`
	RequireChangeReason  *bool `json:"require_change_reason,omitempty"`
	VersionRetentionDays *int  `json:"version_retention_days,omitempty"`

	// Approval overrides
	RequireApproval   *bool       `json:"require_approval,omitempty"`
	ApprovalType      string      `json:"approval_type,omitempty"` // table_owner, workspace_admin, specific_user
	SpecificApprovers []uuid.UUID `gorm:"type:uuid[]" json:"specific_approvers,omitempty"`

	// AI settings overrides
	EnableAISuggestions *bool    `json:"enable_ai_suggestions,omitempty"`
	AutoApplyThreshold  *float64 `json:"auto_apply_threshold,omitempty"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relationships
	HubModuleConfig *HubModuleConfig `gorm:"foreignKey:HubModuleConfigID" json:"hub_module_config,omitempty"`
}

func (ModuleHistorySettings) TableName() string {
	return "module_history_settings"
}

// ============================================================
// EXTENDED HUB MODULE CONFIG
// ============================================================

// HubModuleConfigExtended includes field-related settings
type HubModuleConfigExtended struct {
	HubModuleConfig
	AutoCreateFields     bool           `gorm:"default:true" json:"auto_create_fields"`
	CustomFieldOverrides datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"custom_field_overrides"`
}

func (HubModuleConfigExtended) TableName() string {
	return "hub_module_configs"
}

// ============================================================
// DTO TYPES
// ============================================================

// SubModuleWithData includes the sub-module with its data table info
type SubModuleWithData struct {
	SubModule
	RowCount   int                 `json:"row_count"`
	LastUpdate *time.Time          `json:"last_update,omitempty"`
	Fields     []ModuleFieldConfig `json:"fields,omitempty"`
}

// CreateSubModuleInput for creating a new sub-module
type CreateSubModuleInput struct {
	ParentModuleID  string                 `json:"parent_module_id" binding:"required"`
	HubID           string                 `json:"hub_id" binding:"required"`
	Name            string                 `json:"name" binding:"required"`
	Slug            string                 `json:"slug"`
	Description     string                 `json:"description"`
	Icon            string                 `json:"icon"`
	UsesParentTable bool                   `json:"uses_parent_table"`
	FilterConfig    map[string]interface{} `json:"filter_config"`
	Settings        map[string]interface{} `json:"settings"`
}

// UpdateSubModuleInput for updating a sub-module
type UpdateSubModuleInput struct {
	Name         *string                 `json:"name"`
	Description  *string                 `json:"description"`
	Icon         *string                 `json:"icon"`
	IsEnabled    *bool                   `json:"is_enabled"`
	Position     *int                    `json:"position"`
	FilterConfig *map[string]interface{} `json:"filter_config"`
	Settings     *map[string]interface{} `json:"settings"`
}

// ModuleFieldsResponse for listing module fields
type ModuleFieldsResponse struct {
	ModuleID     string              `json:"module_id"`
	ModuleName   string              `json:"module_name"`
	Fields       []ModuleFieldConfig `json:"fields"`
	SystemFields []FieldTypeRegistry `json:"system_fields"`
}

// HubModulesWithFieldsResponse extends HubModulesResponse with field info
type HubModulesWithFieldsResponse struct {
	TableID          uuid.UUID           `json:"table_id"`
	HubType          string              `json:"hub_type"`
	EnabledModules   []ModuleWithFields  `json:"enabled_modules"`
	AvailableModules []ModuleWithStatus  `json:"available_modules"`
	SubModules       []SubModuleWithData `json:"sub_modules"`
}

// ModuleWithFields includes module definition with its field configs
type ModuleWithFields struct {
	ModuleWithStatus
	Fields          []ModuleFieldConfig    `json:"fields"`
	SubModules      []SubModule            `json:"sub_modules,omitempty"`
	HistorySettings *ModuleHistorySettings `json:"history_settings,omitempty"`
}

// ============================================================
// CONSTANTS
// ============================================================

// Module IDs for type safety
const (
	ModuleTables         = "tables"
	ModuleViews          = "views"
	ModuleForms          = "forms"
	ModulePulse          = "pulse"
	ModuleAttendance     = "attendance"
	ModuleCalendar       = "calendar"
	ModuleReviewWorkflow = "review_workflow"
	ModuleRubrics        = "rubrics"
	ModuleReviewerPortal = "reviewer_portal"
	ModuleDecisionLogic  = "decision_logic"
	ModuleAnalytics      = "analytics"
	ModuleExport         = "export"
	ModuleNotifications  = "notifications"
	ModuleEmailTemplates = "email_templates"
)

// Module-specific field types
const (
	FieldTypeScanResult         = "scan_result"
	FieldTypeAttendanceStatus   = "attendance_status"
	FieldTypeReviewScore        = "review_score"
	FieldTypeStageStatus        = "stage_status"
	FieldTypeReviewerAssignment = "reviewer_assignment"
	FieldTypeRubricResponse     = "rubric_response"
	FieldTypeCalendarEvent      = "calendar_event"
)
