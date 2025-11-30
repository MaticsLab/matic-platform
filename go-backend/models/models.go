package models

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Base model with common fields
type BaseModel struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// BeforeCreate hook to generate UUID
func (b *BaseModel) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}

// Organization model
type Organization struct {
	BaseModel
	Name             string               `gorm:"not null" json:"name"`
	Slug             string               `gorm:"uniqueIndex;not null" json:"slug"`
	Description      string               `json:"description"`
	LogoURL          string               `json:"logo_url,omitempty"`
	Settings         datatypes.JSON       `gorm:"type:jsonb;default:'{}'" json:"settings"`
	SubscriptionTier string               `gorm:"default:'free'" json:"subscription_tier"`
	Members          []OrganizationMember `gorm:"foreignKey:OrganizationID" json:"members,omitempty"`
	Workspaces       []Workspace          `gorm:"foreignKey:OrganizationID" json:"workspaces,omitempty"`
}

type OrganizationMember struct {
	ID             uuid.UUID      `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	OrganizationID uuid.UUID      `gorm:"type:uuid;not null;index" json:"organization_id"`
	UserID         uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Role           string         `gorm:"type:varchar(50);default:'member'" json:"role"`
	Permissions    datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"permissions"`
	JoinedAt       time.Time      `gorm:"autoCreateTime" json:"joined_at"`
	UpdatedAt      time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
}

// BeforeCreate hook for OrganizationMember
func (m *OrganizationMember) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}

// Workspace model
// Maps to workspaces in database
type Workspace struct {
	BaseModel
	OrganizationID  uuid.UUID         `gorm:"type:uuid;not null;index" json:"organization_id"`
	Name            string            `gorm:"not null" json:"name"`
	Slug            string            `gorm:"not null;index" json:"slug"`
	CustomSubdomain *string           `gorm:"uniqueIndex" json:"custom_subdomain,omitempty"` // Custom subdomain for pretty portal URLs
	Description     string            `json:"description"`
	Color           string            `gorm:"default:'#3B82F6'" json:"color"`
	Icon            string            `gorm:"default:'folder'" json:"icon"`
	Settings        datatypes.JSON    `gorm:"type:jsonb;default:'{}'" json:"settings"`
	IsArchived      bool              `gorm:"default:false" json:"is_archived"`
	CreatedBy       uuid.UUID         `gorm:"type:uuid;not null" json:"created_by"`
	LogoURL         string            `json:"logo_url,omitempty"`
	AIDescription   string            `gorm:"column:ai_description" json:"ai_description,omitempty"`
	DataSummary     datatypes.JSON    `gorm:"type:jsonb" json:"data_summary,omitempty"`
	Members         []WorkspaceMember `gorm:"foreignKey:WorkspaceID" json:"members,omitempty"`
	Tables          []Table           `gorm:"foreignKey:WorkspaceID" json:"tables,omitempty"`
}

