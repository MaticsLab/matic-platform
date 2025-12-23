package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// WorkflowWebhookConfig represents the configuration for a workflow webhook
type WorkflowWebhookConfig struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	FormID      uuid.UUID      `json:"form_id" gorm:"type:uuid;not null"`
	WorkspaceID uuid.UUID      `json:"workspace_id" gorm:"type:uuid;not null"`
	WorkflowID  string         `json:"workflow_id" gorm:"type:text;not null"` // ID in the workflow builder
	WebhookURL  string         `json:"webhook_url" gorm:"type:text;not null"`
	APIKey      string         `json:"api_key" gorm:"type:text"`               // API key for authenticating with workflow builder
	TriggerType string         `json:"trigger_type" gorm:"type:text;not null"` // new_submission, stage_changed, etc.
	Config      datatypes.JSON `json:"config" gorm:"type:jsonb;default:'{}'"`  // Additional config like specific stage, tag, etc.
	Enabled     bool           `json:"enabled" gorm:"default:true"`
	CreatedAt   time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
}

// WorkflowWebhookPayload represents the data sent to the workflow webhook
type WorkflowWebhookPayload struct {
	EventType     string                 `json:"eventType"`
	ApplicationID string                 `json:"applicationId"`
	FormID        string                 `json:"formId"`
	WorkspaceID   string                 `json:"workspaceId"`
	Timestamp     time.Time              `json:"timestamp"`
	Data          map[string]interface{} `json:"data"`
}

// CreateWorkflowWebhookInput represents the input for creating a workflow webhook
type CreateWorkflowWebhookInput struct {
	FormID      string                 `json:"form_id" binding:"required"`
	WorkflowID  string                 `json:"workflow_id" binding:"required"`
	WebhookURL  string                 `json:"webhook_url" binding:"required"`
	APIKey      string                 `json:"api_key"`
	TriggerType string                 `json:"trigger_type" binding:"required"`
	Config      map[string]interface{} `json:"config"`
}

// ListWorkflowWebhooks returns all workflow webhooks for a form
func ListWorkflowWebhooks(c *gin.Context) {
	formID := c.Query("form_id")
	if formID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "form_id is required"})
		return
	}

	var webhooks []WorkflowWebhookConfig
	if err := database.DB.Where("form_id = ?", formID).Find(&webhooks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch webhooks"})
		return
	}

	c.JSON(http.StatusOK, webhooks)
}

// CreateWorkflowWebhook creates a new workflow webhook
func CreateWorkflowWebhook(c *gin.Context) {
	var input CreateWorkflowWebhookInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get workspace ID from form (forms are stored as tables)
	var form models.Table
	if err := database.DB.First(&form, "id = ?", input.FormID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	configJSON, _ := json.Marshal(input.Config)

	webhook := WorkflowWebhookConfig{
		ID:          uuid.New(),
		FormID:      form.ID,
		WorkspaceID: form.WorkspaceID,
		WorkflowID:  input.WorkflowID,
		WebhookURL:  input.WebhookURL,
		APIKey:      input.APIKey,
		TriggerType: input.TriggerType,
		Config:      datatypes.JSON(configJSON),
		Enabled:     true,
	}

	if err := database.DB.Create(&webhook).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create webhook"})
		return
	}

	c.JSON(http.StatusCreated, webhook)
}

