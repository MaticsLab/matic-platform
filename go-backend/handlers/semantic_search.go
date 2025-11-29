package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/Jsanchez767/matic-platform/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Global embedding service (initialized in main.go)
var EmbeddingService *services.EmbeddingService

// InitEmbeddingService initializes the embedding service with Cohere API key
func InitEmbeddingService(cohereAPIKey string) {
	EmbeddingService = services.NewEmbeddingService(cohereAPIKey)
}

// SemanticSearchRequest represents a semantic search request
type SemanticSearchRequest struct {
	Query   string `json:"query" binding:"required"`
	Filters struct {
		HubType    string `json:"hub_type,omitempty"`
		EntityType string `json:"entity_type,omitempty"`
		TableID    string `json:"table_id,omitempty"`
	} `json:"filters,omitempty"`
	Limit        int                `json:"limit,omitempty"`
	UseSemantics bool               `json:"use_semantics,omitempty"` // Enable semantic search (default true)
	UseFuzzy     bool               `json:"use_fuzzy,omitempty"`     // Enable fuzzy search (default true)
	FieldWeights map[string]float64 `json:"field_weights,omitempty"` // Override field search weights
	ExcludePII   bool               `json:"exclude_pii,omitempty"`   // Don't search PII fields
}

// SemanticSearchResponse represents the search response
type SemanticSearchResponse struct {
	Results      []SemanticResult `json:"results"`
	Total        int              `json:"total"`
	Query        string           `json:"query"`
	Took         int              `json:"took_ms"`
	UsedSemantic bool             `json:"used_semantic"`
	UsedFuzzy    bool             `json:"used_fuzzy"`
}

// SemanticResult represents a single semantic search result with vector scores
type SemanticResult struct {
	EntityID       uuid.UUID              `json:"entity_id"`
	EntityType     string                 `json:"entity_type"`
	TableID        *uuid.UUID             `json:"table_id,omitempty"`
	Title          string                 `json:"title"`
	Subtitle       string                 `json:"subtitle,omitempty"`
	ContentSnippet string                 `json:"content_snippet,omitempty"`
	HubType        string                 `json:"hub_type,omitempty"`
	DataEntityType string                 `json:"data_entity_type,omitempty"`
	Tags           []string               `json:"tags,omitempty"`
	Score          float64                `json:"score"`
	KeywordScore   float64                `json:"keyword_score,omitempty"`
	SemanticScore  float64                `json:"semantic_score,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// HybridSearch performs combined keyword + semantic search
// Supports field_weights for custom ranking and exclude_pii to skip PII fields
func HybridSearch(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	var req SemanticSearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Try query params for GET requests
		req.Query = c.Query("q")
		if req.Query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Query is required"})
			return
		}
		req.Filters.HubType = c.Query("hub_type")
		req.Filters.EntityType = c.Query("entity_type")
		req.Filters.TableID = c.Query("table_id")
		if limit, err := strconv.Atoi(c.Query("limit")); err == nil {
			req.Limit = limit
		}
		// Parse exclude_pii from query params
		req.ExcludePII = c.Query("exclude_pii") == "true"
	}

	if req.Limit == 0 {
		req.Limit = 50
	}

	startTime := time.Now()
	usedSemantic := false

	// Generate query embedding if semantic search is enabled and service is available
	var queryEmbedding []float32
	if EmbeddingService != nil {
		embedding, err := EmbeddingService.GenerateQueryEmbedding(req.Query)
		if err == nil {
			queryEmbedding = embedding
			usedSemantic = true
		}
	}

	// Build filters JSON including exclude_pii and field_weights
	filtersMap := make(map[string]interface{})
	if req.Filters.HubType != "" {
		filtersMap["hub_type"] = req.Filters.HubType
	}
	if req.Filters.EntityType != "" {
		filtersMap["entity_type"] = req.Filters.EntityType
	}
	if req.Filters.TableID != "" {
		filtersMap["table_id"] = req.Filters.TableID
	}
	if req.ExcludePII {
		filtersMap["exclude_pii"] = true
	}
	if len(req.FieldWeights) > 0 {
		filtersMap["field_weights"] = req.FieldWeights
	}
	filtersJSON, _ := json.Marshal(filtersMap)

	var results []SemanticResult

	if queryEmbedding != nil {
		// Use hybrid search with embeddings
		rows, err := database.DB.Raw(`
			SELECT * FROM hybrid_search($1, $2, $3::vector, $4::jsonb, $5, 0.4, 0.6)
		`, workspaceUUID, req.Query, pgVectorString(queryEmbedding), string(filtersJSON), req.Limit).Rows()

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var r SemanticResult
				var tags []string
				var metadata map[string]interface{}

				rows.Scan(
					&r.EntityID, &r.EntityType, &r.TableID, &r.Title, &r.Subtitle,
					&r.ContentSnippet, &r.HubType, &r.DataEntityType, &tags,
					&r.KeywordScore, &r.SemanticScore, &r.Score, &metadata,
				)
				r.Tags = tags
				r.Metadata = metadata
				results = append(results, r)
			}
		}
	} else {
		// Fallback to smart_search (keyword + fuzzy)
		rows, err := database.DB.Raw(`
			SELECT * FROM smart_search($1, $2, $3::jsonb, $4)
		`, workspaceUUID, req.Query, string(filtersJSON), req.Limit).Rows()

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var r SemanticResult
				var tags []string
				var metadata map[string]interface{}

				rows.Scan(
					&r.EntityID, &r.EntityType, &r.TableID, &r.Title, &r.Subtitle,
					&r.ContentSnippet, &r.HubType, &r.DataEntityType, &tags,
					&r.Score, &r.Score, &metadata,
				)
				r.Tags = tags
				r.Metadata = metadata
				results = append(results, r)
			}
		}
	}

	took := int(time.Since(startTime).Milliseconds())

	c.JSON(http.StatusOK, SemanticSearchResponse{
		Results:      results,
		Total:        len(results),
		Query:        req.Query,
		Took:         took,
		UsedSemantic: usedSemantic,
		UsedFuzzy:    !usedSemantic,
	})
}

// FindSimilar finds similar items to a given entity
func FindSimilar(c *gin.Context) {
	entityID := c.Param("entity_id")
	entityType := c.Query("entity_type")

	if entityID == "" || entityType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "entity_id and entity_type are required"})
		return
	}

	entityUUID, err := uuid.Parse(entityID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid entity_id"})
		return
	}

	limit := 10
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		limit = l
	}

	var results []struct {
		EntityID   uuid.UUID              `json:"entity_id"`
		EntityType string                 `json:"entity_type"`
		TableID    *uuid.UUID             `json:"table_id"`
		Title      string                 `json:"title"`
		Subtitle   string                 `json:"subtitle"`
		Similarity float64                `json:"similarity"`
		Metadata   map[string]interface{} `json:"metadata"`
	}

	database.DB.Raw(`
		SELECT * FROM find_similar($1, $2, $3)
	`, entityUUID, entityType, limit).Scan(&results)

	c.JSON(http.StatusOK, gin.H{
		"similar_items": results,
		"source": gin.H{
			"entity_id":   entityID,
			"entity_type": entityType,
		},
	})
}

// GenerateEmbeddings manually triggers embedding generation for pending items
func GenerateEmbeddings(c *gin.Context) {
	if EmbeddingService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Embedding service not configured"})
		return
	}

	batchSize := 50
	if b, err := strconv.Atoi(c.Query("batch_size")); err == nil && b > 0 {
		batchSize = b
	}

	count, err := EmbeddingService.ProcessPendingEmbeddings(batchSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"processed": count,
		"message":   "Embeddings generated successfully",
	})
}

// GetEmbeddingStats returns embedding coverage statistics
func GetEmbeddingStats(c *gin.Context) {
	workspaceID := c.Query("workspace_id")

	var stats []models.EmbeddingStats

	query := database.DB.Table("embedding_stats")
	if workspaceID != "" {
		query = query.Where("workspace_id = ?", workspaceID)
	}
	query.Scan(&stats)

	c.JSON(http.StatusOK, gin.H{"stats": stats})
}

// QueueForEmbedding adds an item to the embedding queue
func QueueForEmbedding(c *gin.Context) {
	var req struct {
		EntityID   string `json:"entity_id" binding:"required"`
		EntityType string `json:"entity_type" binding:"required"`
		Priority   int    `json:"priority"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	entityUUID, err := uuid.Parse(req.EntityID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid entity_id"})
		return
	}

	if EmbeddingService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Embedding service not configured"})
		return
	}

	if err := EmbeddingService.IndexNewItem(entityUUID, req.EntityType, req.Priority); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Queued for embedding"})
}

