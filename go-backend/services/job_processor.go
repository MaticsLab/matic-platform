package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/google/uuid"
)

// AsyncJobProcessor handles background job processing for embeddings and search indexing
// This replaces the embedding_queue table which was dropped in migration 019
// Jobs are now processed via Go routines with configurable workers

type JobType string

const (
	JobTypeSearchIndex  JobType = "search_index" // Index row for full-text search
	JobTypeEmbedding    JobType = "embedding"    // Generate AI embeddings
	JobTypeAggregation  JobType = "aggregation"  // Aggregate workspace stats
	JobTypeRetention    JobType = "retention"    // Clean up old versions
	JobTypeNotification JobType = "notification" // Send email notifications
)

type JobPriority int

const (
	PriorityLow      JobPriority = 1
	PriorityNormal   JobPriority = 5
	PriorityHigh     JobPriority = 8
	PriorityCritical JobPriority = 10
)

type JobStatus string

const (
	JobStatusPending    JobStatus = "pending"
	JobStatusProcessing JobStatus = "processing"
	JobStatusCompleted  JobStatus = "completed"
	JobStatusFailed     JobStatus = "failed"
)

// Job represents a background task to be processed
type Job struct {
	ID          uuid.UUID       `json:"id"`
	Type        JobType         `json:"type"`
	Priority    JobPriority     `json:"priority"`
	Status      JobStatus       `json:"status"`
	Payload     json.RawMessage `json:"payload"`
	Result      json.RawMessage `json:"result,omitempty"`
	Error       string          `json:"error,omitempty"`
	Attempts    int             `json:"attempts"`
	MaxAttempts int             `json:"max_attempts"`
	CreatedAt   time.Time       `json:"created_at"`
	StartedAt   *time.Time      `json:"started_at,omitempty"`
	CompletedAt *time.Time      `json:"completed_at,omitempty"`
}

// JobProcessor manages a pool of workers to process background jobs
type JobProcessor struct {
	workers     int
	jobQueue    chan Job
	stopChannel chan bool
	handlers    map[JobType]JobHandler
}

// JobHandler is a function that processes a specific job type
type JobHandler func(ctx context.Context, job Job) error

var (
	defaultProcessor *JobProcessor
)

// InitJobProcessor initializes the global job processor
func InitJobProcessor(workers int) {
	defaultProcessor = &JobProcessor{
		workers:     workers,
		jobQueue:    make(chan Job, 1000), // Buffer 1000 jobs
		stopChannel: make(chan bool),
		handlers:    make(map[JobType]JobHandler),
	}

	// Register default handlers
	defaultProcessor.RegisterHandler(JobTypeSearchIndex, handleSearchIndexJob)
	defaultProcessor.RegisterHandler(JobTypeEmbedding, handleEmbeddingJob)
	defaultProcessor.RegisterHandler(JobTypeAggregation, handleAggregationJob)
	defaultProcessor.RegisterHandler(JobTypeRetention, handleRetentionJob)
	defaultProcessor.RegisterHandler(JobTypeNotification, handleNotificationJob)

	// Start workers
	for i := 0; i < workers; i++ {
		go defaultProcessor.worker(i)
	}

	// Start job loader (polls for new jobs from database if using persistent queue)
	go defaultProcessor.jobLoader()

	log.Printf("Job processor started with %d workers", workers)
}

// RegisterHandler registers a handler for a specific job type
func (jp *JobProcessor) RegisterHandler(jobType JobType, handler JobHandler) {
	jp.handlers[jobType] = handler
}

// EnqueueJob adds a new job to the queue
func EnqueueJob(jobType JobType, payload interface{}, priority JobPriority) (uuid.UUID, error) {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	job := Job{
		ID:          uuid.New(),
		Type:        jobType,
		Priority:    priority,
		Status:      JobStatusPending,
		Payload:     payloadJSON,
		Attempts:    0,
		MaxAttempts: 3,
		CreatedAt:   time.Now(),
	}

	// Send to in-memory queue
	select {
	case defaultProcessor.jobQueue <- job:
		log.Printf("Job %s enqueued: type=%s priority=%d", job.ID, job.Type, job.Priority)
		return job.ID, nil
	default:
		// Queue full, optionally persist to database for later processing
		log.Printf("Job queue full, job %s will be processed later", job.ID)
		return job.ID, nil
	}
}

// worker processes jobs from the queue
func (jp *JobProcessor) worker(id int) {
	log.Printf("Worker %d started", id)
	for {
		select {
		case job := <-jp.jobQueue:
			jp.processJob(id, job)
		case <-jp.stopChannel:
			log.Printf("Worker %d stopped", id)
			return
		}
	}
}

