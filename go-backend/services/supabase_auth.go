package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
)

// SupabaseAuthService handles Supabase Auth Admin operations
type SupabaseAuthService struct {
	URL            string
	ServiceRoleKey string
	SiteURL        string
}

// NewSupabaseAuthService creates a new Supabase Auth service
func NewSupabaseAuthService() *SupabaseAuthService {
	siteURL := os.Getenv("SITE_URL")
	if siteURL == "" {
		// Always default to production URL
		// The actual email URL is controlled by Supabase project settings (Site URL)
		siteURL = "https://maticsapp.com"
	}

	return &SupabaseAuthService{
		URL:            os.Getenv("SUPABASE_URL"),
		ServiceRoleKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		SiteURL:        siteURL,
	}
}

// InviteUserResponse represents the response from Supabase invite endpoint
type InviteUserResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Error string `json:"error,omitempty"`
	Msg   string `json:"msg,omitempty"`
}

// InviteUserByEmail sends an invitation email via Supabase Auth
// This uses the Admin API to invite a user
func (s *SupabaseAuthService) InviteUserByEmail(email string, redirectURL string) (*InviteUserResponse, error) {
	if s.URL == "" || s.ServiceRoleKey == "" {
		return nil, fmt.Errorf("Supabase configuration is missing")
	}

	// Build the redirect URL if not provided
	if redirectURL == "" {
		redirectURL = s.SiteURL
	}

	// Supabase Auth Admin API endpoint for inviting users
	url := fmt.Sprintf("%s/auth/v1/invite", s.URL)

	// Request body
	requestBody := map[string]interface{}{
		"email": email,
		"data": map[string]interface{}{
			"invite_type": "workspace_invite",
		},
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %v", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	// Set headers - Use service role key for admin operations
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.ServiceRoleKey)
	req.Header.Set("Authorization", "Bearer "+s.ServiceRoleKey)

	// Make the request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}

	log.Printf("📧 Supabase invite response status: %d, body: %s", resp.StatusCode, string(body))

	// Parse response
	var result InviteUserResponse
	if err := json.Unmarshal(body, &result); err != nil {
		// Try to parse as error message
		var errorResp map[string]interface{}
		if jsonErr := json.Unmarshal(body, &errorResp); jsonErr == nil {
			if msg, ok := errorResp["msg"].(string); ok {
				return nil, fmt.Errorf("supabase error: %s", msg)
			}
			if errMsg, ok := errorResp["error"].(string); ok {
				return nil, fmt.Errorf("supabase error: %s", errMsg)
			}
			if errDesc, ok := errorResp["error_description"].(string); ok {
				return nil, fmt.Errorf("supabase error: %s", errDesc)
			}
		}
		return nil, fmt.Errorf("failed to parse response: %v", err)
	}

	// Check for errors
	if resp.StatusCode >= 400 {
		if result.Error != "" {
			return nil, fmt.Errorf("supabase error: %s", result.Error)
		}
		if result.Msg != "" {
			return nil, fmt.Errorf("supabase error: %s", result.Msg)
		}
		return nil, fmt.Errorf("supabase returned status %d", resp.StatusCode)
	}

	return &result, nil
}

// GenerateMagicLink generates a magic link for authentication
// This can be used as an alternative to the invite endpoint
func (s *SupabaseAuthService) GenerateMagicLink(email, redirectURL string) (*MagicLinkResponse, error) {
	if s.URL == "" || s.ServiceRoleKey == "" {
		return nil, fmt.Errorf("Supabase configuration is missing")
	}

	// Build the redirect URL if not provided
	if redirectURL == "" {
		redirectURL = s.SiteURL
	}

	// Supabase Auth Admin API endpoint for generating links
	url := fmt.Sprintf("%s/auth/v1/admin/generate_link", s.URL)

	// Request body
	requestBody := map[string]interface{}{
		"type":        "magiclink",
		"email":       email,
		"redirect_to": redirectURL,
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %v", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.ServiceRoleKey)
	req.Header.Set("Authorization", "Bearer "+s.ServiceRoleKey)

	// Make the request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}

	log.Printf("📧 Supabase magic link response status: %d, body: %s", resp.StatusCode, string(body))

	// Parse response
	var result MagicLinkResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %v", err)
	}

	// Check for errors
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase returned status %d: %s", resp.StatusCode, string(body))
	}

	return &result, nil
}

// MagicLinkResponse represents the response from generate_link endpoint
type MagicLinkResponse struct {
	ActionLink       string `json:"action_link"`
	EmailOtp         string `json:"email_otp"`
	HashedToken      string `json:"hashed_token"`
	VerificationType string `json:"verification_type"`
	RedirectTo       string `json:"redirect_to"`
}

// SendMagicLinkEmail sends a magic link email via Supabase Auth OTP endpoint
// This is a simpler approach that just sends the email
func (s *SupabaseAuthService) SendMagicLinkEmail(email, redirectURL string) error {
	if s.URL == "" {
		return fmt.Errorf("Supabase URL is not configured")
	}

	// Supabase Auth API endpoint for sending OTP/magic link
	url := fmt.Sprintf("%s/auth/v1/otp", s.URL)

	// Build the redirect URL if not provided
	if redirectURL == "" {
		redirectURL = s.SiteURL
	}

	// Request body
	requestBody := map[string]interface{}{
		"email":                email,
		"create_user":          true,
		"gotrue_meta_security": map[string]interface{}{},
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request body: %v", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}

	// Set headers - Use service role key for admin operations
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.ServiceRoleKey)
	req.Header.Set("Authorization", "Bearer "+s.ServiceRoleKey)

	// Make the request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %v", err)
	}

	log.Printf("📧 Supabase OTP response status: %d, body: %s", resp.StatusCode, string(body))

	// Check for errors
	if resp.StatusCode >= 400 {
		var errorResp map[string]interface{}
		if jsonErr := json.Unmarshal(body, &errorResp); jsonErr == nil {
			if msg, ok := errorResp["msg"].(string); ok {
				return fmt.Errorf("supabase error: %s", msg)
			}
			if errMsg, ok := errorResp["error"].(string); ok {
				return fmt.Errorf("supabase error: %s", errMsg)
			}
		}
		return fmt.Errorf("supabase returned status %d", resp.StatusCode)
	}

	return nil
}