type WorkspaceMember struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	UserID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Role        string         `gorm:"type:varchar(50);default:'editor'" json:"role"`
	Permissions datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"permissions"`
	AddedAt     time.Time      `gorm:"autoCreateTime" json:"added_at"`
}

// BeforeCreate hook for WorkspaceMember
func (m *WorkspaceMember) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}

// Table (Consolidated DataTable)
// Maps to data_tables in database
type Table struct {
	BaseModel
	WorkspaceID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	Name             string         `gorm:"not null" json:"name"`
	Slug             string         `gorm:"uniqueIndex" json:"slug"`
	CustomSlug       *string        `gorm:"uniqueIndex" json:"custom_slug,omitempty"` // Optional custom URL for public portals
	Description      string         `json:"description"`
	Icon             string         `gorm:"default:'table'" json:"icon"`
	Color            string         `gorm:"default:'#10B981'" json:"color"`
	HubType          string         `gorm:"default:'data'" json:"hub_type"`       // activities, applications, data
	EntityType       string         `gorm:"default:'generic'" json:"entity_type"` // person, event, application, etc.
	Settings         datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"settings"`
	ImportSource     string         `json:"import_source,omitempty"` // Where data was imported from
	ImportMetadata   datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"import_metadata"`
	IsArchived       bool           `gorm:"default:false" json:"is_archived"`
	RowCount         int            `gorm:"default:0" json:"row_count"`
	HistorySettings  datatypes.JSON `gorm:"type:jsonb" json:"history_settings,omitempty"`               // Version history config
	ApprovalSettings datatypes.JSON `gorm:"type:jsonb" json:"approval_settings,omitempty"`              // Change approval config
	AISettings       datatypes.JSON `gorm:"column:ai_settings;type:jsonb" json:"ai_settings,omitempty"` // AI suggestion settings
	CreatedBy        uuid.UUID      `gorm:"type:uuid;not null" json:"created_by"`

	// Relationships
	Fields []Field `gorm:"foreignKey:TableID;constraint:OnDelete:CASCADE" json:"columns"`
	Rows   []Row   `gorm:"foreignKey:TableID;constraint:OnDelete:CASCADE" json:"rows"`
	Views  []View  `gorm:"foreignKey:TableID;constraint:OnDelete:CASCADE" json:"views"`
}

func (Table) TableName() string {
	return "data_tables"
}

// Field (Consolidated TableColumn/FormField)
// Maps to table_fields in database
type Field struct {
	BaseModel
	TableID             uuid.UUID      `gorm:"type:uuid;not null;index" json:"table_id"`
	FieldTypeID         string         `json:"field_type_id,omitempty"`                           // References field_type_registry.id
	Name                string         `gorm:"not null" json:"name"`                              // Internal key
	Label               string         `gorm:"not null" json:"label"`                             // Display name
	Description         string         `json:"description,omitempty"`                             // Field description
	Type                string         `gorm:"not null" json:"type"`                              // text, number, select, link, etc. (legacy, use field_type_id)
	Config              datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"config"`             // Instance configuration (merged with registry default_config)
	Settings            datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"settings"`           // Type-specific settings (legacy)
	Validation          datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"validation"`         // Validation rules (legacy)
	Formula             string         `json:"formula,omitempty"`                                 // Calculated field formula
	FormulaDependencies []string       `gorm:"type:text[]" json:"formula_dependencies,omitempty"` // Fields formula depends on
	LinkedTableID       *uuid.UUID     `gorm:"type:uuid" json:"linked_table_id,omitempty"`        // For link fields
	LinkedColumnID      *uuid.UUID     `gorm:"type:uuid" json:"linked_column_id,omitempty"`       // Display column for link
	RollupFunction      string         `json:"rollup_function,omitempty"`                         // Aggregation function for rollups
	Position            int            `gorm:"default:0" json:"position"`                         // Display order
	Width               int            `gorm:"default:150" json:"width"`                          // Column width in pixels
	IsVisible           bool           `gorm:"default:true" json:"is_visible"`                    // Show in table view
	IsPrimary           bool           `gorm:"default:false" json:"is_primary"`                   // Primary display field
	ParentFieldID       *uuid.UUID     `gorm:"type:uuid" json:"parent_field_id,omitempty"`        // For nested fields (group/repeater children)
	SemanticType        string         `json:"semantic_type,omitempty"`                           // name, email, phone, status, date, etc.
	IsSearchable        bool           `gorm:"default:true" json:"is_searchable"`                 // Include in search
	IsDisplayField      bool           `gorm:"default:false" json:"is_display_field"`             // Use as display in links
	SearchWeight        float64        `gorm:"default:1.0" json:"search_weight"`                  // Search ranking weight
	SampleValues        datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"sample_values"`      // Cached sample values

	// Relationships (populated when preloading)
	FieldType *FieldTypeRegistry `gorm:"foreignKey:FieldTypeID;references:ID" json:"field_type,omitempty"`
	Children  []Field            `gorm:"foreignKey:ParentFieldID" json:"children,omitempty"`
}

func (Field) TableName() string {
	return "table_fields"
}

// Row (Consolidated TableRow/FormSubmission)
type Row struct {
	BaseModel
	TableID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"table_id"`
	Data         datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"data"`
	Metadata     datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	IsArchived   bool           `gorm:"default:false" json:"is_archived"`
	Position     int64          `gorm:"default:0" json:"position"` // bigint in database
	StageGroupID *uuid.UUID     `gorm:"type:uuid" json:"stage_group_id,omitempty"`
	Tags         datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"tags"`
	CreatedBy    *uuid.UUID     `gorm:"type:uuid" json:"created_by,omitempty"`
	UpdatedBy    *uuid.UUID     `gorm:"type:uuid" json:"updated_by,omitempty"`
}

func (Row) TableName() string {
	return "table_rows"
}

// View (Consolidated TableView/Form)
// Maps to table_views in database
type View struct {
	BaseModel
	TableID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"table_id"`
	Name        string         `gorm:"not null" json:"name"`
	Description string         `json:"description,omitempty"`
	Type        string         `gorm:"not null" json:"type"` // grid, form, kanban, gallery, calendar, timeline
	Settings    datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"settings"`
	Filters     datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"filters"`
	Sorts       datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"sorts"`
	Grouping    datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"grouping"`
	Config      datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"config"`
	IsShared    bool           `gorm:"default:false" json:"is_shared"`
	IsLocked    bool           `gorm:"default:false" json:"is_locked"`
	CreatedBy   uuid.UUID      `gorm:"type:uuid;not null" json:"created_by"`
}

func (View) TableName() string {
	return "table_views"
}

// TableLink - Defines relationships between tables (schema-level)
// Note: This table doesn't have updated_at column, so we don't use BaseModel
type TableLink struct {
	ID             uuid.UUID      `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CreatedAt      time.Time      `gorm:"column:created_at" json:"created_at"`
	SourceTableID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"source_table_id"`
	SourceColumnID uuid.UUID      `gorm:"type:uuid;not null;index" json:"source_column_id"`
	TargetTableID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"target_table_id"`
	TargetColumnID *uuid.UUID     `gorm:"type:uuid;index" json:"target_column_id,omitempty"`
	LinkType       string         `gorm:"column:link_type;not null" json:"link_type"` // one_to_many, many_to_many
	Settings       datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"settings"`
}

