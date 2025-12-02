package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// GeminiClient handles communication with Google Gemini API
type GeminiClient struct {
	APIKey     string
	BaseURL    string
	HTTPClient *http.Client
}

// PIIDetectionRequest represents a request to detect PII in a document
type PIIDetectionRequest struct {
	DocumentURL   string            `json:"document_url"`
	DocumentType  string            `json:"document_type"` // "pdf", "image"
	KnownPII      map[string]string `json:"known_pii"`     // field_name -> value (e.g., "name" -> "John Smith")
	RedactAll     bool              `json:"redact_all"`    // If true, redact all detected PII, not just known
}

// PIILocation represents a detected PII location in the document
type PIILocation struct {
	Text       string  `json:"text"`        // The PII text found
	Type       string  `json:"type"`        // Type: "name", "email", "phone", "ssn", "address", "other"
	Page       int     `json:"page"`        // Page number (1-indexed)
	BoundingBox *BoundingBox `json:"bounding_box,omitempty"` // Location if available
	Confidence float64 `json:"confidence"`  // 0-1 confidence score
}

// BoundingBox represents the location of text in a document
type BoundingBox struct {
	X      float64 `json:"x"`      // Left position (0-1 normalized)
	Y      float64 `json:"y"`      // Top position (0-1 normalized)
	Width  float64 `json:"width"`  // Width (0-1 normalized)
	Height float64 `json:"height"` // Height (0-1 normalized)
}

// PIIDetectionResponse contains all detected PII locations
type PIIDetectionResponse struct {
	Locations    []PIILocation `json:"locations"`
	TotalFound   int           `json:"total_found"`
	ProcessingMS int64         `json:"processing_ms"`
	Error        string        `json:"error,omitempty"`
}

// GeminiRequest represents the request body for Gemini API
type GeminiRequest struct {
	Contents         []GeminiContent        `json:"contents"`
	GenerationConfig GeminiGenerationConfig `json:"generationConfig,omitempty"`
}

type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
}

type GeminiPart struct {
	Text       string          `json:"text,omitempty"`
	InlineData *GeminiInlineData `json:"inlineData,omitempty"`
}

type GeminiInlineData struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"` // base64 encoded
}

type GeminiGenerationConfig struct {
	Temperature     float64 `json:"temperature"`
	TopP            float64 `json:"topP"`
	TopK            int     `json:"topK"`
	MaxOutputTokens int     `json:"maxOutputTokens"`
}

