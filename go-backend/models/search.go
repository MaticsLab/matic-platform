package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// SearchHistory model for tracking user searches (legacy - use SearchAnalytics)
type SearchHistory struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	WorkspaceID uuid.UUID `gorm:"type:uuid;not null;index" json:"workspace_id"`
	UserID      uuid.UUID `gorm:"type:uuid;index" json:"user_id"`
	Query       string    `gorm:"type:varchar(500);not null" json:"query"`
	ResultCount int       `json:"result_count"`
	CreatedAt   time.Time `json:"created_at"`
}

// TableName specifies the table name for SearchHistory
func (SearchHistory) TableName() string {
	return "search_histories"
}

// ============================================================
// AI SEARCH MODELS
// ============================================================

// EntityType - Registry of semantic entity types (person, event, etc.)
type EntityType struct {
	ID              string         `gorm:"primaryKey" json:"id"` // person, event, application
	Name            string         `gorm:"not null" json:"name"`
	Description     string         `json:"description"`
	Icon            string         `json:"icon"`
	Color           string         `json:"color"`
	ExpectedFields  datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"expected_fields"`
	DisplayTemplate string         `json:"display_template"`
	SearchWeight    float64        `gorm:"default:1.0" json:"search_weight"`
	CreatedAt       time.Time      `gorm:"autoCreateTime" json:"created_at"`
}

// TableName specifies the table name for EntityType
func (EntityType) TableName() string {
	return "entity_types"
}

// Common entity type constants
const (
	EntityTypePerson       = "person"
	EntityTypeApplication  = "application"
	EntityTypeEvent        = "event"
	EntityTypeDocument     = "document"
	EntityTypeOrganization = "organization"
	EntityTypeProduct      = "product"
	EntityTypeTask         = "task"
	EntityTypeGeneric      = "generic"
)

// SearchIndex - Denormalized search index for fast full-text search
type SearchIndex struct {
	ID               uuid.UUID      `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	EntityID         uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex:idx_entity" json:"entity_id"`
	EntityType       string         `gorm:"not null;uniqueIndex:idx_entity" json:"entity_type"` // row, table, form
	TableID          *uuid.UUID     `gorm:"type:uuid;index" json:"table_id,omitempty"`
	WorkspaceID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	Title            string         `gorm:"not null" json:"title"`
	Subtitle         string         `json:"subtitle"`
	Content          string         `json:"content"`
	HubType          string         `json:"hub_type"`
	DataEntityType   string         `json:"data_entity_type"`
	Tags             StringArray    `gorm:"type:text[]" json:"tags"`
	Status           string         `json:"status"`
	CreatedAt        time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	LastIndexedAt    time.Time      `json:"last_indexed_at"`
	ViewCount        int            `gorm:"default:0" json:"view_count"`
	SearchClickCount int            `gorm:"default:0" json:"search_click_count"`
	ImportanceScore  float64        `gorm:"default:1.0" json:"importance_score"`
	Metadata         datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	// Vector embedding fields (from migration 005/007)
	Embedding          []float32  `gorm:"type:vector(1536)" json:"embedding,omitempty"`
	EmbeddingModel     string     `json:"embedding_model,omitempty"`
	EmbeddingCreatedAt *time.Time `json:"embedding_created_at,omitempty"`
	// Field-aware embeddings (from migration 005)
	FieldEmbeddings datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"field_embeddings,omitempty"`
	// Structure: {"full_text": [...], "by_semantic_type": {"name": [...], "email": [...]}}
	IndexedFields datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"indexed_fields,omitempty"`
	// Structure: [{"field_id": "uuid", "field_name": "name", "contributed_text": "...", "weight": 2.0}]
}

// TableName specifies the table name for SearchIndex
func (SearchIndex) TableName() string {
	return "search_index"
}

// SearchAnalytics - Search query and click analytics for learning
type SearchAnalytics struct {
	ID                    uuid.UUID      `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	WorkspaceID           uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	UserID                *uuid.UUID     `gorm:"type:uuid" json:"user_id,omitempty"`
	Query                 string         `gorm:"not null" json:"query"`
	QueryTokens           StringArray    `gorm:"type:text[]" json:"query_tokens"`
	Filters               datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"filters"`
	ResultCount           int            `json:"result_count"`
	ClickedResultID       *uuid.UUID     `gorm:"type:uuid" json:"clicked_result_id,omitempty"`
	ClickedResultType     string         `json:"clicked_result_type"`
	ClickedResultPosition int            `json:"clicked_result_position"`
	SearchAt              time.Time      `gorm:"autoCreateTime" json:"search_at"`
	ClickAt               *time.Time     `json:"click_at,omitempty"`
	TimeToClickMs         int            `json:"time_to_click_ms"`
	Source                string         `gorm:"default:'omnisearch'" json:"source"`
	SessionID             string         `json:"session_id"`
}

// TableName specifies the table name for SearchAnalytics
func (SearchAnalytics) TableName() string {
	return "search_analytics"
}

