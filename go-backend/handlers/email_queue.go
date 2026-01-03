package handlers

import (
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Email Queue Management Endpoints

// ListEmailQueueItems returns queued emails
func ListEmailQueueItems(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	status := c.Query("status") // pending, processing, sent, failed, retrying

	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var items []models.EmailQueueItem
	query := database.DB.Where("workspace_id = ?", workspaceID)

	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Order("priority DESC, scheduled_for ASC").Limit(100).Find(&items)

	c.JSON(http.StatusOK, items)
}

// GetEmailQueueItem returns a single queue item
func GetEmailQueueItem(c *gin.Context) {
	id := c.Param("id")

	var item models.EmailQueueItem
	if err := database.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Queue item not found"})
		return
	}

	c.JSON(http.StatusOK, item)
}

// RetryEmailQueueItem retries a failed queue item
func RetryEmailQueueItem(c *gin.Context) {
	id := c.Param("id")

	var item models.EmailQueueItem
	if err := database.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Queue item not found"})
		return
	}

	// Check if we've exceeded max attempts
	if item.AttemptCount >= item.MaxAttempts {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Maximum retry attempts exceeded"})
		return
	}

	// Reset status to pending for retry
	item.Status = "pending"
	item.ScheduledFor = time.Now() // Retry immediately
	item.ErrorMessage = ""

	if err := database.DB.Save(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retry queue item"})
		return
	}

	c.JSON(http.StatusOK, item)
}

// CancelEmailQueueItem cancels a pending queue item
func CancelEmailQueueItem(c *gin.Context) {
	id := c.Param("id")

	var item models.EmailQueueItem
	if err := database.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Queue item not found"})
		return
	}

	// Only allow canceling pending items
	if item.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only cancel pending items"})
		return
	}

	item.Status = "failed"
	item.ErrorMessage = "Cancelled by user"

	if err := database.DB.Save(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel queue item"})
		return
	}

	c.JSON(http.StatusOK, item)
}

// GetEmailQueueStats returns queue statistics
func GetEmailQueueStats(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var stats struct {
		Pending    int64 `json:"pending"`
		Processing int64 `json:"processing"`
		Sent       int64 `json:"sent"`
		Failed     int64 `json:"failed"`
		Retrying   int64 `json:"retrying"`
	}

	wsUUID, _ := uuid.Parse(workspaceID)

	database.DB.Model(&models.EmailQueueItem{}).
		Where("workspace_id = ? AND status = ?", wsUUID, "pending").
		Count(&stats.Pending)

	database.DB.Model(&models.EmailQueueItem{}).
		Where("workspace_id = ? AND status = ?", wsUUID, "processing").
		Count(&stats.Processing)

	database.DB.Model(&models.EmailQueueItem{}).
		Where("workspace_id = ? AND status = ?", wsUUID, "sent").
		Count(&stats.Sent)

	database.DB.Model(&models.EmailQueueItem{}).
		Where("workspace_id = ? AND status = ?", wsUUID, "failed").
		Count(&stats.Failed)

	database.DB.Model(&models.EmailQueueItem{}).
		Where("workspace_id = ? AND status = ?", wsUUID, "retrying").
		Count(&stats.Retrying)

	c.JSON(http.StatusOK, stats)
}

