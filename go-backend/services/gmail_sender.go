package services

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/gmail/v1"
	"google.golang.org/api/option"
)

// SendGmailEmail sends an email via Gmail API
// This is a helper function that can be used by EmailRouter
func SendGmailEmail(ctx context.Context, workspaceID uuid.UUID, to string, toName string, from string, fromName string, subject string, body string, bodyHTML string, threadID string, inReplyTo string, references string) (messageID string, threadIDResult string, err error) {
	// Get Gmail connection
	var connection models.GmailConnection
	if err := database.DB.Where("workspace_id = ?", workspaceID).First(&connection).Error; err != nil {
		return "", "", fmt.Errorf("Gmail not connected: %w", err)
	}

	// Create OAuth token
	token := &oauth2.Token{
		AccessToken:  connection.AccessToken,
		RefreshToken: connection.RefreshToken,
		Expiry:       connection.TokenExpiry,
	}

	config := getGmailOAuthConfig()

	// Refresh token if expired
	if token.Expiry.Before(time.Now()) {
		tokenSource := config.TokenSource(ctx, token)
		newToken, err := tokenSource.Token()
		if err != nil {
			// Mark connection as needing reconnect
			connection.NeedsReconnect = true
			connection.ReconnectReason = "Token refresh failed. Please reconnect your Gmail account."
			database.DB.Save(&connection)
			return "", "", fmt.Errorf("token refresh failed: %w", err)
		}
		if newToken.AccessToken != token.AccessToken {
			connection.AccessToken = newToken.AccessToken
			connection.RefreshToken = newToken.RefreshToken
			connection.TokenExpiry = newToken.Expiry
			database.DB.Save(&connection)
		}
		token = newToken
	}

	// Create Gmail service
	client := config.Client(ctx, token)
	gmailService, err := gmail.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return "", "", fmt.Errorf("failed to create Gmail service: %w", err)
	}

	// Build From address
	fromAddress := from
	if fromName != "" {
		fromAddress = fmt.Sprintf("%s <%s>", fromName, from)
	}

	// Create MIME message
	mimeMessage := createSimpleMIMMessage(fromAddress, to, toName, subject, body, bodyHTML)

	// Create Gmail message
	message := &gmail.Message{
		Raw: base64.URLEncoding.EncodeToString([]byte(mimeMessage)),
	}

	// Set thread ID if replying
	if threadID != "" {
		message.ThreadId = threadID
	}

	// Send email
	sentMessage, err := gmailService.Users.Messages.Send("me", message).Do()
	if err != nil {
		// Check if this is an OAuth error
		errStr := err.Error()
		if strings.Contains(errStr, "invalid_grant") ||
			strings.Contains(errStr, "Token has been expired or revoked") ||
			strings.Contains(errStr, "token expired") ||
			strings.Contains(errStr, "invalid_token") ||
			strings.Contains(errStr, "unauthorized") {
			connection.NeedsReconnect = true
			connection.ReconnectReason = "Your Gmail authorization has expired or been revoked. Please reconnect your account."
			database.DB.Save(&connection)
		}
		return "", "", fmt.Errorf("failed to send email: %w", err)
	}

	return sentMessage.Id, sentMessage.ThreadId, nil
}

// getGmailOAuthConfig creates Gmail OAuth config from environment variables
func getGmailOAuthConfig() *oauth2.Config {
	baseURL := os.Getenv("GO_BACKEND_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}

	return &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  baseURL + "/api/v1/email/oauth/callback",
		Scopes: []string{
			gmail.GmailSendScope,
			gmail.GmailReadonlyScope,
			"https://www.googleapis.com/auth/userinfo.email",
		},
		Endpoint: google.Endpoint,
	}
}

// createSimpleMIMMessage creates a simple MIME message for email sending
func createSimpleMIMMessage(from, to, toName, subject, textBody, htmlBody string) string {
	var sb strings.Builder

	// Headers
	if toName != "" {
		sb.WriteString(fmt.Sprintf("To: %s <%s>\r\n", toName, to))
	} else {
		sb.WriteString(fmt.Sprintf("To: %s\r\n", to))
	}
	sb.WriteString(fmt.Sprintf("From: %s\r\n", from))
	sb.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	sb.WriteString("MIME-Version: 1.0\r\n")

	// Body
	if htmlBody != "" {
		boundary := "boundary_" + uuid.New().String()
		sb.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=%s\r\n", boundary))
		sb.WriteString("\r\n")

		// Plain text part
		sb.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		sb.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
		sb.WriteString("\r\n")
		sb.WriteString(textBody)
		sb.WriteString("\r\n")

		// HTML part
		sb.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		sb.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
		sb.WriteString("\r\n")
		sb.WriteString(htmlBody)
		sb.WriteString("\r\n")

		sb.WriteString(fmt.Sprintf("--%s--\r\n", boundary))
	} else {
		// Plain text only
		sb.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
		sb.WriteString("\r\n")
		sb.WriteString(textBody)
	}

	return sb.String()
}

