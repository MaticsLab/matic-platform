package database

import (
	"fmt"
	"log"

	"github.com/Jsanchez767/matic-platform/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(databaseURL string) error {
	var err error

	// Configure GORM
	config := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	}

	// Connect to PostgreSQL
	DB, err = gorm.Open(postgres.Open(databaseURL), config)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}

	sqlDB.SetMaxIdleConns(3)
	sqlDB.SetMaxOpenConns(10)

	log.Println("✅ Database connected successfully")
	return nil
}

func AutoMigrate() error {
	log.Println("🔄 Running database migrations...")

	err := DB.AutoMigrate(
		// Core models
		&models.Organization{},
		&models.OrganizationMember{},
		&models.Workspace{},
		&models.WorkspaceMember{},
		&models.WorkspaceInvitation{},
		&models.Table{},
		&models.Field{},
		&models.Row{},
		&models.View{},
		&models.TableLink{},
		&models.TableRowLink{},

		// Field type registry (001_field_type_registry.sql)
		&models.FieldTypeRegistry{},

		// Row versioning (002_row_versions.sql)
		&models.RowVersion{},
		&models.BatchOperation{},

		// Field changes (003_field_changes.sql)
		&models.FieldChange{},

		// AI suggestions (004_ai_field_suggestions.sql)
		&models.AIFieldSuggestion{},

		// Search index enhancements (005_search_index_enhancements.sql)
		&models.SearchHistory{},
		&models.SearchIndex{},
		&models.EntityType{},
		&models.SearchAnalytics{},
		&models.EmbeddingQueue{},
		&models.SemanticFieldType{},

		// Change requests (006_change_requests.sql)
		&models.ChangeRequest{},
		&models.ChangeApproval{},

		// Workflows
		&models.ReviewWorkflow{},
		&models.ApplicationStage{},
		&models.ReviewerType{},
		&models.Rubric{},
		&models.StageReviewerConfig{},

		// Application Groups and Actions (009_application_groups.sql)
		&models.ApplicationGroup{},
		&models.WorkflowAction{},
		&models.StageAction{},

		// Email / Gmail Integration
		&models.GmailConnection{},
		&models.EmailCampaign{},
		&models.SentEmail{},
		&models.EmailTemplate{},
		&models.EmailSignature{},
	)

	if err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	// Seed field type registry if empty
	if err := seedFieldTypeRegistry(); err != nil {
		log.Printf("⚠️ Failed to seed field type registry: %v", err)
	}

	log.Println("✅ Database migrations completed")
	return nil
}

