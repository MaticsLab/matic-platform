package services

import (
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
	Cohere *CohereClient
}

// NewEmbeddingService creates a new embedding service
func NewEmbeddingService(cohereAPIKey string) *EmbeddingService {
	return &EmbeddingService{
		Cohere: NewCohereClient(cohereAPIKey),
	}
}

// ProcessPendingEmbeddings processes items in the embedding queue
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

	// Get the search index entries for these items
	var searchItems []models.SearchIndex
	for _, q := range queue {
		var item models.SearchIndex
		if err := database.DB.Where("entity_id = ? AND entity_type = ?", q.EntityID, q.EntityType).First(&item).Error; err == nil {
			searchItems = append(searchItems, item)
		}
	}

	if len(searchItems) == 0 {
		return 0, nil
	}

	// Build texts for embedding
	var texts []string
	for _, item := range searchItems {
		// Combine title, subtitle, and content for richer embedding
		text := item.Title
		if item.Subtitle != "" {
			text += " - " + item.Subtitle
		}
		if item.Content != "" {
			text += " " + item.Content
		}
		texts = append(texts, text)
	}

	// Generate embeddings
	embeddings, err := s.Cohere.EmbedDocuments(texts)
	if err != nil {
		// Mark as failed
		database.DB.Model(&models.EmbeddingQueue{}).
			Where("id IN ?", ids).
			Updates(map[string]interface{}{
				"status":        "failed",
				"error_message": err.Error(),
				"attempts":      database.DB.Raw("attempts + 1"),
			})
		return 0, err
	}

	// Update search_index with embeddings
	now := time.Now()
	for i, item := range searchItems {
		if i < len(embeddings) {
			database.DB.Exec(`
				UPDATE search_index 
				SET embedding = $1::vector, 
				    embedding_model = 'cohere/embed-english-v3.0',
				    embedding_created_at = $2
				WHERE entity_id = $3 AND entity_type = $4
			`, pgVector(embeddings[i]), now, item.EntityID, item.EntityType)
		}
	}

	// Mark queue items as completed
	database.DB.Model(&models.EmbeddingQueue{}).
		Where("id IN ?", ids).
		Updates(map[string]interface{}{
			"status":       "completed",
			"processed_at": now,
		})

	log.Printf("✅ Generated embeddings for %d items", len(embeddings))
	return len(embeddings), nil
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
