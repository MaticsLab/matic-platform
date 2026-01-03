package services

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/google/uuid"
)

// EmailQueueWorker processes queued emails
type EmailQueueWorker struct {
	router          *EmailRouter
	stop            chan bool
	tableChecked    bool
	tableExists     bool
	tableCheckMutex sync.Mutex
}

// NewEmailQueueWorker creates a new email queue worker
func NewEmailQueueWorker(router *EmailRouter) *EmailQueueWorker {
	return &EmailQueueWorker{
		router: router,
		stop:   make(chan bool),
	}
}

// Start starts the queue worker in a goroutine
func (w *EmailQueueWorker) Start(ctx context.Context) {
	go w.run(ctx)
}

// Stop stops the queue worker
func (w *EmailQueueWorker) Stop() {
	w.stop <- true
}

// run processes the queue
func (w *EmailQueueWorker) run(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second) // Process queue every 5 seconds
	defer ticker.Stop()

	for {
		select {
		case <-w.stop:
			return
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.processQueue(ctx)
		}
	}
}

// processQueue processes pending emails in the queue
func (w *EmailQueueWorker) processQueue(ctx context.Context) {
	// Check if table exists (only check once, then cache result)
	w.tableCheckMutex.Lock()
	if !w.tableChecked {
		w.tableExists = database.DB.Migrator().HasTable(&models.EmailQueueItem{})
		w.tableChecked = true
		if !w.tableExists {
			fmt.Printf("[EmailQueueWorker] email_queue table does not exist. Please run the migration or restart the server.\n")
		}
	}
	tableExists := w.tableExists
	w.tableCheckMutex.Unlock()

	if !tableExists {
		// Table doesn't exist, return silently to prevent spam
		return
	}

	// Get pending emails that are scheduled for now or earlier
	now := time.Now()
	var queueItems []models.EmailQueueItem

	err := database.DB.Where("status = ? AND scheduled_for <= ?", "pending", now).
		Order("priority DESC, scheduled_for ASC").
		Limit(10). // Process up to 10 emails per batch
		Find(&queueItems).Error

	if err != nil {
		// Check if it's a "table doesn't exist" error and update our cache
		if err.Error() == `ERROR: relation "email_queue" does not exist (SQLSTATE 42P01)` {
			w.tableCheckMutex.Lock()
			w.tableExists = false
			w.tableCheckMutex.Unlock()
			return
		}
		fmt.Printf("[EmailQueueWorker] Error fetching queue items: %v\n", err)
		return
	}

	if len(queueItems) == 0 {
		return
	}

	fmt.Printf("[EmailQueueWorker] Processing %d queue items\n", len(queueItems))

	for _, item := range queueItems {
		// Mark as processing
		item.Status = "processing"
		database.DB.Save(&item)

		// Process the email
		err := w.processQueueItem(ctx, item)

		if err != nil {
			// Handle failure
			item.AttemptCount++
			if item.AttemptCount >= item.MaxAttempts {
				item.Status = "failed"
				item.ErrorMessage = err.Error()
			} else {
				item.Status = "retrying"
				// Schedule retry with exponential backoff (1 minute * attempt count)
				retryDelay := time.Duration(item.AttemptCount) * time.Minute
				item.ScheduledFor = time.Now().Add(retryDelay)
			}
			database.DB.Save(&item)
			fmt.Printf("[EmailQueueWorker] Failed to process queue item %s: %v\n", item.ID, err)
		} else {
			// Success
			now := time.Now()
			item.Status = "sent"
			item.SentAt = &now
			database.DB.Save(&item)
			fmt.Printf("[EmailQueueWorker] Successfully processed queue item %s\n", item.ID)
		}
	}
}

// processQueueItem processes a single queue item
func (w *EmailQueueWorker) processQueueItem(ctx context.Context, item models.EmailQueueItem) error {
	// Convert queue item to EmailSendRequest
	req := EmailSendRequest{
		WorkspaceID:  item.WorkspaceID,
		To:           item.RecipientEmail,
		ToName:       item.RecipientName,
		From:         item.SenderEmail,
		Subject:      item.Subject,
		Body:         item.Body,
		BodyHTML:     item.BodyHTML,
		ServiceType:  EmailServiceType(item.ServiceType),
		FormID:       item.FormID,
		SubmissionID: item.SubmissionID,
	}

	// Determine service type if not set
	if req.ServiceType == "" {
		req.ServiceType = ServiceTypeGmail // Default to Gmail
	}

	// Send email via router
	result, err := w.router.SendEmail(ctx, req)
	if err != nil {
		return fmt.Errorf("router error: %w", err)
	}

	if !result.Success {
		return fmt.Errorf("send failed: %s", result.ErrorMessage)
	}

	// Create sent email record
	sentEmail := models.SentEmail{
		WorkspaceID:    item.WorkspaceID,
		RecipientEmail: item.RecipientEmail,
		RecipientName:  item.RecipientName,
		Subject:        item.Subject,
		Body:           item.Body,
		BodyHTML:       item.BodyHTML,
		SenderEmail:    item.SenderEmail,
		ServiceType:    string(result.ServiceType),
		Status:         "sent",
		SentAt:         time.Now(),
	}

	if item.CampaignID != nil {
		sentEmail.CampaignID = item.CampaignID
	}
	if item.FormID != nil {
		sentEmail.FormID = item.FormID
	}
	if item.SubmissionID != nil {
		sentEmail.SubmissionID = item.SubmissionID
	}

	// Set message ID based on service type
	if result.ServiceType == ServiceTypeGmail {
		sentEmail.GmailMessageID = result.MessageID
	} else if result.ServiceType == ServiceTypeResend {
		sentEmail.ResendMessageID = result.MessageID
	}

	// Generate tracking ID
	trackingID := uuid.New().String()
	sentEmail.TrackingID = trackingID

	if err := database.DB.Create(&sentEmail).Error; err != nil {
		return fmt.Errorf("failed to create sent email record: %w", err)
	}

	// Update campaign status if applicable
	if item.CampaignID != nil {
		var campaign models.EmailCampaign
		if err := database.DB.First(&campaign, "id = ?", item.CampaignID).Error; err == nil {
			// Check if all emails in campaign are sent
			var remainingCount int64
			database.DB.Model(&models.EmailQueueItem{}).
				Where("campaign_id = ? AND status IN ('pending', 'processing', 'retrying')", item.CampaignID).
				Count(&remainingCount)

			if remainingCount == 0 {
				campaign.Status = "sent"
				now := time.Now()
				campaign.SentAt = &now
				database.DB.Save(&campaign)
			}
		}
	}

	return nil
}

// ProcessCampaignQueue processes all queue items for a campaign
func ProcessCampaignQueue(ctx context.Context, router *EmailRouter, campaignID uuid.UUID, staggerDelaySeconds int) error {
	var queueItems []models.EmailQueueItem
	if err := database.DB.Where("campaign_id = ? AND status = ?", campaignID, "pending").
		Order("created_at ASC").
		Find(&queueItems).Error; err != nil {
		return fmt.Errorf("failed to fetch campaign queue items: %w", err)
	}

	if len(queueItems) == 0 {
		return nil
	}

	// Schedule emails with staggering
	baseTime := time.Now()
	for i, item := range queueItems {
		delay := time.Duration(i*staggerDelaySeconds) * time.Second
		item.ScheduledFor = baseTime.Add(delay)
		database.DB.Save(&item)
	}

	return nil
}