// seedFieldTypeRegistry populates the field_type_registry with default field types
func seedFieldTypeRegistry() error {
	var count int64
	DB.Model(&models.FieldTypeRegistry{}).Count(&count)

	// Only do full seed if empty, otherwise just add missing types
	isInitialSeed := count == 0
	if isInitialSeed {
		log.Println("🌱 Seeding field type registry...")
	}

	fieldTypes := []models.FieldTypeRegistry{
		// Primitive text types
		{ID: "text", Category: "primitive", Label: "Short Text", IsSearchable: true, IsSortable: true, IsFilterable: true, IsEditable: true,
			StorageSchema: []byte(`{"type": "string", "maxLength": 500}`),
			AISchema:      []byte(`{"embedding_strategy": "value_only", "privacy_level": "public"}`)},
		{ID: "textarea", Category: "primitive", Label: "Long Text", IsSearchable: true, IsSortable: false, IsFilterable: false, IsEditable: true,
			StorageSchema: []byte(`{"type": "string"}`),
			AISchema:      []byte(`{"embedding_strategy": "with_label", "summarization_weight": 1.5, "privacy_level": "public"}`)},
		{ID: "email", Category: "primitive", Label: "Email", IsSearchable: true, IsSortable: true, IsFilterable: true, IsEditable: true, SupportsPII: true,
			StorageSchema: []byte(`{"type": "string", "format": "email"}`),
			AISchema:      []byte(`{"embedding_strategy": "skip", "privacy_level": "pii", "semantic_hint": "Contact email address"}`)},
		{ID: "phone", Category: "primitive", Label: "Phone", IsSearchable: true, IsSortable: true, IsFilterable: true, IsEditable: true, SupportsPII: true,
			StorageSchema: []byte(`{"type": "string"}`),
			AISchema:      []byte(`{"embedding_strategy": "skip", "privacy_level": "pii"}`)},
		{ID: "url", Category: "primitive", Label: "URL", IsSearchable: true, IsSortable: true, IsFilterable: false, IsEditable: true,
			StorageSchema: []byte(`{"type": "string", "format": "uri"}`),
			AISchema:      []byte(`{"embedding_strategy": "skip", "privacy_level": "public"}`)},
		{ID: "address", Category: "primitive", Label: "Address", IsSearchable: true, IsSortable: false, IsFilterable: true, IsEditable: true, SupportsPII: true,
			StorageSchema: []byte(`{"type": "object", "properties": {"formatted": {"type": "string"}, "street": {"type": "string"}, "city": {"type": "string"}, "state": {"type": "string"}, "postal_code": {"type": "string"}, "country": {"type": "string"}, "lat": {"type": "number"}, "lng": {"type": "number"}}}`),
			AISchema:      []byte(`{"embedding_strategy": "formatted_only", "privacy_level": "pii", "semantic_hint": "Physical address location"}`)},

		// Numeric types
		{ID: "number", Category: "primitive", Label: "Number", IsSearchable: false, IsSortable: true, IsFilterable: true, IsEditable: true,
			StorageSchema: []byte(`{"type": "number"}`),
			AISchema:      []byte(`{"embedding_strategy": "with_label", "privacy_level": "public"}`)},

		// Date & Time types
		{ID: "date", Category: "primitive", Label: "Date", IsSearchable: false, IsSortable: true, IsFilterable: true, IsEditable: true,
			StorageSchema: []byte(`{"type": "string", "format": "date"}`),
			AISchema:      []byte(`{"embedding_strategy": "with_label", "privacy_level": "public"}`)},
		{ID: "datetime", Category: "primitive", Label: "Date & Time", IsSearchable: false, IsSortable: true, IsFilterable: true, IsEditable: true,
			StorageSchema: []byte(`{"type": "string", "format": "date-time"}`),
			AISchema:      []byte(`{"embedding_strategy": "with_label", "privacy_level": "public"}`)},
		{ID: "time", Category: "primitive", Label: "Time", IsSearchable: false, IsSortable: true, IsFilterable: true, IsEditable: true,
			StorageSchema: []byte(`{"type": "string", "format": "time"}`),
			AISchema:      []byte(`{"embedding_strategy": "with_label", "privacy_level": "public"}`)},

		// Selection types
		{ID: "select", Category: "primitive", Label: "Dropdown", IsSearchable: true, IsSortable: true, IsFilterable: true, IsEditable: true,
			StorageSchema: []byte(`{"type": "string"}`),
			AISchema:      []byte(`{"embedding_strategy": "value_only", "privacy_level": "public"}`)},
		{ID: "multiselect", Category: "primitive", Label: "Multi-Select", IsSearchable: true, IsSortable: false, IsFilterable: true, IsEditable: true,
			StorageSchema: []byte(`{"type": "array", "items": {"type": "string"}}`),
			AISchema:      []byte(`{"embedding_strategy": "value_only", "privacy_level": "public"}`)},
		{ID: "radio", Category: "primitive", Label: "Single Choice", IsSearchable: true, IsSortable: true, IsFilterable: true, IsEditable: true,
			StorageSchema: []byte(`{"type": "string"}`),
			AISchema:      []byte(`{"embedding_strategy": "value_only", "privacy_level": "public"}`)},
		{ID: "checkbox", Category: "primitive", Label: "Checkbox", IsSearchable: false, IsSortable: true, IsFilterable: true, IsEditable: true,
			StorageSchema: []byte(`{"type": "boolean"}`),
			AISchema:      []byte(`{"embedding_strategy": "skip", "privacy_level": "public"}`)},
		{ID: "rank", Category: "primitive", Label: "Rank", IsSearchable: false, IsSortable: true, IsFilterable: true, IsEditable: true,
			StorageSchema: []byte(`{"type": "array", "items": {"type": "string"}, "description": "Ordered list of ranked options"}`),
			AISchema:      []byte(`{"embedding_strategy": "value_only", "privacy_level": "public"}`)},

		// Container types
		{ID: "group", Category: "container", Label: "Field Group", IsContainer: true, IsSearchable: false, IsSortable: false, IsFilterable: false, IsEditable: true,
			StorageSchema: []byte(`{"type": "object", "additionalProperties": true}`),
			AISchema:      []byte(`{"embedding_strategy": "children_only", "privacy_level": "inherit"}`)},
		{ID: "repeater", Category: "container", Label: "Repeater", IsContainer: true, IsSearchable: false, IsSortable: false, IsFilterable: false, IsEditable: true,
			StorageSchema: []byte(`{"type": "array", "items": {"type": "object", "additionalProperties": true}}`),
			AISchema:      []byte(`{"embedding_strategy": "summarize_count", "summarization_template": "{count} items", "privacy_level": "inherit"}`)},

		// Layout types (no data storage, display-only)
		{ID: "divider", Category: "layout", Label: "Divider", IsSearchable: false, IsSortable: false, IsFilterable: false, IsEditable: false,
			StorageSchema: []byte(`{"type": "null"}`),
			AISchema:      []byte(`{"embedding_strategy": "skip"}`)},
		{ID: "heading", Category: "layout", Label: "Heading", IsSearchable: false, IsSortable: false, IsFilterable: false, IsEditable: false,
			StorageSchema: []byte(`{"type": "null"}`),
			AISchema:      []byte(`{"embedding_strategy": "skip"}`)},
		{ID: "paragraph", Category: "layout", Label: "Paragraph", IsSearchable: false, IsSortable: false, IsFilterable: false, IsEditable: false,
			StorageSchema: []byte(`{"type": "null"}`),
			AISchema:      []byte(`{"embedding_strategy": "skip"}`)},
		{ID: "callout", Category: "layout", Label: "Callout Box", IsSearchable: false, IsSortable: false, IsFilterable: false, IsEditable: false,
			StorageSchema: []byte(`{"type": "null"}`),
			AISchema:      []byte(`{"embedding_strategy": "skip"}`)},
		{ID: "section", Category: "layout", Label: "Section", IsContainer: true, IsSearchable: false, IsSortable: false, IsFilterable: false, IsEditable: false,
			StorageSchema: []byte(`{"type": "null"}`),
			AISchema:      []byte(`{"embedding_strategy": "skip"}`)},

		// Media & File types
		{ID: "file", Category: "special", Label: "File Upload", IsSearchable: false, IsSortable: false, IsFilterable: false, IsEditable: true, SupportsPII: true,
			StorageSchema: []byte(`{"type": "object", "properties": {"url": {"type": "string"}, "name": {"type": "string"}, "size": {"type": "number"}, "type": {"type": "string"}}, "description": "Uploaded file with metadata"}`),
			AISchema:      []byte(`{"embedding_strategy": "filename_only", "privacy_level": "sensitive"}`)},
		{ID: "image", Category: "special", Label: "Image Upload", IsSearchable: false, IsSortable: false, IsFilterable: false, IsEditable: true, SupportsPII: true,
			StorageSchema: []byte(`{"type": "object", "properties": {"url": {"type": "string"}, "name": {"type": "string"}, "size": {"type": "number"}, "type": {"type": "string"}, "width": {"type": "number"}, "height": {"type": "number"}}, "description": "Uploaded image with dimensions"}`),
			AISchema:      []byte(`{"embedding_strategy": "skip", "privacy_level": "sensitive"}`)},
		{ID: "signature", Category: "special", Label: "Signature", IsSearchable: false, IsSortable: false, IsFilterable: false, IsEditable: false, SupportsPII: true,
			StorageSchema: []byte(`{"type": "string", "contentEncoding": "base64", "description": "Digital signature as base64 image"}`),
			AISchema:      []byte(`{"embedding_strategy": "skip", "privacy_level": "pii"}`)},
		{ID: "rating", Category: "special", Label: "Rating", IsSearchable: false, IsSortable: true, IsFilterable: true, IsEditable: true,
			StorageSchema: []byte(`{"type": "number", "minimum": 0, "maximum": 5, "description": "Star rating value"}`),
			AISchema:      []byte(`{"embedding_strategy": "with_label", "privacy_level": "public"}`)},
		{ID: "item_list", Category: "container", Label: "Item List", IsContainer: true, IsSearchable: false, IsSortable: false, IsFilterable: false, IsEditable: true,
			StorageSchema: []byte(`{"type": "array", "items": {"type": "object", "additionalProperties": true}, "description": "List of items with dynamic properties"}`),
			AISchema:      []byte(`{"embedding_strategy": "summarize_count", "summarization_template": "{count} items", "privacy_level": "inherit"}`)},
	}

	addedCount := 0
	for _, ft := range fieldTypes {
		// Use FirstOrCreate to only insert if not exists
		result := DB.Where("id = ?", ft.ID).FirstOrCreate(&ft)
		if result.Error != nil {
			log.Printf("⚠️ Failed to create field type %s: %v", ft.ID, result.Error)
		} else if result.RowsAffected > 0 {
			addedCount++
		}
	}

	if isInitialSeed {
		log.Println("✅ Field type registry seeded")
	} else if addedCount > 0 {
		log.Printf("✅ Added %d new field types to registry", addedCount)
	}

	// Seed semantic field types
	if err := seedSemanticFieldTypes(); err != nil {
		log.Printf("⚠️ Failed to seed semantic field types: %v", err)
	}

	return nil
}

