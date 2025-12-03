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
	DocumentURL  string            `json:"document_url"`
	DocumentType string            `json:"document_type"` // "pdf", "image"
	KnownPII     map[string]string `json:"known_pii"`     // field_name -> value (e.g., "name" -> "John Smith")
	RedactAll    bool              `json:"redact_all"`    // If true, redact all detected PII, not just known
}

// PIILocation represents a detected PII location in the document
type PIILocation struct {
	Text        string       `json:"text"`                   // The PII text found
	Type        string       `json:"type"`                   // Type: "name", "email", "phone", "ssn", "address", "other"
	Page        int          `json:"page"`                   // Page number (1-indexed)
	BoundingBox *BoundingBox `json:"bounding_box,omitempty"` // Location if available
	Confidence  float64      `json:"confidence"`             // 0-1 confidence score
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
	Text       string            `json:"text,omitempty"`
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

	// Use gemini-2.0-flash for speed and cost efficiency (supports vision)
	url := fmt.Sprintf("%s/models/gemini-2.0-flash:generateContent?key=%s", c.BaseURL, c.APIKey)

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

	sb.WriteString(`You are a document OCR and PII detection system. Analyze this document image carefully and identify ALL text that contains personally identifiable information (PII) that should be redacted.

For each PII item found, you MUST provide accurate bounding box coordinates. Use a coordinate system where:
- The image is 1000 x 1000 units
- x=0 is the left edge, x=1000 is the right edge
- y=0 is the top edge, y=1000 is the bottom edge

`)

	if len(knownPII) > 0 {
		sb.WriteString("KNOWN PII VALUES TO FIND:\n")
		for field, value := range knownPII {
			sb.WriteString(fmt.Sprintf("- %s: \"%s\"\n", field, value))
		}
		sb.WriteString("\nSearch for ALL occurrences of these values anywhere in the document.\n\n")
	}

	if redactAll {
		sb.WriteString(`ALSO detect ALL other PII including:
- Full names and partial names
- Email addresses
- Phone numbers
- Street addresses, cities, zip codes
- Social Security Numbers
- Dates of birth
- ID numbers (student ID, account numbers, etc.)
- Signatures
- Any other identifying information

`)
	}

	sb.WriteString(`Return a JSON array. For EACH PII item, provide:
{
  "text": "the exact text found",
  "type": "name|email|phone|ssn|address|dob|id|signature|other",
  "confidence": 0.0-1.0,
  "box": [y_min, x_min, y_max, x_max]
}

The "box" array uses coordinates from 0-1000 where:
- y_min: top edge of the text
- x_min: left edge of the text  
- y_max: bottom edge of the text
- x_max: right edge of the text

Example:
[
  {"text": "John Smith", "type": "name", "confidence": 0.99, "box": [50, 100, 80, 250]},
  {"text": "john@email.com", "type": "email", "confidence": 1.0, "box": [100, 100, 130, 350]}
]

Be precise with bounding boxes - they should tightly wrap each PII text.
Return ONLY the JSON array, no other text.`)

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

	// Parse the JSON response - support both old and new format
	var rawLocations []struct {
		Text       string    `json:"text"`
		Type       string    `json:"type"`
		Confidence float64   `json:"confidence"`
		Box        []float64 `json:"box"` // New format: [y_min, x_min, y_max, x_max] in 0-1000 coords
		// Old format support
		BoundingBox *struct {
			X      float64 `json:"x"`
			Y      float64 `json:"y"`
			Width  float64 `json:"width"`
			Height float64 `json:"height"`
		} `json:"bounding_box"`
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
		loc := PIILocation{
			Text:       raw.Text,
			Type:       raw.Type,
			Confidence: raw.Confidence,
			Page:       1, // Default to page 1 for now
		}

		// Handle new box format: [y_min, x_min, y_max, x_max] in 0-1000 coords
		if len(raw.Box) == 4 {
			// Convert from 0-1000 to normalized 0-1
			yMin := raw.Box[0] / 1000.0
			xMin := raw.Box[1] / 1000.0
			yMax := raw.Box[2] / 1000.0
			xMax := raw.Box[3] / 1000.0

			loc.BoundingBox = &BoundingBox{
				X:      xMin,
				Y:      yMin,
				Width:  xMax - xMin,
				Height: yMax - yMin,
			}
		} else if raw.BoundingBox != nil {
			// Old format
			loc.BoundingBox = &BoundingBox{
				X:      raw.BoundingBox.X,
				Y:      raw.BoundingBox.Y,
				Width:  raw.BoundingBox.Width,
				Height: raw.BoundingBox.Height,
			}
		}
		locations[i] = loc
	}

	return locations, nil
}
