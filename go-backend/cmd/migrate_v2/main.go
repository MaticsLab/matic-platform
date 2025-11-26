package main

import (
	"encoding/json"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"gorm.io/datatypes"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

// --- Old Models ---

type OldDataTable struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid"`
	Name        string         `gorm:"not null"`
	Slug        string         `gorm:"not null"`
	Description string         ``
	Icon        string         `gorm:"default:'table'"`
	Color       string         `gorm:"default:'#10B981'"`
	Settings    datatypes.JSON `gorm:"type:jsonb"`
	RowCount    int            `gorm:"default:0"`
	CreatedBy   uuid.UUID      `gorm:"type:uuid"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (OldDataTable) TableName() string { return "data_tables" }

type OldTableColumn struct {
	ID            uuid.UUID      `gorm:"type:uuid;primary_key"`
	TableID       uuid.UUID      `gorm:"type:uuid"`
	Name          string         `gorm:"not null"`
	Label         string         `gorm:"not null"`
	Type          string         `gorm:"column:column_type"`
	Position      int            `gorm:"default:0"`
	Width         int            `gorm:"default:200"`
	IsVisible     bool           `gorm:"column:is_visible"`
	IsPrimary     bool           `gorm:"column:is_primary"`
	LinkedTableID *uuid.UUID     `gorm:"type:uuid"`
	Options       datatypes.JSON `gorm:"column:settings;type:jsonb"`
	Validation    datatypes.JSON `gorm:"type:jsonb"`
}

func (OldTableColumn) TableName() string { return "table_columns" }

type OldTableRow struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key"`
	TableID   uuid.UUID      `gorm:"type:uuid"`
	Position  int            `gorm:"default:0"`
	Data      datatypes.JSON `gorm:"type:jsonb"`
	CreatedBy *uuid.UUID     `gorm:"type:uuid"`
	UpdatedBy *uuid.UUID     `gorm:"type:uuid"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (OldTableRow) TableName() string { return "table_rows" }

type OldTableView struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key"`
	TableID     uuid.UUID      `gorm:"type:uuid"`
	Name        string         `gorm:"not null"`
	Type        string         `gorm:"not null"`
	IsDefault   bool           `gorm:"default:false"`
	Filters     datatypes.JSON `gorm:"type:jsonb"`
	Sorts       datatypes.JSON `gorm:"type:jsonb"`
	VisibleCols datatypes.JSON `gorm:"type:jsonb"`
}

func (OldTableView) TableName() string { return "table_views" }

type OldForm struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid"`
	Name        string         `gorm:"not null"`
	Slug        string         `gorm:"not null"`
	Description string         ``
	Settings    datatypes.JSON `gorm:"type:jsonb"`
	IsPublished bool           `gorm:"default:false"`
	CreatedBy   uuid.UUID      `gorm:"type:uuid"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (OldForm) TableName() string { return "forms" }

type OldFormField struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key"`
	FormID      uuid.UUID      `gorm:"type:uuid"`
	Name        string         `gorm:"not null"`
	Label       string         `gorm:"not null"`
	Type        string         `gorm:"column:type"`
	FieldType   string         `gorm:"column:field_type"`
	Position    int            `gorm:"default:0"`
	Width       string         `gorm:"default:'full'"`
	IsVisible   bool           `gorm:"default:true"`
	IsRequired  bool           `gorm:"default:false"`
	Placeholder string         ``
	Options     datatypes.JSON `gorm:"type:jsonb"`
	Validation  datatypes.JSON `gorm:"type:jsonb"`
}

func (OldFormField) TableName() string { return "form_fields" }

type OldFormSubmission struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key"`
	FormID      uuid.UUID      `gorm:"type:uuid"`
	Data        datatypes.JSON `gorm:"type:jsonb"`
	SubmittedBy uuid.UUID      `gorm:"type:uuid"`
	IPAddress   string         ``
	UserAgent   string         ``
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (OldFormSubmission) TableName() string { return "form_submissions" }

// --- New Models ---