// RebuildSearchIndex triggers a full or workspace-specific search index rebuild
func RebuildSearchIndex(c *gin.Context) {
	workspaceID := c.Query("workspace_id")

	var result struct {
		Count int `json:"count"`
	}

	var err error
	if workspaceID != "" {
		workspaceUUID, parseErr := uuid.Parse(workspaceID)
		if parseErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
			return
		}
		err = database.DB.Raw(`SELECT rebuild_search_index($1) as count`, workspaceUUID).Scan(&result.Count).Error
	} else {
		err = database.DB.Raw(`SELECT rebuild_search_index(NULL) as count`).Scan(&result.Count).Error
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Search index rebuilt",
		"indexed_count": result.Count,
		"workspace_id":  workspaceID,
	})
}

// GetTableSchemaForAI returns table schema in AI-friendly format
func GetTableSchemaForAI(c *gin.Context) {
	tableID := c.Param("id")

	tableUUID, err := uuid.Parse(tableID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID"})
		return
	}

	var schema json.RawMessage
	if err := database.DB.Raw(`SELECT get_table_schema_for_ai($1)`, tableUUID).Scan(&schema).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Data(http.StatusOK, "application/json", schema)
}

// GetWorkspaceSummaryForAI returns workspace summary in AI-friendly format
func GetWorkspaceSummaryForAI(c *gin.Context) {
	workspaceID := c.Param("id")

	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	var summary json.RawMessage
	if err := database.DB.Raw(`SELECT get_workspace_summary_for_ai($1)`, workspaceUUID).Scan(&summary).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Data(http.StatusOK, "application/json", summary)
}

// pgVectorString converts float32 slice to PostgreSQL vector string
func pgVectorString(v []float32) string {
	if len(v) == 0 {
		return ""
	}

	result := "["
	for i, val := range v {
		if i > 0 {
			result += ","
		}
		result += strconv.FormatFloat(float64(val), 'f', 6, 32)
	}
	result += "]"
	return result
}