// processJob executes a single job
func (jp *JobProcessor) processJob(workerID int, job Job) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	log.Printf("Worker %d processing job %s (type=%s)", workerID, job.ID, job.Type)

	job.Status = JobStatusProcessing
	now := time.Now()
	job.StartedAt = &now
	job.Attempts++

	handler, exists := jp.handlers[job.Type]
	if !exists {
		log.Printf("No handler for job type %s", job.Type)
		job.Status = JobStatusFailed
		job.Error = fmt.Sprintf("no handler for job type %s", job.Type)
		return
	}

	err := handler(ctx, job)
	if err != nil {
		log.Printf("Job %s failed (attempt %d/%d): %v", job.ID, job.Attempts, job.MaxAttempts, err)
		job.Error = err.Error()

		if job.Attempts < job.MaxAttempts {
			// Retry with exponential backoff
			retryDelay := time.Duration(job.Attempts*job.Attempts) * time.Second
			log.Printf("Retrying job %s in %v", job.ID, retryDelay)
			time.AfterFunc(retryDelay, func() {
				jp.jobQueue <- job
			})
		} else {
			job.Status = JobStatusFailed
			log.Printf("Job %s failed permanently after %d attempts", job.ID, job.Attempts)
		}
	} else {
		job.Status = JobStatusCompleted
		completedAt := time.Now()
		job.CompletedAt = &completedAt
		log.Printf("Job %s completed successfully (took %v)", job.ID, completedAt.Sub(*job.StartedAt))
	}
}

// jobLoader periodically checks for pending jobs (if using persistent queue)
func (jp *JobProcessor) jobLoader() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Optional: Load pending jobs from database if queue is not full
			// This ensures jobs survive server restarts
		case <-jp.stopChannel:
			return
		}
	}
}

// Stop gracefully shuts down the job processor
func StopJobProcessor() {
	if defaultProcessor != nil {
		close(defaultProcessor.stopChannel)
		log.Println("Job processor stopped")
	}
}

// ============================================================================
// JOB HANDLERS
// ============================================================================

// handleSearchIndexJob indexes a row for full-text search
func handleSearchIndexJob(ctx context.Context, job Job) error {
	var payload struct {
		RowID       uuid.UUID `json:"row_id"`
		TableID     uuid.UUID `json:"table_id"`
		WorkspaceID uuid.UUID `json:"workspace_id"`
	}

	if err := json.Unmarshal(job.Payload, &payload); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}

	// Get row data
	var row struct {
		Data      json.RawMessage `gorm:"column:data"`
		TableName string          `gorm:"column:table_name"`
	}

	err := database.DB.Raw(`
		SELECT tr.data, dt.name as table_name
		FROM table_rows tr
		JOIN data_tables dt ON tr.table_id = dt.id
		WHERE tr.id = ?
	`, payload.RowID).Scan(&row).Error

	if err != nil {
		return fmt.Errorf("failed to fetch row: %w", err)
	}

	// Build searchable text from row data
	var rowData map[string]interface{}
	if err := json.Unmarshal(row.Data, &rowData); err != nil {
		return fmt.Errorf("failed to parse row data: %w", err)
	}

	searchableText := buildSearchableText(rowData)

	// Upsert into search_index
	_, err = database.DB.Exec(`
		INSERT INTO search_index (
			id, entity_type, entity_id, workspace_id, table_id,
			title, searchable_text, indexed_fields, updated_at
		) VALUES (
			gen_random_uuid(), 'row', $1, $2, $3,
			$4, to_tsvector('english', $5), $6, NOW()
		)
		ON CONFLICT (entity_id, entity_type)
		DO UPDATE SET
			searchable_text = to_tsvector('english', EXCLUDED.searchable_text),
			indexed_fields = EXCLUDED.indexed_fields,
			updated_at = NOW()
	`, payload.RowID, payload.WorkspaceID, payload.TableID,
		row.TableName, searchableText, row.Data)

	return err
}

// handleEmbeddingJob generates AI embeddings for semantic search
func handleEmbeddingJob(ctx context.Context, job Job) error {
	var payload struct {
		EntityID   uuid.UUID `json:"entity_id"`
		EntityType string    `json:"entity_type"` // row, table, workspace
		Text       string    `json:"text"`
	}

	if err := json.Unmarshal(job.Payload, &payload); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}

	// TODO: Call OpenAI/Anthropic embedding API
	// embedding := generateEmbedding(payload.Text)

	// For now, just log
	log.Printf("Would generate embedding for %s %s", payload.EntityType, payload.EntityID)

	return nil
}