// MetadataSchema - Documentation of expected metadata fields
type MetadataSchema struct {
	ID           string         `gorm:"primaryKey" json:"id"`
	AppliesTo    string         `gorm:"not null" json:"applies_to"` // table_rows, data_tables, etc.
	FieldName    string         `gorm:"not null" json:"field_name"`
	FieldType    string         `gorm:"not null" json:"field_type"` // string, uuid, array, object
	Description  string         `json:"description"`
	ExampleValue datatypes.JSON `json:"example_value"`
	IsRequired   bool           `gorm:"default:false" json:"is_required"`
	CreatedAt    time.Time      `gorm:"autoCreateTime" json:"created_at"`
}

// TableName specifies the table name for MetadataSchema
func (MetadataSchema) TableName() string {
	return "metadata_schema"
}

// ============================================================
// SMART SEARCH RESULT TYPES
// ============================================================

// SmartSearchResult - Result from the smart_search() database function
type SmartSearchResult struct {
	EntityID       uuid.UUID      `json:"entity_id"`
	EntityType     string         `json:"entity_type"`
	TableID        *uuid.UUID     `json:"table_id,omitempty"`
	Title          string         `json:"title"`
	Subtitle       string         `json:"subtitle"`
	ContentSnippet string         `json:"content_snippet"`
	HubType        string         `json:"hub_type"`
	DataEntityType string         `json:"data_entity_type"`
	Tags           StringArray    `json:"tags"`
	Status         string         `json:"status"`
	Score          float64        `json:"score"`
	Metadata       datatypes.JSON `json:"metadata"`
}

// SmartSearchParams - Parameters for smart search
type SmartSearchParams struct {
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Query       string    `json:"query"`
	Filters     struct {
		HubType    string `json:"hub_type,omitempty"`
		EntityType string `json:"entity_type,omitempty"`
		Status     string `json:"status,omitempty"`
	} `json:"filters"`
	Limit int `json:"limit"`
}

// ============================================================
// AI CONTEXT HELPERS
// ============================================================

// TableSchemaForAI - AI-friendly table schema representation
type TableSchemaForAI struct {
	TableID     uuid.UUID          `json:"table_id"`
	TableName   string             `json:"table_name"`
	Description string             `json:"description"`
	HubType     string             `json:"hub_type"`
	EntityType  string             `json:"entity_type"`
	RowCount    int                `json:"row_count"`
	Fields      []FieldSchemaForAI `json:"fields"`
}

// FieldSchemaForAI - AI-friendly field schema representation
type FieldSchemaForAI struct {
	ID             uuid.UUID      `json:"id"`
	Name           string         `json:"name"`
	Label          string         `json:"label"`
	Type           string         `json:"type"`
	SemanticType   string         `json:"semantic_type,omitempty"`
	IsDisplayField bool           `json:"is_display_field"`
	IsSearchable   bool           `json:"is_searchable"`
	SampleValues   datatypes.JSON `json:"sample_values,omitempty"`
}

// WorkspaceSummaryForAI - AI-friendly workspace summary
type WorkspaceSummaryForAI struct {
	WorkspaceID   uuid.UUID           `json:"workspace_id"`
	WorkspaceName string              `json:"workspace_name"`
	Description   string              `json:"description"`
	AIDescription string              `json:"ai_description,omitempty"`
	Tables        []TableSummaryForAI `json:"tables"`
	Statistics    WorkspaceStatistics `json:"statistics"`
}

// TableSummaryForAI - Brief table summary for AI context
type TableSummaryForAI struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	HubType     string    `json:"hub_type"`
	EntityType  string    `json:"entity_type"`
	RowCount    int       `json:"row_count"`
	Description string    `json:"description"`
}

// WorkspaceStatistics - Statistics for AI context
type WorkspaceStatistics struct {
	TableCount int `json:"table_count"`
	TotalRows  int `json:"total_rows"`
}

// ============================================================
// SEARCH API REQUEST/RESPONSE TYPES
// ============================================================

// SmartSearchRequest - Request body for smart search API
type SmartSearchRequest struct {
	Query   string `json:"query" binding:"required"`
	Filters struct {
		HubType    string `json:"hub_type,omitempty"`
		EntityType string `json:"entity_type,omitempty"`
		Status     string `json:"status,omitempty"`
		TableID    string `json:"table_id,omitempty"`
	} `json:"filters,omitempty"`
	Limit int  `json:"limit,omitempty"`
	Fuzzy bool `json:"fuzzy,omitempty"`
}

// SmartSearchResponse - Response from smart search API
type SmartSearchResponse struct {
	Results     []SmartSearchResult `json:"results"`
	Total       int                 `json:"total"`
	Query       string              `json:"query"`
	Took        int                 `json:"took"` // milliseconds
	Suggestions []string            `json:"suggestions,omitempty"`
	UsedFuzzy   bool                `json:"used_fuzzy"`
}

// RecordSearchClickRequest - Request to record a search result click
type RecordSearchClickRequest struct {
	AnalyticsID       uuid.UUID `json:"analytics_id" binding:"required"`
	ClickedResultID   uuid.UUID `json:"clicked_result_id" binding:"required"`
	ClickedResultType string    `json:"clicked_result_type" binding:"required"`
	Position          int       `json:"position" binding:"required"`
}

