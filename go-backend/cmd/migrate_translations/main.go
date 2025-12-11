package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"gorm.io/datatypes"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Form/Table model for migration
type DataTable struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid"`
	Name        string         `gorm:"not null"`
	Slug        string         `gorm:"not null"`
	Settings    datatypes.JSON `gorm:"type:jsonb"`
	UpdatedAt   time.Time
}

func (DataTable) TableName() string { return "data_tables" }

// Translation structures
type PortalTranslation struct {
	Name        string `json:"name,omitempty"`
	Description string `json:"description,omitempty"`
}

type SectionTranslation struct {
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
}

type FieldTranslation struct {
	Label       string   `json:"label,omitempty"`
	Placeholder string   `json:"placeholder,omitempty"`
	Description string   `json:"description,omitempty"`
	Options     []string `json:"options,omitempty"`
}

type TranslationResource struct {
	Portal       PortalTranslation             `json:"portal,omitempty"`
	Sections     map[string]SectionTranslation `json:"sections,omitempty"`
	Fields       map[string]FieldTranslation   `json:"fields,omitempty"`
	SignupFields map[string]FieldTranslation   `json:"signupFields,omitempty"`
	LoginFields  map[string]FieldTranslation   `json:"loginFields,omitempty"`
}

// Regex patterns for legacy key parsing
var (
	fieldLabelRe        = regexp.MustCompile(`^field_(.+)_label$`)
	fieldPlaceholderRe  = regexp.MustCompile(`^field_(.+)_placeholder$`)
	fieldDescRe         = regexp.MustCompile(`^field_(.+)_desc$`)
	fieldOptionRe       = regexp.MustCompile(`^field_(.+)_opt_(\d+)$`)
	sectionTitleRe      = regexp.MustCompile(`^section_(.+)_title$`)
	sectionDescRe       = regexp.MustCompile(`^section_(.+)_desc$`)
	signupLabelRe       = regexp.MustCompile(`^signup_(.+)_label$`)
	signupPlaceholderRe = regexp.MustCompile(`^signup_(.+)_placeholder$`)
	loginLabelRe        = regexp.MustCompile(`^login_(.+)_label$`)
	loginPlaceholderRe  = regexp.MustCompile(`^login_(.+)_placeholder$`)
)

// isLegacyFormat checks if the translation data is in legacy flat key-value format
func isLegacyFormat(data map[string]interface{}) bool {
	// New format has "portal", "sections", or "fields" keys with nested objects
	if _, hasPortal := data["portal"]; hasPortal {
		return false
	}
	if _, hasSections := data["sections"]; hasSections {
		return false
	}
	if _, hasFields := data["fields"]; hasFields {
		return false
	}

	// Check for legacy patterns
	for key, value := range data {
		// Legacy format has flat string values with patterns like field_xxx_label
		if _, ok := value.(string); ok {
			if strings.HasPrefix(key, "field_") ||
				strings.HasPrefix(key, "section_") ||
				strings.HasPrefix(key, "portal_") ||
				strings.HasPrefix(key, "signup_") ||
				strings.HasPrefix(key, "login_") {
				return true
			}
		}
	}

	return false
}

// migrateFromLegacy converts legacy format to new i18next format
func migrateFromLegacy(legacy map[string]interface{}) TranslationResource {
	resource := TranslationResource{
		Portal:       PortalTranslation{},
		Sections:     make(map[string]SectionTranslation),
		Fields:       make(map[string]FieldTranslation),
		SignupFields: make(map[string]FieldTranslation),
		LoginFields:  make(map[string]FieldTranslation),
	}

	// Collect options separately to merge later
	fieldOptions := make(map[string]map[int]string)

	for key, value := range legacy {
		strValue, ok := value.(string)
		if !ok {
			continue
		}

		// Portal keys
		if key == "portal_name" {
			resource.Portal.Name = strValue
			continue
		}
		if key == "portal_desc" {
			resource.Portal.Description = strValue
			continue
		}

		// Field keys
		if matches := fieldLabelRe.FindStringSubmatch(key); len(matches) == 2 {
			fieldID := matches[1]
			field := resource.Fields[fieldID]
			field.Label = strValue
			resource.Fields[fieldID] = field
			continue
		}
		if matches := fieldPlaceholderRe.FindStringSubmatch(key); len(matches) == 2 {
			fieldID := matches[1]
			field := resource.Fields[fieldID]
			field.Placeholder = strValue
			resource.Fields[fieldID] = field
			continue
		}
		if matches := fieldDescRe.FindStringSubmatch(key); len(matches) == 2 {
			fieldID := matches[1]
			field := resource.Fields[fieldID]
			field.Description = strValue
			resource.Fields[fieldID] = field
			continue
		}
		if matches := fieldOptionRe.FindStringSubmatch(key); len(matches) == 3 {
			fieldID := matches[1]
			idx, _ := strconv.Atoi(matches[2])
			if fieldOptions[fieldID] == nil {
				fieldOptions[fieldID] = make(map[int]string)
			}
			fieldOptions[fieldID][idx] = strValue
			continue
		}

		// Section keys
		if matches := sectionTitleRe.FindStringSubmatch(key); len(matches) == 2 {
			sectionID := matches[1]
			section := resource.Sections[sectionID]
			section.Title = strValue
			resource.Sections[sectionID] = section
			continue
		}
		if matches := sectionDescRe.FindStringSubmatch(key); len(matches) == 2 {
			sectionID := matches[1]
			section := resource.Sections[sectionID]
			section.Description = strValue
			resource.Sections[sectionID] = section
			continue
		}

		// Signup field keys
		if matches := signupLabelRe.FindStringSubmatch(key); len(matches) == 2 {
			fieldID := matches[1]
			field := resource.SignupFields[fieldID]
			field.Label = strValue
			resource.SignupFields[fieldID] = field
			continue
		}
		if matches := signupPlaceholderRe.FindStringSubmatch(key); len(matches) == 2 {
			fieldID := matches[1]
			field := resource.SignupFields[fieldID]
			field.Placeholder = strValue
			resource.SignupFields[fieldID] = field
			continue
		}

		// Login field keys
		if matches := loginLabelRe.FindStringSubmatch(key); len(matches) == 2 {
			fieldID := matches[1]
			field := resource.LoginFields[fieldID]
			field.Label = strValue
			resource.LoginFields[fieldID] = field
			continue
		}
		if matches := loginPlaceholderRe.FindStringSubmatch(key); len(matches) == 2 {
			fieldID := matches[1]
			field := resource.LoginFields[fieldID]
			field.Placeholder = strValue
			resource.LoginFields[fieldID] = field
			continue
		}
	}

	// Merge options into fields
	for fieldID, opts := range fieldOptions {
		field := resource.Fields[fieldID]
		// Find max index
		maxIdx := -1
		for idx := range opts {
			if idx > maxIdx {
				maxIdx = idx
			}
		}
		if maxIdx >= 0 {
			field.Options = make([]string, maxIdx+1)
			for idx, opt := range opts {
				field.Options[idx] = opt
			}
		}
		resource.Fields[fieldID] = field
	}

	return resource
}