type Table struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null;index"`
	Name        string         `gorm:"not null"`
	Slug        string         `gorm:"uniqueIndex"`
	Description string         ``
	Icon        string         `gorm:"default:'table'"`
	Color       string         `gorm:"default:'#10B981'"`
	Settings    datatypes.JSON `gorm:"type:jsonb;default:'{}'"`
	RowCount    int            `gorm:"default:0"`
	CreatedBy   uuid.UUID      `gorm:"type:uuid;not null"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (Table) TableName() string { return "data_tables" }

type Field struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	TableID   uuid.UUID      `gorm:"type:uuid;not null;index"`
	Name      string         `gorm:"not null"`
	Label     string         `gorm:"not null"`
	Type      string         `gorm:"not null"`
	Position  int            `gorm:"default:0"`
	Config    datatypes.JSON `gorm:"type:jsonb;default:'{}'"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (Field) TableName() string { return "table_fields" }

type Row struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	TableID   uuid.UUID      `gorm:"type:uuid;not null;index"`
	Data      datatypes.JSON `gorm:"type:jsonb;default:'{}'"`
	Position  int            `gorm:"default:0"`
	CreatedBy *uuid.UUID     `gorm:"type:uuid"`
	UpdatedBy *uuid.UUID     `gorm:"type:uuid"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (Row) TableName() string { return "table_rows" }

type View struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	TableID   uuid.UUID      `gorm:"type:uuid;not null;index"`
	Name      string         `gorm:"not null"`
	Type      string         `gorm:"not null"`
	Config    datatypes.JSON `gorm:"type:jsonb;default:'{}'"`
	CreatedBy uuid.UUID      `gorm:"type:uuid;not null"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (View) TableName() string { return "table_views" }