// ============================================================
// VECTOR EMBEDDING MODELS (Migration 007)
// ============================================================

// EmbeddingQueue - Queue for async embedding generation
type EmbeddingQueue struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	EntityID   uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_embedding_entity" json:"entity_id"`
	EntityType string    `gorm:"not null;uniqueIndex:idx_embedding_entity" json:"entity_type"` // row, table, form, workspace

	// Queue management
	Priority int    `gorm:"default:5" json:"priority"`       // 1-10, 1 = highest
	Status   string `gorm:"default:'pending'" json:"status"` // pending, processing, completed, failed, skipped

	// Content tracking
	ContentHash string `json:"content_hash,omitempty"`
	LastContent string `json:"last_content,omitempty"` // Last content that was embedded

	// Processing info
	Attempts    int        `gorm:"default:0" json:"attempts"`
	LastError   string     `gorm:"column:last_error" json:"last_error,omitempty"`
	ProcessedAt *time.Time `json:"processed_at,omitempty"`

	// Timestamps
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName specifies the table name for EmbeddingQueue
func (EmbeddingQueue) TableName() string {
	return "embedding_queue"
}

// SemanticFieldType - Registry of semantic field types for AI detection
type SemanticFieldType struct {
	ID              string         `gorm:"primaryKey" json:"id"`
	Name            string         `gorm:"not null" json:"name"`
	Description     string         `json:"description"`
	Patterns        StringArray    `gorm:"type:text[]" json:"patterns"`
	SampleValues    datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"sample_values"`
	EmbeddingWeight float64        `gorm:"default:1.0" json:"embedding_weight"`
	CreatedAt       time.Time      `gorm:"autoCreateTime" json:"created_at"`
}

// TableName specifies the table name for SemanticFieldType
func (SemanticFieldType) TableName() string {
	return "semantic_field_types"
}

// ============================================================
// HYBRID SEARCH TYPES (Migration 007)
// ============================================================

// HybridSearchRequest - Request for combined keyword + semantic search
type HybridSearchRequest struct {
	Query          string    `json:"query" binding:"required"`
	Embedding      []float32 `json:"embedding,omitempty"` // Pre-computed embedding from client
	KeywordWeight  float64   `json:"keyword_weight,omitempty"`
	SemanticWeight float64   `json:"semantic_weight,omitempty"`
	Filters        struct {
		HubType    string `json:"hub_type,omitempty"`
		EntityType string `json:"entity_type,omitempty"`
	} `json:"filters,omitempty"`
	Limit int `json:"limit,omitempty"`
}

// HybridSearchResult - Result from hybrid search
type HybridSearchResult struct {
	EntityID       uuid.UUID      `json:"entity_id"`
	EntityType     string         `json:"entity_type"`
	TableID        *uuid.UUID     `json:"table_id,omitempty"`
	Title          string         `json:"title"`
	Subtitle       string         `json:"subtitle"`
	ContentSnippet string         `json:"content_snippet"`
	HubType        string         `json:"hub_type"`
	DataEntityType string         `json:"data_entity_type"`
	Tags           StringArray    `json:"tags"`
	KeywordScore   float64        `json:"keyword_score"`
	SemanticScore  float64        `json:"semantic_score"`
	CombinedScore  float64        `json:"combined_score"`
	Metadata       datatypes.JSON `json:"metadata"`
}

// SimilarItemsRequest - Request to find similar items
type SimilarItemsRequest struct {
	EntityID   uuid.UUID `json:"entity_id" binding:"required"`
	EntityType string    `json:"entity_type" binding:"required"`
	Limit      int       `json:"limit,omitempty"`
}

// SimilarItem - Result from find_similar function
type SimilarItem struct {
	EntityID   uuid.UUID      `json:"entity_id"`
	EntityType string         `json:"entity_type"`
	TableID    *uuid.UUID     `json:"table_id,omitempty"`
	Title      string         `json:"title"`
	Subtitle   string         `json:"subtitle"`
	Similarity float64        `json:"similarity"`
	Metadata   datatypes.JSON `json:"metadata"`
}

// EmbeddingStats - Stats from embedding_stats view
type EmbeddingStats struct {
	WorkspaceID         uuid.UUID  `json:"workspace_id"`
	TotalItems          int        `json:"total_items"`
	ItemsWithEmbeddings int        `json:"items_with_embeddings"`
	CoveragePct         float64    `json:"coverage_pct"`
	PendingEmbeddings   int        `json:"pending_embeddings"`
	FailedEmbeddings    int        `json:"failed_embeddings"`
	LastEmbeddingAt     *time.Time `json:"last_embedding_at,omitempty"`
}

// UpdateEmbeddingsRequest - Batch update embeddings from external service
type UpdateEmbeddingsRequest struct {
	Updates []EmbeddingUpdate `json:"updates" binding:"required"`
}

// EmbeddingUpdate - Single embedding update
type EmbeddingUpdate struct {
	EntityID   uuid.UUID `json:"entity_id"`
	EntityType string    `json:"entity_type"`
	Embedding  []float32 `json:"embedding"`
	Model      string    `json:"model"`
}