// seedSemanticFieldTypes populates common semantic field types for AI detection
func seedSemanticFieldTypes() error {
	var count int64
	DB.Model(&models.SemanticFieldType{}).Count(&count)
	if count > 0 {
		return nil
	}

	log.Println("🌱 Seeding semantic field types...")

	semanticTypes := []models.SemanticFieldType{
		{ID: "name", Name: "Person Name", Description: "Full name of a person", EmbeddingWeight: 2.0,
			Patterns: []string{"name", "full_name", "fullname", "applicant_name"}},
		{ID: "email", Name: "Email Address", Description: "Email contact", EmbeddingWeight: 0.5,
			Patterns: []string{"email", "email_address", "contact_email"}},
		{ID: "phone", Name: "Phone Number", Description: "Phone contact", EmbeddingWeight: 0.5,
			Patterns: []string{"phone", "telephone", "mobile", "cell"}},
		{ID: "address", Name: "Physical Address", Description: "Street address or location", EmbeddingWeight: 1.0,
			Patterns: []string{"address", "street", "location", "city", "state", "zip"}},
		{ID: "date", Name: "Date", Description: "Date or datetime value", EmbeddingWeight: 1.0,
			Patterns: []string{"date", "dob", "birth_date", "created", "updated"}},
		{ID: "status", Name: "Status", Description: "Status or state indicator", EmbeddingWeight: 1.5,
			Patterns: []string{"status", "state", "stage", "phase"}},
		{ID: "description", Name: "Description", Description: "Long-form text description", EmbeddingWeight: 2.0,
			Patterns: []string{"description", "bio", "about", "summary", "notes"}},
		{ID: "title", Name: "Title", Description: "Title or heading", EmbeddingWeight: 2.5,
			Patterns: []string{"title", "heading", "subject", "name"}},
		{ID: "organization", Name: "Organization", Description: "Company or organization name", EmbeddingWeight: 1.5,
			Patterns: []string{"company", "organization", "org", "employer", "school"}},
		{ID: "role", Name: "Role/Position", Description: "Job title or role", EmbeddingWeight: 1.5,
			Patterns: []string{"role", "position", "job_title", "title"}},
	}

	for _, st := range semanticTypes {
		if err := DB.Create(&st).Error; err != nil {
			log.Printf("⚠️ Failed to create semantic type %s: %v", st.ID, err)
		}
	}

	log.Println("✅ Semantic field types seeded")

	// Seed entity types
	if err := seedEntityTypes(); err != nil {
		log.Printf("⚠️ Failed to seed entity types: %v", err)
	}

	return nil
}

