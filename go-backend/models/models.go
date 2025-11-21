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
	DataTables     []DataTable       `gorm:"foreignKey:WorkspaceID" json:"data_tables,omitempty"`
	Forms          []Form            `gorm:"foreignKey:WorkspaceID" json:"forms,omitempty"`
	ActivitiesHubs []ActivitiesHub   `gorm:"foreignKey:WorkspaceID" json:"activities_hubs,omitempty"`
}

type WorkspaceMember struct {
	BaseModel
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	UserID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Role        string         `gorm:"type:varchar(50);default:'editor'" json:"role"`
	Permissions datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"permissions"`
	AddedAt     time.Time      `gorm:"autoCreateTime" json:"added_at"`
}

// ActivitiesHub model
type ActivitiesHub struct {
	BaseModel
	WorkspaceID  uuid.UUID          `gorm:"type:uuid;not null;index" json:"workspace_id"`
	Name         string             `gorm:"not null" json:"name"`
	Slug         string             `gorm:"not null;index" json:"slug"`
	Description  string             `json:"description"`
	Category     string             `json:"category"`
	BeginDate    *time.Time         `json:"begin_date"`
	EndDate      *time.Time         `json:"end_date"`
	Status       string             `gorm:"default:'upcoming'" json:"status"` // active, upcoming, completed
	Participants int                `gorm:"default:0" json:"participants"`
	Settings     datatypes.JSON     `gorm:"type:jsonb;default:'{}'" json:"settings"`
	IsActive     bool               `gorm:"default:true" json:"is_active"`
	CreatedBy    uuid.UUID          `gorm:"type:uuid;not null" json:"created_by"`
	Tabs         []ActivitiesHubTab `gorm:"foreignKey:HubID" json:"tabs,omitempty"`
}

type ActivitiesHubTab struct {
	BaseModel
	HubID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"hub_id"`
	Name      string         `gorm:"not null" json:"name"`
	Slug      string         `gorm:"not null" json:"slug"`
	Type      string         `gorm:"not null" json:"type"` // dashboard, attendance, participants, etc.
	Icon      string         `json:"icon"`
	Position  int            `gorm:"default:0" json:"position"`
	IsVisible bool           `gorm:"default:true" json:"is_visible"`
	Config    datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"config"`
}

// DataTable model
type DataTable struct {
	BaseModel
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	Name        string         `gorm:"not null" json:"name"`
	Description string         `json:"description"`
	Icon        string         `gorm:"default:'table'" json:"icon"`
	Settings    datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"settings"`
	Columns     []TableColumn  `gorm:"foreignKey:TableID" json:"columns,omitempty"`
	Rows        []TableRow     `gorm:"foreignKey:TableID" json:"rows,omitempty"`
	Views       []TableView    `gorm:"foreignKey:TableID" json:"views,omitempty"`
}

type TableColumn struct {
	BaseModel
	TableID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"table_id"`
	Name         string         `gorm:"not null" json:"name"`
	Type         string         `gorm:"not null" json:"type"` // text, number, select, etc.
	Position     int            `gorm:"default:0" json:"position"`
	Width        int            `gorm:"default:200" json:"width"`
	IsRequired   bool           `gorm:"default:false" json:"is_required"`
	IsPrimaryKey bool           `gorm:"default:false" json:"is_primary_key"`
	Options      datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"options"`
	Validation   datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"validation"`
}

type TableRow struct {
	BaseModel
	TableID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"table_id"`
	Position  int            `gorm:"default:0" json:"position"`
	Data      datatypes.JSON `gorm:"type:jsonb;not null" json:"data"`
	CreatedBy *uuid.UUID     `gorm:"type:uuid" json:"created_by,omitempty"`
	UpdatedBy *uuid.UUID     `gorm:"type:uuid" json:"updated_by,omitempty"`
}

type TableView struct {
	BaseModel
	TableID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"table_id"`
	Name        string         `gorm:"not null" json:"name"`
	Type        string         `gorm:"not null" json:"type"` // grid, kanban, calendar, etc.
	IsDefault   bool           `gorm:"default:false" json:"is_default"`
	Filters     datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"filters"`
	Sorts       datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"sorts"`
	VisibleCols []string       `gorm:"type:text[]" json:"visible_columns"`
}

// TableLink - Defines relationships between tables (schema-level)
type TableLink struct {
	BaseModel
	SourceTableID uuid.UUID      `gorm:"type:uuid;not null;index" json:"source_table_id"`
	TargetTableID uuid.UUID      `gorm:"type:uuid;not null;index" json:"target_table_id"`
	LinkType      string         `gorm:"column:link_type;not null" json:"link_type"` // one_to_many, many_to_many
	Settings      datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"settings"`
}

// TableRowLink - Links specific rows together (data-level)
type TableRowLink struct {
	BaseModel
	LinkID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"link_id"` // References TableLink.ID
	SourceRowID uuid.UUID      `gorm:"type:uuid;not null;index" json:"source_row_id"`
	TargetRowID uuid.UUID      `gorm:"type:uuid;not null;index" json:"target_row_id"`
	LinkData    datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"link_data"` // Metadata like enrollment_date, status, notes
}

// Form model
type Form struct {
	BaseModel
	WorkspaceID uuid.UUID        `gorm:"type:uuid;not null;index" json:"workspace_id"`
	Name        string           `gorm:"not null" json:"name"`
	Description string           `json:"description"`
	Settings    datatypes.JSON   `gorm:"type:jsonb;default:'{}'" json:"settings"`
	IsPublished bool             `gorm:"default:false" json:"is_published"`
	Fields      []FormField      `gorm:"foreignKey:FormID" json:"fields,omitempty"`
	Submissions []FormSubmission `gorm:"foreignKey:FormID" json:"submissions,omitempty"`
}

type FormField struct {
	BaseModel
	FormID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"form_id"`
	Label       string         `gorm:"not null" json:"label"`
	Type        string         `gorm:"not null" json:"type"`
	Position    int            `gorm:"default:0" json:"position"`
	IsRequired  bool           `gorm:"default:false" json:"is_required"`
	Placeholder string         `json:"placeholder"`
	Options     datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"options"`
	Validation  datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"validation"`
}

type FormSubmission struct {
	BaseModel
	FormID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"form_id"`
	Data        datatypes.JSON `gorm:"type:jsonb;not null" json:"data"`
	SubmittedBy uuid.UUID      `gorm:"type:uuid" json:"submitted_by"`
	IPAddress   string         `json:"ip_address"`
	UserAgent   string         `json:"user_agent"`
}
