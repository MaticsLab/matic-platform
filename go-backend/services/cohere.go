package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// CohereClient handles communication with Cohere API
type CohereClient struct {
	APIKey     string
	BaseURL    string
	HTTPClient *http.Client
}

// CohereEmbedRequest represents the request body for Cohere embed API
type CohereEmbedRequest struct {
	Texts     []string `json:"texts"`
	Model     string   `json:"model"`
	InputType string   `json:"input_type"` // "search_document" or "search_query"
}

// CohereEmbedResponse represents the response from Cohere embed API
type CohereEmbedResponse struct {
	ID         string      `json:"id"`
	Texts      []string    `json:"texts"`
	Embeddings [][]float32 `json:"embeddings"`
	Meta       struct {
		APIVersion struct {
			Version string `json:"version"`
		} `json:"api_version"`
		BilledUnits struct {
			InputTokens int `json:"input_tokens"`
		} `json:"billed_units"`
	} `json:"meta"`
}

// CohereErrorResponse represents an error response from Cohere
type CohereErrorResponse struct {
	Message string `json:"message"`
}

// NewCohereClient creates a new Cohere API client
func NewCohereClient(apiKey string) *CohereClient {
	return &CohereClient{
		APIKey:  apiKey,
		BaseURL: "https://api.cohere.ai/v1",
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// EmbedDocuments generates embeddings for documents (for indexing)
func (c *CohereClient) EmbedDocuments(texts []string) ([][]float32, error) {
	return c.embed(texts, "search_document")
}

// EmbedQuery generates embedding for a search query
func (c *CohereClient) EmbedQuery(query string) ([]float32, error) {
	embeddings, err := c.embed([]string{query}, "search_query")
	if err != nil {
		return nil, err
	}
	if len(embeddings) == 0 {
		return nil, fmt.Errorf("no embedding returned")
	}
	return embeddings[0], nil
}

// embed is the internal method that calls Cohere API
func (c *CohereClient) embed(texts []string, inputType string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, fmt.Errorf("no texts provided")
	}

	// Cohere has a limit of 96 texts per request
	if len(texts) > 96 {
		return c.embedBatch(texts, inputType)
	}

	reqBody := CohereEmbedRequest{
		Texts:     texts,
		Model:     "embed-english-v3.0",
		InputType: inputType,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", c.BaseURL+"/embed", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp CohereErrorResponse
		json.Unmarshal(body, &errResp)
		return nil, fmt.Errorf("cohere API error (%d): %s", resp.StatusCode, errResp.Message)
	}

	var embedResp CohereEmbedResponse
	if err := json.Unmarshal(body, &embedResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return embedResp.Embeddings, nil
}

// embedBatch handles embedding more than 96 texts by splitting into batches
func (c *CohereClient) embedBatch(texts []string, inputType string) ([][]float32, error) {
	var allEmbeddings [][]float32
	batchSize := 96

	for i := 0; i < len(texts); i += batchSize {
		end := i + batchSize
		if end > len(texts) {
			end = len(texts)
		}

		batch := texts[i:end]
		embeddings, err := c.embed(batch, inputType)
		if err != nil {
			return nil, fmt.Errorf("failed to embed batch %d: %w", i/batchSize, err)
		}

		allEmbeddings = append(allEmbeddings, embeddings...)

		// Rate limiting - Cohere allows 100 requests/min on free tier
		if end < len(texts) {
			time.Sleep(100 * time.Millisecond)
		}
	}

	return allEmbeddings, nil
}

// CohereChatRequest for chat-based generation
type CohereChatRequest struct {
	Model       string        `json:"model"`
	Message     string        `json:"message"`
	Preamble    string        `json:"preamble,omitempty"`
	ChatHistory []ChatMessage `json:"chat_history,omitempty"`
	Temperature float64       `json:"temperature,omitempty"`
}

type ChatMessage struct {
	Role    string `json:"role"` // USER or CHATBOT
	Message string `json:"message"`
}

type CohereChatResponse struct {
	Text         string        `json:"text"`
	GenerationID string        `json:"generation_id"`
	ResponseID   string        `json:"response_id"`
	ChatHistory  []ChatMessage `json:"chat_history,omitempty"`
}

// TranslateJSON translates a map of strings using Cohere Chat API
func (c *CohereClient) TranslateJSON(content map[string]string, targetLanguage string) (map[string]string, error) {
	// Convert content to JSON string for the prompt
	jsonBytes, err := json.Marshal(content)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal content: %w", err)
	}

	prompt := fmt.Sprintf("You are a precise translator. Translate ONLY the JSON values into %s. Keep keys identical. Return valid JSON with the same keys. Do not include markdown formatting or code blocks.\nInput:\n%s", targetLanguage, string(jsonBytes))

	reqBody := CohereChatRequest{
		Message: prompt,
		Model:   "command-r", // Good balance of speed and quality
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", c.BaseURL+"/chat", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Client-Name", "matic-platform-backend")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("cohere API error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var result CohereChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Clean up response if it contains markdown code blocks
	cleanText := result.Text
	if len(cleanText) > 3 && cleanText[:3] == "```" {
		// Find start of JSON
		start := 0
		if idx := bytes.IndexByte([]byte(cleanText), '{'); idx != -1 {
			start = idx
		}
		// Find end of JSON
		end := len(cleanText)
		if idx := bytes.LastIndexByte([]byte(cleanText), '}'); idx != -1 {
			end = idx + 1
		}
		cleanText = cleanText[start:end]
	}

	var translatedContent map[string]string
	if err := json.Unmarshal([]byte(cleanText), &translatedContent); err != nil {
		return nil, fmt.Errorf("failed to parse translation response: %w. Response was: %s", err, result.Text)
	}

	return translatedContent, nil
}
