package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/google/uuid"
)

// EmailServiceType represents the email service provider
type EmailServiceType string

const (
	ServiceTypeGmail  EmailServiceType = "gmail"
	ServiceTypeResend EmailServiceType = "resend"
)

// EmailSendRequest represents a request to send an email
type EmailSendRequest struct {
	WorkspaceID  uuid.UUID
	To           string
	ToName       string
	From         string
	FromName     string
	Subject      string
	Body         string
	BodyHTML     string
	ReplyTo      string
	SubmissionID *uuid.UUID
	FormID       *uuid.UUID
	ServiceType  EmailServiceType // Preferred service, will fallback if needed
	TrackOpens   bool
	ThreadID     string
	InReplyTo    string
	References   string
}

// EmailSendResult represents the result of sending an email
type EmailSendResult struct {
	Success      bool
	MessageID    string
	ServiceType  EmailServiceType
	ErrorMessage string
}

// EmailRouter handles intelligent routing between Gmail and Resend
type EmailRouter struct{}

// NewEmailRouter creates a new email router instance
func NewEmailRouter() *EmailRouter {
	return &EmailRouter{}
}

// DetermineServiceType determines which service to use based on email type and health
func (r *EmailRouter) DetermineServiceType(ctx context.Context, workspaceID uuid.UUID, preferredType EmailServiceType, emailType string) (EmailServiceType, error) {
	// For reminders and system notifications, prefer Resend
	if emailType == "reminder" || emailType == "system" || emailType == "notification" {
		health, err := r.checkServiceHealth(ctx, workspaceID, ServiceTypeResend)
		if err == nil && health.Status == "healthy" {
			return ServiceTypeResend, nil
		}
		// Fallback to Gmail if Resend is down
		health, err = r.checkServiceHealth(ctx, workspaceID, ServiceTypeGmail)
		if err == nil && health.Status == "healthy" {
			return ServiceTypeGmail, nil
		}
		return preferredType, nil
	}

	// For communications, prefer Gmail (personal touch)
	if emailType == "communication" || emailType == "applicant" {
		health, err := r.checkServiceHealth(ctx, workspaceID, ServiceTypeGmail)
		if err == nil && health.Status == "healthy" {
			return ServiceTypeGmail, nil
		}
		// Fallback to Resend if Gmail is down
		health, err = r.checkServiceHealth(ctx, workspaceID, ServiceTypeResend)
		if err == nil && health.Status == "healthy" {
			return ServiceTypeResend, nil
		}
		return preferredType, nil
	}

	// Default: use preferred type, but check health
	health, err := r.checkServiceHealth(ctx, workspaceID, preferredType)
	if err == nil && health.Status == "healthy" {
		return preferredType, nil
	}

	// Fallback to the other service
	fallbackType := ServiceTypeGmail
	if preferredType == ServiceTypeGmail {
		fallbackType = ServiceTypeResend
	}
	health, err = r.checkServiceHealth(ctx, workspaceID, fallbackType)
	if err == nil && health.Status == "healthy" {
		return fallbackType, nil
	}

	// If both are unhealthy, return preferred type anyway (will fail gracefully)
	return preferredType, nil
}

// SendEmail routes and sends an email using the appropriate service
func (r *EmailRouter) SendEmail(ctx context.Context, req EmailSendRequest) (*EmailSendResult, error) {
	// Determine which service to use
	serviceType, err := r.DetermineServiceType(ctx, req.WorkspaceID, req.ServiceType, "communication")
	if err != nil {
		return &EmailSendResult{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Failed to determine service type: %v", err),
		}, err
	}

	// Send via the determined service
	switch serviceType {
	case ServiceTypeResend:
		return r.sendViaResend(ctx, req)
	case ServiceTypeGmail:
		return r.sendViaGmail(ctx, req)
	default:
		return &EmailSendResult{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Unknown service type: %s", serviceType),
		}, fmt.Errorf("unknown service type: %s", serviceType)
	}
}