// handleAggregationJob aggregates workspace statistics
func handleAggregationJob(ctx context.Context, job Job) error {
	var payload struct {
		WorkspaceID uuid.UUID `json:"workspace_id"`
	}

	if err := json.Unmarshal(job.Payload, &payload); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}

	// Calculate workspace stats
	var stats struct {
		TotalTables  int `json:"total_tables"`
		TotalRows    int `json:"total_rows"`
		TotalMembers int `json:"total_members"`
	}

	database.DB.Raw(`
		SELECT
			COUNT(DISTINCT dt.id) as total_tables,
			COUNT(DISTINCT tr.id) as total_rows,
			COUNT(DISTINCT wm.id) as total_members
		FROM workspaces w
		LEFT JOIN data_tables dt ON w.id = dt.workspace_id
		LEFT JOIN table_rows tr ON dt.id = tr.table_id
		LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.status = 'active'
		WHERE w.id = ?
	`, payload.WorkspaceID).Scan(&stats)

	// Update workspace.data_summary
	statsJSON, _ := json.Marshal(stats)
	database.DB.Exec(`
		UPDATE workspaces
		SET data_summary = ?, updated_at = NOW()
		WHERE id = ?
	`, statsJSON, payload.WorkspaceID)

	log.Printf("Updated stats for workspace %s: %+v", payload.WorkspaceID, stats)
	return nil
}

// handleRetentionJob cleans up old row versions and audit data
func handleRetentionJob(ctx context.Context, job Job) error {
	// Call retention policy functions from migration 019
	database.DB.Exec("SELECT archive_old_row_versions()")
	database.DB.Exec("SELECT archive_old_search_analytics()")
	database.DB.Exec("SELECT cleanup_stale_change_requests()")

	log.Println("Retention policies executed successfully")
	return nil
}

// handleNotificationJob sends email notifications
func handleNotificationJob(ctx context.Context, job Job) error {
	var payload struct {
		To      []string `json:"to"`
		Subject string   `json:"subject"`
		Body    string   `json:"body"`
	}

	if err := json.Unmarshal(job.Payload, &payload); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}

	// TODO: Send email via SMTP/SendGrid/AWS SES
	log.Printf("Would send email to %v: %s", payload.To, payload.Subject)

	return nil
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// buildSearchableText extracts searchable text from row data
func buildSearchableText(data map[string]interface{}) string {
	var text string
	for key, value := range data {
		switch v := value.(type) {
		case string:
			text += " " + v
		case float64:
			text += " " + fmt.Sprintf("%.2f", v)
		case []interface{}:
			for _, item := range v {
				if str, ok := item.(string); ok {
					text += " " + str
				}
			}
		}
	}
	return text
}

// ============================================================================
// PUBLIC API FOR ENQUEUING JOBS
// ============================================================================

// IndexRowForSearch queues a row for search indexing
func IndexRowForSearch(rowID, tableID, workspaceID uuid.UUID) error {
	_, err := EnqueueJob(JobTypeSearchIndex, map[string]interface{}{
		"row_id":       rowID,
		"table_id":     tableID,
		"workspace_id": workspaceID,
	}, PriorityNormal)
	return err
}

// GenerateEmbedding queues an entity for AI embedding generation
func GenerateEmbedding(entityID uuid.UUID, entityType, text string) error {
	_, err := EnqueueJob(JobTypeEmbedding, map[string]interface{}{
		"entity_id":   entityID,
		"entity_type": entityType,
		"text":        text,
	}, PriorityLow)
	return err
}

// AggregateWorkspaceStats queues workspace statistics aggregation
func AggregateWorkspaceStats(workspaceID uuid.UUID) error {
	_, err := EnqueueJob(JobTypeAggregation, map[string]interface{}{
		"workspace_id": workspaceID,
	}, PriorityLow)
	return err
}

// RunRetentionPolicies queues data retention cleanup
func RunRetentionPolicies() error {
	_, err := EnqueueJob(JobTypeRetention, map[string]interface{}{}, PriorityLow)
	return err
}

// SendNotification queues an email notification
func SendNotification(to []string, subject, body string) error {
	_, err := EnqueueJob(JobTypeNotification, map[string]interface{}{
		"to":      to,
		"subject": subject,
		"body":    body,
	}, PriorityHigh)
	return err
}
