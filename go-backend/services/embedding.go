package services

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/google/uuid"
	"gorm.io/gorm/clause"
)

// EmbeddingService handles embedding generation and indexing
type EmbeddingService struct {
	Cohere     *CohereClient
	Normalizer *FieldNormalizer
}

// NewEmbeddingService creates a new embedding service
func NewEmbeddingService(cohereAPIKey string) *EmbeddingService {
	return &EmbeddingService{
		Cohere:     NewCohereClient(cohereAPIKey),
		Normalizer: NewFieldNormalizer(),
	}
}

// ProcessPendingEmbeddings processes items in the embedding queue
// Enhanced to populate field_embeddings and indexed_fields
func (s *EmbeddingService) ProcessPendingEmbeddings(batchSize int) (int, error) {
	// Get pending items from queue
	var queue []models.EmbeddingQueue
	result := database.DB.
		Where("status = ?", "pending").
		Order("priority DESC, created_at ASC").
		Limit(batchSize).
		Find(&queue)

	if result.Error != nil {
		return 0, result.Error
	}

	if len(queue) == 0 {
		return 0, nil
	}

	// Mark as processing
	var ids []uuid.UUID
	for _, q := range queue {
		ids = append(ids, q.ID)
	}
	database.DB.Model(&models.EmbeddingQueue{}).
		Where("id IN ?", ids).
		Update("status", "processing")

	// Process each queue item
	processedCount := 0
	now := time.Now()

	for _, q := range queue {
		if err := s.processQueueItem(q, now); err != nil {
			log.Printf("⚠️ Failed to process embedding for %s/%s: %v", q.EntityType, q.EntityID, err)
			database.DB.Model(&models.EmbeddingQueue{}).
				Where("id = ?", q.ID).
				Updates(map[string]interface{}{
					"status":     "failed",
					"last_error": err.Error(),
					"attempts":   q.Attempts + 1,
				})
		} else {
			processedCount++
			database.DB.Model(&models.EmbeddingQueue{}).
				Where("id = ?", q.ID).
				Updates(map[string]interface{}{
					"status":       "completed",
					"processed_at": now,
				})
		}
	}

	log.Printf("✅ Generated embeddings for %d/%d items", processedCount, len(queue))
	return processedCount, nil
}

// processQueueItem processes a single item from the embedding queue
func (s *EmbeddingService) processQueueItem(q models.EmbeddingQueue, now time.Time) error {
	// Get the search index entry
	var searchItem models.SearchIndex
	if err := database.DB.Where("entity_id = ? AND entity_type = ?", q.EntityID, q.EntityType).First(&searchItem).Error; err != nil {
		return fmt.Errorf("search index entry not found: %w", err)
	}

	// For rows, get field-aware embedding input
	var embeddingInput *FieldEmbeddingInput
	var fullText string

	if q.EntityType == "row" && searchItem.TableID != nil {
		// Get the row data
		var row models.Row
		if err := database.DB.Where("id = ?", q.EntityID).First(&row).Error; err == nil {
			var data map[string]interface{}
			json.Unmarshal(row.Data, &data)

			// Generate field-aware embedding input
			embeddingInput = s.Normalizer.GenerateFieldAwareEmbeddingInput(*searchItem.TableID, data)
			fullText = embeddingInput.FullText
		}
	}

	// Fallback to basic text if no field-aware input
	if fullText == "" {
		fullText = searchItem.Title
		if searchItem.Subtitle != "" {
			fullText += " - " + searchItem.Subtitle
		}
		if searchItem.Content != "" {
			fullText += " " + searchItem.Content
		}
	}

	// Generate main embedding
	embeddings, err := s.Cohere.EmbedDocuments([]string{fullText})
	if err != nil {
		return fmt.Errorf("failed to generate embedding: %w", err)
	}
	if len(embeddings) == 0 {
		return fmt.Errorf("no embedding returned")
	}

	// Build field_embeddings JSON
	fieldEmbeddings := map[string]interface{}{
		"full_text": embeddings[0],
	}

	// Generate embeddings for each semantic type if we have field-aware input
	if embeddingInput != nil && len(embeddingInput.BySemanticType) > 0 {
		bySemanticType := make(map[string][]float32)

		// Collect texts for batch embedding
		semanticTypes := make([]string, 0, len(embeddingInput.BySemanticType))
		semanticTexts := make([]string, 0, len(embeddingInput.BySemanticType))
		for st, text := range embeddingInput.BySemanticType {
			if text != "" {
				semanticTypes = append(semanticTypes, st)
				semanticTexts = append(semanticTexts, text)
			}
		}

		if len(semanticTexts) > 0 {
			semanticEmbeddings, err := s.Cohere.EmbedDocuments(semanticTexts)
			if err == nil {
				for i, st := range semanticTypes {
					if i < len(semanticEmbeddings) {
						bySemanticType[st] = semanticEmbeddings[i]
					}
				}
			}
		}

		if len(bySemanticType) > 0 {
			fieldEmbeddings["by_semantic_type"] = bySemanticType
		}
	}

	// Convert to JSON
	fieldEmbeddingsJSON, _ := json.Marshal(fieldEmbeddings)
	var indexedFieldsJSON []byte
	if embeddingInput != nil {
		indexedFieldsJSON, _ = json.Marshal(embeddingInput.IndexedFields)
	} else {
		indexedFieldsJSON = []byte("[]")
	}

	// Update search_index with all embedding data
	return database.DB.Exec(`
		UPDATE search_index 
		SET embedding = $1::vector, 
		    embedding_model = 'cohere/embed-english-v3.0',
		    embedding_created_at = $2,
		    field_embeddings = $3::jsonb,
		    indexed_fields = $4::jsonb
		WHERE entity_id = $5 AND entity_type = $6
	`, pgVector(embeddings[0]), now, string(fieldEmbeddingsJSON), string(indexedFieldsJSON),
		q.EntityID, q.EntityType).Error
}

// GenerateQueryEmbedding generates an embedding for a search query
func (s *EmbeddingService) GenerateQueryEmbedding(query string) ([]float32, error) {
	return s.Cohere.EmbedQuery(query)
}

// IndexNewItem adds a new item to the embedding queue
func (s *EmbeddingService) IndexNewItem(entityID uuid.UUID, entityType string, priority int) error {
	queue := models.EmbeddingQueue{
		EntityID:   entityID,
		EntityType: entityType,
		Priority:   priority,
		Status:     "pending",
	}

	return database.DB.
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "entity_id"}, {Name: "entity_type"}},
			DoUpdates: clause.AssignmentColumns([]string{"priority", "status", "created_at"}),
		}).
		Create(&queue).Error
}

// pgVector converts a float32 slice to PostgreSQL vector format
func pgVector(v []float32) string {
	if len(v) == 0 {
		return ""
	}

	result := "["
	for i, val := range v {
		if i > 0 {
			result += ","
		}
		result += fmt.Sprintf("%f", val)
	}
	result += "]"
	return result
}