// sendViaResend sends an email via Resend API
func (r *EmailRouter) sendViaResend(ctx context.Context, req EmailSendRequest) (*EmailSendResult, error) {
	// Get Resend integration
	var resendIntegration models.ResendIntegration
	if err := database.DB.Where("workspace_id = ? AND is_active = ?", req.WorkspaceID, true).First(&resendIntegration).Error; err != nil {
		return &EmailSendResult{
			Success:      false,
			ServiceType:  ServiceTypeResend,
			ErrorMessage: "Resend integration not configured",
		}, err
	}

	// Prepare Resend API request
	resendURL := "https://api.resend.com/emails"
	if apiURL := os.Getenv("RESEND_API_URL"); apiURL != "" {
		resendURL = apiURL + "/emails"
	}

	payload := map[string]interface{}{
		"from":    req.From,
		"to":      []string{req.To},
		"subject": req.Subject,
		"text":    req.Body,
	}

	if req.BodyHTML != "" {
		payload["html"] = req.BodyHTML
	}

	if req.ReplyTo != "" {
		payload["reply_to"] = req.ReplyTo
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return &EmailSendResult{
			Success:      false,
			ServiceType:  ServiceTypeResend,
			ErrorMessage: fmt.Sprintf("Failed to marshal payload: %v", err),
		}, err
	}

	// Make HTTP request to Resend
	httpReq, err := http.NewRequestWithContext(ctx, "POST", resendURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return &EmailSendResult{
			Success:      false,
			ServiceType:  ServiceTypeResend,
			ErrorMessage: fmt.Sprintf("Failed to create request: %v", err),
		}, err
	}

	httpReq.Header.Set("Authorization", "Bearer "+resendIntegration.APIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	// Execute request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		// Update health status
		r.UpdateServiceHealth(ctx, req.WorkspaceID, ServiceTypeResend, "down", err.Error())
		return &EmailSendResult{
			Success:      false,
			ServiceType:  ServiceTypeResend,
			ErrorMessage: fmt.Sprintf("Failed to send email: %v", err),
		}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &EmailSendResult{
			Success:      false,
			ServiceType:  ServiceTypeResend,
			ErrorMessage: fmt.Sprintf("Failed to read response: %v", err),
		}, err
	}

	if resp.StatusCode != http.StatusOK {
		var errorResp struct {
			Message string `json:"message"`
		}
		json.Unmarshal(body, &errorResp)

		errorMsg := errorResp.Message
		if errorMsg == "" {
			errorMsg = fmt.Sprintf("HTTP %d: Failed to send email", resp.StatusCode)
		}

		// Update health status
		r.UpdateServiceHealth(ctx, req.WorkspaceID, ServiceTypeResend, "down", errorMsg)

		return &EmailSendResult{
			Success:      false,
			ServiceType:  ServiceTypeResend,
			ErrorMessage: errorMsg,
		}, fmt.Errorf(errorMsg)
	}

	// Parse successful response
	var resendResp struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(body, &resendResp); err != nil {
		return &EmailSendResult{
			Success:      false,
			ServiceType:  ServiceTypeResend,
			ErrorMessage: fmt.Sprintf("Failed to parse response: %v", err),
		}, err
	}

	// Update health status to healthy
	r.UpdateServiceHealth(ctx, req.WorkspaceID, ServiceTypeResend, "healthy", "")

	return &EmailSendResult{
		Success:     true,
		MessageID:   resendResp.ID,
		ServiceType: ServiceTypeResend,
	}, nil
}

// sendViaGmail sends an email via Gmail API
func (r *EmailRouter) sendViaGmail(ctx context.Context, req EmailSendRequest) (*EmailSendResult, error) {
	// Build from address
	fromName := req.FromName
	if fromName == "" {
		fromName = req.From
	}

	// Send via Gmail
	messageID, threadID, err := SendGmailEmail(
		ctx,
		req.WorkspaceID,
		req.To,
		req.ToName,
		req.From,
		fromName,
		req.Subject,
		req.Body,
		req.BodyHTML,
		req.ThreadID,
		req.InReplyTo,
		req.References,
	)

	if err != nil {
		// Update health status
		r.UpdateServiceHealth(ctx, req.WorkspaceID, ServiceTypeGmail, "down", err.Error())
		return &EmailSendResult{
			Success:      false,
			ServiceType:  ServiceTypeGmail,
			ErrorMessage: err.Error(),
		}, err
	}

	// Update health status to healthy
	r.UpdateServiceHealth(ctx, req.WorkspaceID, ServiceTypeGmail, "healthy", "")

	return &EmailSendResult{
		Success:     true,
		MessageID:   messageID,
		ServiceType: ServiceTypeGmail,
	}, nil
}

// checkServiceHealth checks the health status of an email service
func (r *EmailRouter) checkServiceHealth(ctx context.Context, workspaceID uuid.UUID, serviceType EmailServiceType) (*models.EmailServiceHealth, error) {
	var health models.EmailServiceHealth
	err := database.DB.Where("workspace_id = ? AND service_type = ?", workspaceID, string(serviceType)).First(&health).Error
	if err != nil {
		// If no health record exists, create a default one (unknown status)
		health = models.EmailServiceHealth{
			ID:          uuid.New(),
			WorkspaceID: workspaceID,
			ServiceType: string(serviceType),
			Status:      "unknown",
		}
		database.DB.Create(&health)
		return &health, nil
	}

	// If health check is older than 5 minutes, mark as stale
	if time.Since(health.LastCheckedAt) > 5*time.Minute {
		health.Status = "unknown"
	}

	return &health, nil
}

// UpdateServiceHealth updates the health status of an email service
func (r *EmailRouter) UpdateServiceHealth(ctx context.Context, workspaceID uuid.UUID, serviceType EmailServiceType, status string, errorMsg string) error {
	var health models.EmailServiceHealth
	err := database.DB.Where("workspace_id = ? AND service_type = ?", workspaceID, string(serviceType)).First(&health).Error

	now := time.Now()
	if err != nil {
		// Create new health record
		health = models.EmailServiceHealth{
			ID:            uuid.New(),
			WorkspaceID:   workspaceID,
			ServiceType:   string(serviceType),
			Status:        status,
			LastCheckedAt: now,
		}
		if status == "healthy" {
			health.LastSuccessAt = &now
		} else {
			health.LastFailureAt = &now
			health.FailureCount = 1
			health.ErrorMessage = errorMsg
		}
		return database.DB.Create(&health).Error
	}

	// Update existing record
	health.Status = status
	health.LastCheckedAt = now
	if status == "healthy" {
		health.LastSuccessAt = &now
		health.FailureCount = 0
		health.ErrorMessage = ""
	} else {
		health.LastFailureAt = &now
		health.FailureCount++
		health.ErrorMessage = errorMsg
	}

	return database.DB.Save(&health).Error
}
