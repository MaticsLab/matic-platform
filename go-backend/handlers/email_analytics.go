package handlers

import (
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Email Analytics Endpoints

// GetEmailAnalytics returns email performance metrics
func GetEmailAnalytics(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	formID := c.Query("form_id")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	wsUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	var startTime, endTime time.Time
	if startDate != "" {
		startTime, err = time.Parse("2006-01-02", startDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_date format (use YYYY-MM-DD)"})
			return
		}
	} else {
		// Default to 30 days ago
		startTime = time.Now().AddDate(0, 0, -30)
	}

	if endDate != "" {
		endTime, err = time.Parse("2006-01-02", endDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end_date format (use YYYY-MM-DD)"})
			return
		}
		// Set to end of day
		endTime = endTime.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	} else {
		endTime = time.Now()
	}

	query := database.DB.Model(&models.SentEmail{}).Where("workspace_id = ? AND sent_at >= ? AND sent_at <= ?", wsUUID, startTime, endTime)

	if formID != "" {
		formUUID, _ := uuid.Parse(formID)
		query = query.Where("form_id = ?", formUUID)
	}

	var stats struct {
		TotalSent      int64   `json:"total_sent"`
		TotalDelivered int64   `json:"total_delivered"`
		TotalOpened    int64   `json:"total_opened"`
		TotalClicked   int64   `json:"total_clicked"`
		TotalBounced   int64   `json:"total_bounced"`
		TotalFailed    int64   `json:"total_failed"`
		DeliveryRate   float64 `json:"delivery_rate"`
		OpenRate       float64 `json:"open_rate"`
		ClickRate      float64 `json:"click_rate"`
		BounceRate     float64 `json:"bounce_rate"`
	}

	query.Count(&stats.TotalSent)
	query.Where("status IN ('delivered', 'opened', 'clicked')").Count(&stats.TotalDelivered)
	query.Where("status IN ('opened', 'clicked') OR opened_at IS NOT NULL").Count(&stats.TotalOpened)
	query.Where("status = 'clicked' OR clicked_at IS NOT NULL").Count(&stats.TotalClicked)
	query.Where("status = 'bounced'").Count(&stats.TotalBounced)
	query.Where("status = 'failed'").Count(&stats.TotalFailed)

	// Calculate rates
	if stats.TotalSent > 0 {
		stats.DeliveryRate = float64(stats.TotalDelivered) / float64(stats.TotalSent) * 100
		stats.OpenRate = float64(stats.TotalOpened) / float64(stats.TotalSent) * 100
		stats.ClickRate = float64(stats.TotalClicked) / float64(stats.TotalSent) * 100
		stats.BounceRate = float64(stats.TotalBounced) / float64(stats.TotalSent) * 100
	}

	c.JSON(http.StatusOK, stats)
}

// GetEmailServiceHealth returns health status for email services
func GetEmailServiceHealth(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	wsUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	var gmailHealth, resendHealth models.EmailServiceHealth
	database.DB.Where("workspace_id = ? AND service_type = ?", wsUUID, "gmail").First(&gmailHealth)
	database.DB.Where("workspace_id = ? AND service_type = ?", wsUUID, "resend").First(&resendHealth)

	c.JSON(http.StatusOK, gin.H{
		"gmail":  gmailHealth,
		"resend": resendHealth,
	})
}

// GetEmailCampaignAnalytics returns analytics for a specific campaign
func GetEmailCampaignAnalytics(c *gin.Context) {
	campaignID := c.Param("id")

	var campaign models.EmailCampaign
	if err := database.DB.First(&campaign, "id = ?", campaignID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Campaign not found"})
		return
	}

	var stats struct {
		TotalSent      int64   `json:"total_sent"`
		TotalDelivered int64   `json:"total_delivered"`
		TotalOpened    int64   `json:"total_opened"`
		TotalClicked   int64   `json:"total_clicked"`
		TotalBounced   int64   `json:"total_bounced"`
		DeliveryRate   float64 `json:"delivery_rate"`
		OpenRate       float64 `json:"open_rate"`
		ClickRate      float64 `json:"click_rate"`
		BounceRate     float64 `json:"bounce_rate"`
	}

	database.DB.Model(&models.SentEmail{}).
		Where("campaign_id = ?", campaign.ID).
		Count(&stats.TotalSent)

	database.DB.Model(&models.SentEmail{}).
		Where("campaign_id = ? AND status IN ('delivered', 'opened', 'clicked')", campaign.ID).
		Count(&stats.TotalDelivered)

	database.DB.Model(&models.SentEmail{}).
		Where("campaign_id = ? AND (status IN ('opened', 'clicked') OR opened_at IS NOT NULL)", campaign.ID).
		Count(&stats.TotalOpened)

	database.DB.Model(&models.SentEmail{}).
		Where("campaign_id = ? AND (status = 'clicked' OR clicked_at IS NOT NULL)", campaign.ID).
		Count(&stats.TotalClicked)

	database.DB.Model(&models.SentEmail{}).
		Where("campaign_id = ? AND status = 'bounced'", campaign.ID).
		Count(&stats.TotalBounced)

	if stats.TotalSent > 0 {
		stats.DeliveryRate = float64(stats.TotalDelivered) / float64(stats.TotalSent) * 100
		stats.OpenRate = float64(stats.TotalOpened) / float64(stats.TotalSent) * 100
		stats.ClickRate = float64(stats.TotalClicked) / float64(stats.TotalSent) * 100
		stats.BounceRate = float64(stats.TotalBounced) / float64(stats.TotalSent) * 100
	}

	c.JSON(http.StatusOK, stats)
}

