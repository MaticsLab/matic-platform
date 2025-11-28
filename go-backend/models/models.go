package models

import (
	"time"

	"github.com/google/uuid"
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
	Name        string               `gorm:"not null" json:"name"`
	Slug        string               `gorm:"uniqueIndex;not null" json:"slug"`
	Description string               `json:"description"`
	Settings    datatypes.JSON       `gorm:"type:jsonb;default:'{}'" json:"settings"`
	Members     []OrganizationMember `gorm:"foreignKey:OrganizationID" json:"members,omitempty"`
	Workspaces  []Workspace          `gorm:"foreignKey:OrganizationID" json:"workspaces,omitempty"`
}

type OrganizationMember struct {
	BaseModel
	OrganizationID uuid.UUID      `gorm:"type:uuid;not null;index" json:"organization_id"`
	UserID         uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Role           string         `gorm:"type:varchar(50);default:'member'" json:"role"`
	Permissions    datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"permissions"`
}

// Workspace model
type Workspace struct {
	BaseModel
	OrganizationID uuid.UUID         `gorm:"type:uuid;not null;index" json:"organization_id"`
	Name           string            `gorm:"not null" json:"name"`
	Slug           string            `gorm:"not null;index" json:"slug"`
	Description    string            `json:"description"`
	Color          string            `gorm:"default:'#3B82F6'" json:"color"`
	Icon           string            `gorm:"default:'folder'" json:"icon"`
	Settings       datatypes.JSON    `gorm:"type:jsonb;default:'{}'" json:"settings"`
	IsArchived     bool              `gorm:"default:false" json:"is_archived"`
	CreatedBy      uuid.UUID         `gorm:"type:uuid;not null" json:"created_by"`
	Members        []WorkspaceMember `gorm:"foreignKey:WorkspaceID" json:"members,omitempty"`
	Tables         []Table           `gorm:"foreignKey:WorkspaceID" json:"tables,omitempty"`
}

type WorkspaceMember struct {
	BaseModel
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	UserID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Role        string         `gorm:"type:varchar(50);default:'editor'" json:"role"`
	Permissions datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"permissions"`
	AddedAt     time.Time      `gorm:"autoCreateTime" json:"added_at"`
}

// Table (Consolidated DataTable)
type Table struct {
	BaseModel
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	Name        string         `gorm:"not null" json:"name"`
	Slug        string         `gorm:"uniqueIndex" json:"slug"`
	Description string         `json:"description"`
	Icon        string         `gorm:"default:'table'" json:"icon"`
	Color       string         `gorm:"default:'#10B981'" json:"color"`
	HubType     string         `gorm:"default:'data'" json:"hub_type"`       // activities, applications, data
	EntityType  string         `gorm:"default:'generic'" json:"entity_type"` // person, event, application, etc.
	Settings    datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"settings"`
	RowCount    int            `gorm:"default:0" json:"row_count"`
	CreatedBy   uuid.UUID      `gorm:"type:uuid;not null" json:"created_by"`

	// Relationships
	Fields []Field `gorm:"foreignKey:TableID;constraint:OnDelete:CASCADE" json:"columns"`
	Rows   []Row   `gorm:"foreignKey:TableID;constraint:OnDelete:CASCADE" json:"rows"`
	Views  []View  `gorm:"foreignKey:TableID;constraint:OnDelete:CASCADE" json:"views"`
}

func (Table) TableName() string {
	return "data_tables"
}

// Field (Consolidated TableColumn/FormField)
type Field struct {
	BaseModel
	TableID        uuid.UUID      `gorm:"type:uuid;not null;index" json:"table_id"`
	Name           string         `gorm:"not null" json:"name"`    // Internal key
	Label          string         `gorm:"not null" json:"label"`   // Display name
	Type           string         `gorm:"not null" json:"type"`    // text, number, select, etc.
	FieldTypeID    string         `json:"field_type_id,omitempty"` // References field_type_registry.id
	Position       int            `gorm:"default:0" json:"position"`
	Config         datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"config"` // Merged metadata
	SemanticType   string         `json:"semantic_type,omitempty"`               // name, email, phone, status, date, etc.
	IsSearchable   bool           `gorm:"default:true" json:"is_searchable"`
	IsDisplayField bool           `gorm:"default:false" json:"is_display_field"`
	SearchWeight   float64        `gorm:"default:1.0" json:"search_weight"`
	SampleValues   datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"sample_values,omitempty"`
}

func (Field) TableName() string {
	return "table_fields"
}

// Row (Consolidated TableRow/FormSubmission)
type Row struct {
	BaseModel
	TableID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"table_id"`
	Data      datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"data"`
	Metadata  datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"metadata"` // Added Metadata
	Position  int            `gorm:"default:0" json:"position"`
	CreatedBy *uuid.UUID     `gorm:"type:uuid" json:"created_by,omitempty"`
	UpdatedBy *uuid.UUID     `gorm:"type:uuid" json:"updated_by,omitempty"`
}

func (Row) TableName() string {
	return "table_rows"
}

// View (Consolidated TableView/Form)
type View struct {
	BaseModel
	TableID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"table_id"`
	Name      string         `gorm:"not null" json:"name"`
	Type      string         `gorm:"not null" json:"type"` // grid, form, kanban, gallery
	Config    datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"config"`
	CreatedBy uuid.UUID      `gorm:"type:uuid;not null" json:"created_by"`
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