// UpdateWorkflowWebhook updates an existing workflow webhook
func UpdateWorkflowWebhook(c *gin.Context) {
	id := c.Param("id")

	var webhook WorkflowWebhookConfig
	if err := database.DB.First(&webhook, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Webhook not found"})
		return
	}

	var input struct {
		WebhookURL  string                 `json:"webhook_url"`
		APIKey      string                 `json:"api_key"`
		TriggerType string                 `json:"trigger_type"`
		Config      map[string]interface{} `json:"config"`
		Enabled     *bool                  `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.WebhookURL != "" {
		webhook.WebhookURL = input.WebhookURL
	}
	if input.APIKey != "" {
		webhook.APIKey = input.APIKey
	}
	if input.TriggerType != "" {
		webhook.TriggerType = input.TriggerType
	}
	if input.Config != nil {
		configJSON, _ := json.Marshal(input.Config)
		webhook.Config = datatypes.JSON(configJSON)
	}
	if input.Enabled != nil {
		webhook.Enabled = *input.Enabled
	}

	if err := database.DB.Save(&webhook).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update webhook"})
		return
	}

	c.JSON(http.StatusOK, webhook)
}

// DeleteWorkflowWebhook deletes a workflow webhook
func DeleteWorkflowWebhook(c *gin.Context) {
	id := c.Param("id")

	if err := database.DB.Delete(&WorkflowWebhookConfig{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete webhook"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Webhook deleted"})
}

// TriggerWorkflowWebhook sends a webhook to the workflow builder
// This is an internal function called by other handlers when events occur
func TriggerWorkflowWebhook(eventType string, formID uuid.UUID, submissionID uuid.UUID, data map[string]interface{}) error {
	// Find all enabled webhooks for this form and event type
	var webhooks []WorkflowWebhookConfig
	if err := database.DB.Where("form_id = ? AND trigger_type = ? AND enabled = true", formID, eventType).Find(&webhooks).Error; err != nil {
		return fmt.Errorf("failed to fetch webhooks: %w", err)
	}

	if len(webhooks) == 0 {
		return nil // No webhooks configured, not an error
	}

	// Get form to get workspace ID (forms are stored as tables)
	var form models.Table
	if err := database.DB.First(&form, "id = ?", formID).Error; err != nil {
		return fmt.Errorf("failed to fetch form: %w", err)
	}

	payload := WorkflowWebhookPayload{
		EventType:     eventType,
		ApplicationID: submissionID.String(),
		FormID:        formID.String(),
		WorkspaceID:   form.WorkspaceID.String(),
		Timestamp:     time.Now(),
		Data:          data,
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Send webhook to all configured endpoints
	for _, webhook := range webhooks {
		go sendWebhook(webhook, payloadJSON)
	}

	return nil
}

// sendWebhook sends the webhook request asynchronously
func sendWebhook(webhook WorkflowWebhookConfig, payload []byte) {
	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest("POST", webhook.WebhookURL, bytes.NewReader(payload))
	if err != nil {
		fmt.Printf("[Webhook] Failed to create request: %v\n", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	if webhook.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+webhook.APIKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("[Webhook] Failed to send webhook to %s: %v\n", webhook.WebhookURL, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		fmt.Printf("[Webhook] Webhook to %s returned status %d\n", webhook.WebhookURL, resp.StatusCode)
	} else {
		fmt.Printf("[Webhook] Successfully sent webhook to %s\n", webhook.WebhookURL)
	}
}

// Helper function to trigger submission webhooks
func TriggerNewSubmissionWebhook(formID uuid.UUID, submissionID uuid.UUID, submissionData map[string]interface{}) {
	data := map[string]interface{}{
		"submission": submissionData,
	}
	if err := TriggerWorkflowWebhook("new_submission", formID, submissionID, data); err != nil {
		fmt.Printf("[Webhook] Failed to trigger new_submission webhook: %v\n", err)
	}
}

// Helper function to trigger stage change webhooks
func TriggerStageChangedWebhook(formID uuid.UUID, submissionID uuid.UUID, previousStageID, newStageID string, newStageName string) {
	data := map[string]interface{}{
		"previousStageId": previousStageID,
		"newStageId":      newStageID,
		"newStageName":    newStageName,
	}
	if err := TriggerWorkflowWebhook("stage_changed", formID, submissionID, data); err != nil {
		fmt.Printf("[Webhook] Failed to trigger stage_changed webhook: %v\n", err)
	}
}

// Helper function to trigger score submitted webhooks
func TriggerScoreSubmittedWebhook(formID uuid.UUID, submissionID uuid.UUID, reviewerID string, score float64, rubricScores map[string]float64) {
	data := map[string]interface{}{
		"reviewerId":   reviewerID,
		"score":        score,
		"rubricScores": rubricScores,
	}
	if err := TriggerWorkflowWebhook("score_submitted", formID, submissionID, data); err != nil {
		fmt.Printf("[Webhook] Failed to trigger score_submitted webhook: %v\n", err)
	}
}

// Helper function to trigger tag changed webhooks
func TriggerTagChangedWebhook(formID uuid.UUID, submissionID uuid.UUID, action string, tagName string, allTags []string) {
	data := map[string]interface{}{
		"action":  action, // "added" or "removed"
		"tagName": tagName,
		"allTags": allTags,
	}
	if err := TriggerWorkflowWebhook("tag_changed", formID, submissionID, data); err != nil {
		fmt.Printf("[Webhook] Failed to trigger tag_changed webhook: %v\n", err)
	}
}

// Helper function to trigger status changed webhooks
func TriggerStatusChangedWebhook(formID uuid.UUID, submissionID uuid.UUID, previousStatus, newStatus string) {
	data := map[string]interface{}{
		"previousStatus": previousStatus,
		"newStatus":      newStatus,
	}
	if err := TriggerWorkflowWebhook("status_changed", formID, submissionID, data); err != nil {
		fmt.Printf("[Webhook] Failed to trigger status_changed webhook: %v\n", err)
	}
}
