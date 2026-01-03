package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
)

// ResendWebhookEvent represents a Resend webhook event payload
type ResendWebhookEvent struct {
	Type      string `json:"type"` // email.sent, email.delivered, email.delivery_delayed, email.complained, email.bounced, email.opened, email.clicked
	CreatedAt string `json:"created_at"`
	Data      struct {
		EmailID   string `json:"email_id"`
		From      string `json:"from"`
		To        string `json:"to"`
		Subject   string `json:"subject"`
		CreatedAt string `json:"created_at"`
		// For opened events
		Location string `json:"location,omitempty"`
		// For clicked events
		Link string `json:"link,omitempty"`
		// For bounced/complained events
		BounceType string `json:"bounce_type,omitempty"`
		Reason     string `json:"reason,omitempty"`
	} `json:"data"`
}

// HandleResendWebhook processes Resend webhook events
func HandleResendWebhook(c *gin.Context) {
	// Read the raw body for signature verification
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	var event ResendWebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook payload"})
		return
	}

	// Verify webhook signature if signature header is provided
	signature := c.GetHeader("svix-signature")
	if signature != "" {
		// TODO: Implement signature verification if needed
		// Resend uses Svix for webhook signing
		// For now, we'll process without verification (should add in production)
	}

	// Process the event
	err = processResendEvent(event)
	if err != nil {
		fmt.Printf("[Resend Webhook] Error processing event: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process event"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// processResendEvent processes a Resend webhook event
func processResendEvent(event ResendWebhookEvent) error {
	emailID := event.Data.EmailID
	if emailID == "" {
		return fmt.Errorf("email_id is required")
	}

	// Find the sent email by Resend message ID
	var sentEmail models.SentEmail
	if err := database.DB.Where("resend_message_id = ?", emailID).First(&sentEmail).Error; err != nil {
		// Email not found - might be from a different workspace or not tracked
		fmt.Printf("[Resend Webhook] Email not found for message_id: %s\n", emailID)
		return nil // Not an error - just log and continue
	}

	now := time.Now()

	switch event.Type {
	case "email.sent":
		// Email was sent (initial status)
		sentEmail.Status = "sent"
		return database.DB.Save(&sentEmail).Error

	case "email.delivered":
		// Email was delivered
		sentEmail.Status = "delivered"
		return database.DB.Save(&sentEmail).Error

	case "email.delivery_delayed":
		// Delivery was delayed (keep as sent, but could track separately)
		// For now, just log it
		fmt.Printf("[Resend Webhook] Delivery delayed for email: %s\n", emailID)
		return nil

	case "email.opened":
		// Email was opened
		if sentEmail.OpenedAt == nil {
			sentEmail.OpenedAt = &now
		}
		sentEmail.OpenCount++
		sentEmail.Status = "opened"
		return database.DB.Save(&sentEmail).Error

	case "email.clicked":
		// Email link was clicked
		if sentEmail.ClickedAt == nil {
			sentEmail.ClickedAt = &now
		}
		sentEmail.ClickCount++
		sentEmail.Status = "clicked"
		return database.DB.Save(&sentEmail).Error

	case "email.bounced":
		// Email bounced
		bounceTime := now
		sentEmail.BouncedAt = &bounceTime
		sentEmail.BounceReason = event.Data.Reason
		sentEmail.Status = "bounced"
		return database.DB.Save(&sentEmail).Error

	case "email.complained":
		// Recipient marked as spam
		// Similar to bounce - mark as failed
		sentEmail.Status = "failed"
		sentEmail.BounceReason = "Marked as spam"
		return database.DB.Save(&sentEmail).Error

	default:
		fmt.Printf("[Resend Webhook] Unknown event type: %s\n", event.Type)
		return nil
	}
}

// VerifyResendWebhookSignature verifies the webhook signature (if using Svix)
func VerifyResendWebhookSignature(body []byte, signature string, secret string) bool {
	// Parse signature header (format: "t=timestamp,v1=signature")
	// For now, return true (skip verification)
	// TODO: Implement proper signature verification using Svix library
	return true
}

// Helper function to compute HMAC SHA256
func computeHMAC(data []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}