// GeminiResponse represents the response from Gemini API
type GeminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// NewGeminiClient creates a new Gemini API client
func NewGeminiClient() *GeminiClient {
	apiKey := os.Getenv("GOOGLE_GEMINI_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("GOOGLE_API_KEY")
	}
	
	return &GeminiClient{
		APIKey:  apiKey,
		BaseURL: "https://generativelanguage.googleapis.com/v1beta",
		HTTPClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// DetectPII analyzes a document and returns PII locations
func (c *GeminiClient) DetectPII(ctx context.Context, req PIIDetectionRequest) (*PIIDetectionResponse, error) {
	startTime := time.Now()
	
	if c.APIKey == "" {
		return nil, fmt.Errorf("GOOGLE_GEMINI_API_KEY or GOOGLE_API_KEY environment variable not set")
	}

	// Download the document
	docData, mimeType, err := c.downloadDocument(req.DocumentURL)
	if err != nil {
		return nil, fmt.Errorf("failed to download document: %w", err)
	}

	// Build the prompt
	prompt := c.buildPIIDetectionPrompt(req.KnownPII, req.RedactAll)

	// Build the request
	geminiReq := GeminiRequest{
		Contents: []GeminiContent{
			{
				Parts: []GeminiPart{
					{
						InlineData: &GeminiInlineData{
							MimeType: mimeType,
							Data:     base64.StdEncoding.EncodeToString(docData),
						},
					},
					{
						Text: prompt,
					},
				},
			},
		},
		GenerationConfig: GeminiGenerationConfig{
			Temperature:     0.1, // Low temperature for consistent detection
			TopP:            0.8,
			TopK:            40,
			MaxOutputTokens: 4096,
		},
	}

	// Make the API request
	jsonData, err := json.Marshal(geminiReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Use gemini-1.5-flash for speed and cost efficiency
	url := fmt.Sprintf("%s/models/gemini-1.5-flash:generateContent?key=%s", c.BaseURL, c.APIKey)
	
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Gemini API error (status %d): %s", resp.StatusCode, string(body))
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if geminiResp.Error != nil {
		return nil, fmt.Errorf("Gemini API error: %s", geminiResp.Error.Message)
	}

	// Parse the response
	locations, err := c.parseGeminiResponse(geminiResp)
	if err != nil {
		return nil, fmt.Errorf("failed to parse PII locations: %w", err)
	}

	return &PIIDetectionResponse{
		Locations:    locations,
		TotalFound:   len(locations),
		ProcessingMS: time.Since(startTime).Milliseconds(),
	}, nil
}

// downloadDocument fetches the document from URL and returns its bytes and mime type
func (c *GeminiClient) downloadDocument(url string) ([]byte, string, error) {
	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("failed to download: status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}

	// Determine mime type
	mimeType := resp.Header.Get("Content-Type")
	if mimeType == "" {
		// Detect from content
		mimeType = http.DetectContentType(data)
	}
	
	// Clean up mime type (remove charset etc)
	if idx := strings.Index(mimeType, ";"); idx != -1 {
		mimeType = strings.TrimSpace(mimeType[:idx])
	}

	return data, mimeType, nil
}

// buildPIIDetectionPrompt creates the prompt for Gemini
func (c *GeminiClient) buildPIIDetectionPrompt(knownPII map[string]string, redactAll bool) string {
	var sb strings.Builder
	
	sb.WriteString(`You are a PII (Personally Identifiable Information) detection system. Analyze this document and identify ALL instances of PII that should be redacted for privacy.

`)

	if len(knownPII) > 0 {
		sb.WriteString("KNOWN PII TO FIND (these are confirmed PII values from the applicant's form):\n")
		for field, value := range knownPII {
			sb.WriteString(fmt.Sprintf("- %s: \"%s\"\n", field, value))
		}
		sb.WriteString("\nFind ALL occurrences of these values, including:\n")
		sb.WriteString("- Partial matches (e.g., first name only, last name only)\n")
		sb.WriteString("- Variations (e.g., nicknames, abbreviations, misspellings)\n")
		sb.WriteString("- Related info (e.g., family member names mentioned)\n\n")
	}

	if redactAll {
		sb.WriteString(`ALSO detect any other PII in the document:
- Names (any person's name)
- Email addresses
- Phone numbers
- Physical addresses
- Social Security Numbers (SSN)
- Dates of birth
- Student IDs
- Account numbers
- Any other identifying information

`)
	}

	sb.WriteString(`Respond with a JSON array of detected PII. Each item should have:
- "text": The exact text found
- "type": One of "name", "email", "phone", "ssn", "address", "dob", "id", "other"
- "confidence": A number 0-1 indicating confidence
- "context": Brief explanation of why this is PII

Example response:
[
  {"text": "John Smith", "type": "name", "confidence": 0.99, "context": "Applicant's full name"},
  {"text": "john.smith@email.com", "type": "email", "confidence": 1.0, "context": "Email address"},
  {"text": "123-45-6789", "type": "ssn", "confidence": 0.95, "context": "Social Security Number format"}
]

Respond ONLY with the JSON array, no other text.`)

	return sb.String()
}

// parseGeminiResponse extracts PII locations from Gemini's response
func (c *GeminiClient) parseGeminiResponse(resp GeminiResponse) ([]PIILocation, error) {
	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return []PIILocation{}, nil
	}

	text := resp.Candidates[0].Content.Parts[0].Text
	text = strings.TrimSpace(text)
	
	// Remove markdown code blocks if present
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)

	// Parse the JSON response
	var rawLocations []struct {
		Text       string  `json:"text"`
		Type       string  `json:"type"`
		Confidence float64 `json:"confidence"`
		Context    string  `json:"context"`
	}

	if err := json.Unmarshal([]byte(text), &rawLocations); err != nil {
		// Try to extract JSON if there's extra text
		startIdx := strings.Index(text, "[")
		endIdx := strings.LastIndex(text, "]")
		if startIdx != -1 && endIdx > startIdx {
			jsonStr := text[startIdx : endIdx+1]
			if err := json.Unmarshal([]byte(jsonStr), &rawLocations); err != nil {
				return nil, fmt.Errorf("failed to parse JSON: %w, text: %s", err, text)
			}
		} else {
			return nil, fmt.Errorf("no valid JSON array found in response: %s", text)
		}
	}

	locations := make([]PIILocation, len(rawLocations))
	for i, raw := range rawLocations {
		locations[i] = PIILocation{
			Text:       raw.Text,
			Type:       raw.Type,
			Confidence: raw.Confidence,
			Page:       1, // Default to page 1 for now
		}
	}

	return locations, nil
}