// TableName specifies the table name for TableLink
func (TableLink) TableName() string {
	return "table_links"
}

// BeforeCreate hook to generate UUID and set CreatedAt
func (t *TableLink) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	if t.CreatedAt.IsZero() {
		t.CreatedAt = time.Now()
	}
	return nil
}

// TableRowLink - Links specific rows together (data-level)
// Note: This table doesn't have updated_at column, so we don't use BaseModel
type TableRowLink struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CreatedAt   time.Time      `gorm:"column:created_at" json:"created_at"`
	LinkID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"link_id"` // References TableLink.ID
	SourceRowID uuid.UUID      `gorm:"type:uuid;not null;index" json:"source_row_id"`
	TargetRowID uuid.UUID      `gorm:"type:uuid;not null;index" json:"target_row_id"`
	LinkData    datatypes.JSON `gorm:"column:metadata;type:jsonb;default:'{}'" json:"link_data"` // Metadata like enrollment_date, status, notes
}

// TableName specifies the table name for TableRowLink
func (TableRowLink) TableName() string {
	return "table_row_links"
}

// BeforeCreate hook to generate UUID and set CreatedAt
func (t *TableRowLink) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	if t.CreatedAt.IsZero() {
		t.CreatedAt = time.Now()
	}
	return nil
}

// TableFile - File attachments for any table/row/field
type TableFile struct {
	ID               uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TableID          *uuid.UUID     `gorm:"type:uuid;index" json:"table_id,omitempty"`
	RowID            *uuid.UUID     `gorm:"type:uuid;index" json:"row_id,omitempty"`
	FieldID          *uuid.UUID     `gorm:"type:uuid;index" json:"field_id,omitempty"`
	WorkspaceID      *uuid.UUID     `gorm:"type:uuid;index" json:"workspace_id,omitempty"`
	Filename         string         `gorm:"not null" json:"filename"`
	OriginalFilename string         `gorm:"not null" json:"original_filename"`
	MimeType         string         `gorm:"not null" json:"mime_type"`
	SizeBytes        int64          `gorm:"not null" json:"size_bytes"`
	StorageBucket    string         `gorm:"not null;default:'workspace-assets'" json:"storage_bucket"`
	StoragePath      string         `gorm:"not null" json:"storage_path"`
	PublicURL        string         `json:"public_url,omitempty"`
	Description      string         `json:"description,omitempty"`
	AltText          string         `json:"alt_text,omitempty"`
	Metadata         datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	Tags             pq.StringArray `gorm:"type:text[]" json:"tags"`
	Version          int            `gorm:"default:1" json:"version"`
	ParentFileID     *uuid.UUID     `gorm:"type:uuid" json:"parent_file_id,omitempty"`
	IsCurrent        bool           `gorm:"default:true" json:"is_current"`
	UploadedBy       *uuid.UUID     `gorm:"type:uuid" json:"uploaded_by,omitempty"`
	CreatedAt        time.Time      `gorm:"column:created_at" json:"created_at"`
	UpdatedAt        time.Time      `gorm:"column:updated_at" json:"updated_at"`
	DeletedAt        *time.Time     `gorm:"column:deleted_at" json:"deleted_at,omitempty"`
}

func (TableFile) TableName() string {
	return "table_files"
}

// BeforeCreate hook to generate UUID
func (f *TableFile) BeforeCreate(tx *gorm.DB) error {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	if f.CreatedAt.IsZero() {
		f.CreatedAt = time.Now()
	}
	if f.UpdatedAt.IsZero() {
		f.UpdatedAt = time.Now()
	}
	return nil
}

// BeforeUpdate hook to update timestamp
func (f *TableFile) BeforeUpdate(tx *gorm.DB) error {
	f.UpdatedAt = time.Now()
	return nil
}

// GetFileCategory returns the category based on MIME type
func (f *TableFile) GetFileCategory() string {
	switch {
	case strings.HasPrefix(f.MimeType, "image/"):
		return "image"
	case strings.HasPrefix(f.MimeType, "video/"):
		return "video"
	case strings.HasPrefix(f.MimeType, "audio/"):
		return "audio"
	case f.MimeType == "application/pdf":
		return "pdf"
	case strings.Contains(f.MimeType, "spreadsheet") || strings.Contains(f.MimeType, "excel"):
		return "spreadsheet"
	case strings.Contains(f.MimeType, "word") || strings.Contains(f.MimeType, "document"):
		return "document"
	default:
		return "file"
	}
}

// FormatSize returns human-readable file size
func (f *TableFile) FormatSize() string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)
	switch {
	case f.SizeBytes >= GB:
		return fmt.Sprintf("%.2f GB", float64(f.SizeBytes)/float64(GB))
	case f.SizeBytes >= MB:
		return fmt.Sprintf("%.2f MB", float64(f.SizeBytes)/float64(MB))
	case f.SizeBytes >= KB:
		return fmt.Sprintf("%.2f KB", float64(f.SizeBytes)/float64(KB))
	default:
		return fmt.Sprintf("%d bytes", f.SizeBytes)
	}
}