// MigrationStats tracks migration progress
type MigrationStats struct {
	TotalForms            int
	FormsWithTranslations int
	LegacyFormatCount     int
	MigratedCount         int
	AlreadyNewFormat      int
	Errors                []string
}

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found")
	}

	// Check for dry-run flag
	dryRun := len(os.Args) > 1 && os.Args[1] == "--dry-run"

	if dryRun {
		log.Println("🔍 DRY RUN MODE - No changes will be made")
	}

	// Connect to database
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL environment variable not set")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("===========================================")
	log.Println("   Translation Format Migration Script")
	log.Println("   Legacy flat keys → i18next namespace")
	log.Println("===========================================")
	log.Println()

	stats := MigrationStats{}

	// Fetch all forms (tables with icon='form')
	var tables []DataTable
	if err := db.Where("icon = ?", "form").Find(&tables).Error; err != nil {
		log.Fatalf("Failed to fetch forms: %v", err)
	}

	stats.TotalForms = len(tables)
	log.Printf("📋 Found %d forms/portals to check\n", stats.TotalForms)

	for _, table := range tables {
		var settings map[string]interface{}
		if err := json.Unmarshal(table.Settings, &settings); err != nil {
			stats.Errors = append(stats.Errors, fmt.Sprintf("Form %s: Failed to parse settings JSON: %v", table.ID, err))
			continue
		}

		// Check if form has translations
		translations, hasTranslations := settings["translations"]
		if !hasTranslations {
			continue
		}

		translationsMap, ok := translations.(map[string]interface{})
		if !ok || len(translationsMap) == 0 {
			continue
		}

		stats.FormsWithTranslations++

		// Process each language
		needsMigration := false
		migratedTranslations := make(map[string]interface{})

		for lang, langData := range translationsMap {
			langMap, ok := langData.(map[string]interface{})
			if !ok {
				migratedTranslations[lang] = langData
				continue
			}

			if isLegacyFormat(langMap) {
				needsMigration = true
				stats.LegacyFormatCount++

				// Migrate this language's translations
				migrated := migrateFromLegacy(langMap)
				migratedTranslations[lang] = migrated

				log.Printf("  ✨ Form '%s' [%s]: Migrating %s from legacy format\n",
					table.Name, table.ID, lang)
			} else {
				migratedTranslations[lang] = langData
			}
		}

		if needsMigration && !dryRun {
			// Update settings with migrated translations
			settings["translations"] = migratedTranslations

			newSettings, err := json.Marshal(settings)
			if err != nil {
				stats.Errors = append(stats.Errors, fmt.Sprintf("Form %s: Failed to marshal settings: %v", table.ID, err))
				continue
			}

			if err := db.Model(&table).Update("settings", datatypes.JSON(newSettings)).Error; err != nil {
				stats.Errors = append(stats.Errors, fmt.Sprintf("Form %s: Failed to update: %v", table.ID, err))
				continue
			}

			stats.MigratedCount++
			log.Printf("  ✅ Form '%s' migrated successfully\n", table.Name)
		} else if !needsMigration {
			stats.AlreadyNewFormat++
			log.Printf("  ℹ️  Form '%s' already in new format\n", table.Name)
		}
	}

	// Print summary
	log.Println()
	log.Println("===========================================")
	log.Println("              Migration Summary")
	log.Println("===========================================")
	log.Printf("Total forms checked:        %d\n", stats.TotalForms)
	log.Printf("Forms with translations:    %d\n", stats.FormsWithTranslations)
	log.Printf("Legacy format detected:     %d\n", stats.LegacyFormatCount)
	if dryRun {
		log.Printf("Would migrate:              %d forms\n", stats.LegacyFormatCount)
	} else {
		log.Printf("Successfully migrated:      %d\n", stats.MigratedCount)
	}
	log.Printf("Already in new format:      %d\n", stats.AlreadyNewFormat)

	if len(stats.Errors) > 0 {
		log.Println()
		log.Println("Errors encountered:")
		for _, e := range stats.Errors {
			log.Printf("  ❌ %s\n", e)
		}
	}

	if dryRun && stats.LegacyFormatCount > 0 {
		log.Println()
		log.Println("💡 Run without --dry-run flag to apply migrations")
	}

	log.Println()
	log.Println("Migration complete!")
}