func main() {
	// Load .env
	if err := godotenv.Load(".env"); err != nil {
		// Try loading from parent if not found (in case we run from subdir)
		if err := godotenv.Load("../../.env"); err != nil {
			log.Println("Warning: .env file not found")
		}
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL not set")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	log.Println("Starting migration...")

	// 1. Read existing data
	var oldTables []OldDataTable
	var oldColumns []OldTableColumn
	var oldRows []OldTableRow
	var oldViews []OldTableView
	var oldForms []OldForm
	var oldFormFields []OldFormField
	var oldSubmissions []OldFormSubmission

	if db.Migrator().HasTable("data_tables") {
		db.Find(&oldTables)
	}
	if db.Migrator().HasTable("table_columns") {
		db.Find(&oldColumns)
	}
	if db.Migrator().HasTable("table_rows") {
		db.Find(&oldRows)
	}
	if db.Migrator().HasTable("table_views") {
		db.Find(&oldViews)
	}
	if db.Migrator().HasTable("forms") {
		db.Find(&oldForms)
	}
	if db.Migrator().HasTable("form_fields") {
		db.Find(&oldFormFields)
	}
	if db.Migrator().HasTable("form_submissions") {
		db.Find(&oldSubmissions)
	}

	log.Printf("Found: %d tables, %d columns, %d rows, %d views, %d forms, %d fields, %d submissions\n",
		len(oldTables), len(oldColumns), len(oldRows), len(oldViews), len(oldForms), len(oldFormFields), len(oldSubmissions))

	// 2. AutoMigrate new schema
	if db.Migrator().HasTable("table_columns") && !db.Migrator().HasTable("table_fields") {
		log.Println("Renaming table_columns to table_fields...")
		db.Migrator().RenameTable("table_columns", "table_fields")
	}

	// Rename column_type to type in table_fields if it exists
	if db.Migrator().HasColumn("table_fields", "column_type") {
		log.Println("Renaming column_type to type in table_fields...")
		db.Migrator().RenameColumn("table_fields", "column_type", "type")
	}

	// Rename view_type to type in table_views if it exists
	if db.Migrator().HasColumn("table_views", "view_type") {
		log.Println("Renaming view_type to type in table_views...")
		db.Migrator().RenameColumn("table_views", "view_type", "type")
	}

	// Drop check constraint on table_fields type if it exists
	// We need to allow new types like 'group', 'repeater', etc.
	db.Exec("ALTER TABLE table_fields DROP CONSTRAINT IF EXISTS table_columns_column_type_check")

	log.Println("Running AutoMigrate...")
	if err := db.AutoMigrate(&Table{}, &Field{}, &Row{}, &View{}); err != nil {
		log.Fatal("AutoMigrate failed:", err)
	}

	// 3. Migrate Data

	// Migrate Old Columns to New Fields
	for _, col := range oldColumns {
		config := make(map[string]interface{})

		var opts map[string]interface{}
		if len(col.Options) > 0 {
			json.Unmarshal(col.Options, &opts)
		}
		for k, v := range opts {
			config[k] = v
		}

		var val map[string]interface{}
		if len(col.Validation) > 0 {
			json.Unmarshal(col.Validation, &val)
		}
		if len(val) > 0 {
			config["validation"] = val
		}

		config["width"] = col.Width
		config["is_visible"] = col.IsVisible
		config["is_primary"] = col.IsPrimary
		if col.LinkedTableID != nil {
			config["linked_table_id"] = col.LinkedTableID
		}

		configJSON, _ := json.Marshal(config)

		db.Model(&Field{}).Where("id = ?", col.ID).Updates(map[string]interface{}{
			"config": datatypes.JSON(configJSON),
			"type":   col.Type,
		})
	}

	// Migrate Forms -> Tables + Views
	for _, form := range oldForms {
		newTable := Table{
			ID:          form.ID,
			WorkspaceID: form.WorkspaceID,
			Name:        form.Name,
			Slug:        form.Slug,
			Description: form.Description,
			Settings:    form.Settings,
			CreatedBy:   form.CreatedBy,
			CreatedAt:   form.CreatedAt,
			UpdatedAt:   form.UpdatedAt,
			Icon:        "form",
		}

		var count int64
		db.Model(&Table{}).Where("id = ?", form.ID).Count(&count)
		if count == 0 {
			if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&newTable).Error; err != nil {
				log.Printf("Error creating table for form %s: %v", form.Name, err)
				continue
			}
		}

		viewConfig := map[string]interface{}{
			"is_published": form.IsPublished,
		}
		viewConfigJSON, _ := json.Marshal(viewConfig)

		newView := View{
			TableID:   newTable.ID,
			Name:      "Form View",
			Type:      "form",
			Config:    datatypes.JSON(viewConfigJSON),
			CreatedBy: form.CreatedBy,
		}
		db.Clauses(clause.OnConflict{DoNothing: true}).Create(&newView)
	}

	// Migrate Form Fields -> Fields
	for _, field := range oldFormFields {
		config := make(map[string]interface{})

		var opts map[string]interface{}
		if len(field.Options) > 0 {
			json.Unmarshal(field.Options, &opts)
		}
		for k, v := range opts {
			config[k] = v
		}

		var val map[string]interface{}
		if len(field.Validation) > 0 {
			json.Unmarshal(field.Validation, &val)
		}
		if len(val) > 0 {
			config["validation"] = val
		}

		config["width"] = field.Width
		config["is_visible"] = field.IsVisible
		config["is_required"] = field.IsRequired
		config["placeholder"] = field.Placeholder
		config["field_type"] = field.FieldType

		configJSON, _ := json.Marshal(config)

		newField := Field{
			ID:       field.ID,
			TableID:  field.FormID,
			Name:     field.Name,
			Label:    field.Label,
			Type:     field.Type,
			Position: field.Position,
			Config:   datatypes.JSON(configJSON),
		}

		if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&newField).Error; err != nil {
			log.Printf("Error creating field %s: %v", field.Name, err)
		}
	}

	// Migrate Old Rows -> Rows
	for _, row := range oldRows {
		newRow := Row{
			ID:        row.ID,
			TableID:   row.TableID,
			Data:      row.Data,
			Position:  row.Position,
			CreatedBy: row.CreatedBy,
			UpdatedBy: row.UpdatedBy,
			CreatedAt: row.CreatedAt,
			UpdatedAt: row.UpdatedAt,
		}

		if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&newRow).Error; err != nil {
			log.Printf("Error creating row %s: %v", row.ID, err)
		}
	}

	// Migrate Form Submissions -> Rows
	for _, sub := range oldSubmissions {
		submittedBy := sub.SubmittedBy
		newRow := Row{
			ID:        sub.ID,
			TableID:   sub.FormID,
			Data:      sub.Data,
			CreatedBy: &submittedBy,
			CreatedAt: sub.CreatedAt,
			UpdatedAt: sub.UpdatedAt,
		}

		var dataMap map[string]interface{}
		if len(sub.Data) > 0 {
			json.Unmarshal(sub.Data, &dataMap)
		} else {
			dataMap = make(map[string]interface{})
		}

		dataMap["_submitted_by"] = sub.SubmittedBy
		dataMap["_ip_address"] = sub.IPAddress
		dataMap["_user_agent"] = sub.UserAgent

		newDataJSON, _ := json.Marshal(dataMap)
		newRow.Data = datatypes.JSON(newDataJSON)

		if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&newRow).Error; err != nil {
			log.Printf("Error creating row for submission %s: %v", sub.ID, err)
		}
	}

	log.Println("Migration complete!")
}