// seedEntityTypes populates common entity types for table categorization
func seedEntityTypes() error {
	var count int64
	DB.Model(&models.EntityType{}).Count(&count)
	if count > 0 {
		return nil
	}

	log.Println("🌱 Seeding entity types...")

	entityTypes := []models.EntityType{
		{ID: "person", Name: "Person", Description: "Individual person records", Icon: "user", Color: "#3B82F6", SearchWeight: 2.0,
			ExpectedFields: []byte(`["name", "email", "phone"]`)},
		{ID: "application", Name: "Application", Description: "Form submissions and applications", Icon: "file-text", Color: "#10B981", SearchWeight: 1.5,
			ExpectedFields: []byte(`["applicant_name", "status", "submitted_at"]`)},
		{ID: "event", Name: "Event", Description: "Events, activities, or occurrences", Icon: "calendar", Color: "#8B5CF6", SearchWeight: 1.5,
			ExpectedFields: []byte(`["title", "date", "location"]`)},
		{ID: "organization", Name: "Organization", Description: "Companies, schools, or groups", Icon: "building", Color: "#F59E0B", SearchWeight: 1.5,
			ExpectedFields: []byte(`["name", "type", "address"]`)},
		{ID: "document", Name: "Document", Description: "Files and documents", Icon: "file", Color: "#6366F1", SearchWeight: 1.0,
			ExpectedFields: []byte(`["title", "type", "url"]`)},
		{ID: "product", Name: "Product", Description: "Products or inventory items", Icon: "package", Color: "#EC4899", SearchWeight: 1.0,
			ExpectedFields: []byte(`["name", "sku", "price"]`)},
		{ID: "task", Name: "Task", Description: "Tasks or action items", Icon: "check-square", Color: "#14B8A6", SearchWeight: 1.0,
			ExpectedFields: []byte(`["title", "status", "due_date", "assignee"]`)},
		{ID: "generic", Name: "Generic", Description: "General purpose records", Icon: "database", Color: "#6B7280", SearchWeight: 1.0,
			ExpectedFields: []byte(`[]`)},
	}

	for _, et := range entityTypes {
		if err := DB.Create(&et).Error; err != nil {
			log.Printf("⚠️ Failed to create entity type %s: %v", et.ID, err)
		}
	}

	log.Println("✅ Entity types seeded")
	return nil
}

func GetDB() *gorm.DB {
	return DB
}
