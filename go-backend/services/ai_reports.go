package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// AIReportService handles AI-powered report generation
type AIReportService struct {
	CohereClient *CohereClient
}

// ReportRequest represents a natural language report request
type ReportRequest struct {
	Query       string `json:"query"`
	WorkspaceID string `json:"workspace_id"`
	Context     string `json:"context,omitempty"` // Additional context about available data
}

// ReportResponse represents the AI-generated report
type ReportResponse struct {
	Summary     string            `json:"summary"`
	Insights    []string          `json:"insights,omitempty"`
	DataPoints  []DataPoint       `json:"data_points,omitempty"`
	Suggestions []string          `json:"suggestions,omitempty"`
	QueryType   string            `json:"query_type"` // count, trend, breakdown, comparison, list
	Confidence  float64           `json:"confidence"`
	Actions     []SuggestedAction `json:"actions,omitempty"`
}

// DataPoint represents a single data point in the report
type DataPoint struct {
	Label    string      `json:"label"`
	Value    interface{} `json:"value"`
	Change   *float64    `json:"change,omitempty"`   // Percentage change if applicable
	Trend    string      `json:"trend,omitempty"`    // up, down, stable
	Subtitle string      `json:"subtitle,omitempty"` // Additional context
}

// SuggestedAction represents an action the user can take
type SuggestedAction struct {
	Label  string `json:"label"`
	Action string `json:"action"` // view, export, filter, create
	Target string `json:"target"` // URL or action identifier
	Icon   string `json:"icon,omitempty"`
}

// CohereGenerateRequest for text generation
type CohereGenerateRequest struct {
	Model             string   `json:"model"`
	Prompt            string   `json:"prompt"`
	MaxTokens         int      `json:"max_tokens"`
	Temperature       float64  `json:"temperature"`
	K                 int      `json:"k"`
	StopSequences     []string `json:"stop_sequences,omitempty"`
	ReturnLikelihoods string   `json:"return_likelihoods,omitempty"`
}

// CohereGenerateResponse from text generation
type CohereGenerateResponse struct {
	ID          string `json:"id"`
	Generations []struct {
		ID   string `json:"id"`
		Text string `json:"text"`
	} `json:"generations"`
	Meta struct {
		APIVersion struct {
			Version string `json:"version"`
		} `json:"api_version"`
	} `json:"meta"`
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

// NewAIReportService creates a new AI report service
func NewAIReportService(cohereClient *CohereClient) *AIReportService {
	return &AIReportService{
		CohereClient: cohereClient,
	}
}

// ClassifyReportIntent determines what type of report the user wants
func (s *AIReportService) ClassifyReportIntent(query string) string {
	lowerQuery := strings.ToLower(query)

	// Count queries
	if containsAny(lowerQuery, []string{"how many", "count", "total", "number of"}) {
		return "count"
	}

	// Trend queries
	if containsAny(lowerQuery, []string{"trend", "over time", "growth", "change", "compared to", "vs", "versus"}) {
		return "trend"
	}

	// Breakdown queries
	if containsAny(lowerQuery, []string{"breakdown", "by", "per", "group", "each", "distribution"}) {
		return "breakdown"
	}

	// List queries
	if containsAny(lowerQuery, []string{"list", "show", "all", "who", "which"}) {
		return "list"
	}

	// Summary queries
	if containsAny(lowerQuery, []string{"summary", "overview", "report", "status", "insights"}) {
		return "summary"
	}

	return "general"
}

// GenerateReport creates an AI-powered report based on natural language query
func (s *AIReportService) GenerateReport(req ReportRequest, dataContext map[string]interface{}) (*ReportResponse, error) {
	queryType := s.ClassifyReportIntent(req.Query)

	// Build context for the AI
	contextJSON, _ := json.Marshal(dataContext)

	preamble := `You are a helpful data analyst assistant for a workspace management platform. 
You help users understand their data by generating clear, actionable insights.

When given a query and data context, you should:
1. Analyze the data to answer the user's question
2. Provide a clear summary in 1-2 sentences
3. List 2-3 key insights or observations
4. Suggest relevant follow-up actions

Respond in JSON format with this structure:
{
  "summary": "A clear 1-2 sentence answer to the user's question",
  "insights": ["insight 1", "insight 2"],
  "data_points": [{"label": "metric name", "value": 123, "trend": "up"}],
  "suggestions": ["Try filtering by...", "Consider exporting..."]
}

Available data in the workspace:
` + string(contextJSON)

	message := fmt.Sprintf("User query: %s\n\nPlease analyze and respond with a JSON report.", req.Query)

	chatReq := CohereChatRequest{
		Model:       "command",
		Message:     message,
		Preamble:    preamble,
		Temperature: 0.3,
	}

	jsonBody, err := json.Marshal(chatReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", s.CohereClient.BaseURL+"/chat", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+s.CohereClient.APIKey)

	resp, err := s.CohereClient.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("cohere API error (%d): %s", resp.StatusCode, string(body))
	}

	var chatResp CohereChatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	// Parse the AI response into our report structure
	report := s.parseReportResponse(chatResp.Text, queryType, req)

	return report, nil
}

// parseReportResponse extracts structured data from AI response
func (s *AIReportService) parseReportResponse(text string, queryType string, req ReportRequest) *ReportResponse {
	report := &ReportResponse{
		QueryType:  queryType,
		Confidence: 0.8,
		Actions:    []SuggestedAction{},
	}

	// Try to parse JSON from the response
	// Find JSON in the response (it might be wrapped in markdown code blocks)
	jsonStr := extractJSON(text)
	if jsonStr != "" {
		var parsed map[string]interface{}
		if err := json.Unmarshal([]byte(jsonStr), &parsed); err == nil {
			if summary, ok := parsed["summary"].(string); ok {
				report.Summary = summary
			}
			if insights, ok := parsed["insights"].([]interface{}); ok {
				for _, i := range insights {
					if str, ok := i.(string); ok {
						report.Insights = append(report.Insights, str)
					}
				}
			}
			if dataPoints, ok := parsed["data_points"].([]interface{}); ok {
				for _, dp := range dataPoints {
					if dpMap, ok := dp.(map[string]interface{}); ok {
						point := DataPoint{
							Label: getString(dpMap, "label"),
							Value: dpMap["value"],
							Trend: getString(dpMap, "trend"),
						}
						report.DataPoints = append(report.DataPoints, point)
					}
				}
			}
			if suggestions, ok := parsed["suggestions"].([]interface{}); ok {
				for _, s := range suggestions {
					if str, ok := s.(string); ok {
						report.Suggestions = append(report.Suggestions, str)
					}
				}
			}
		}
	}

	// Fallback if no JSON parsed
	if report.Summary == "" {
		report.Summary = text
		if len(report.Summary) > 500 {
			report.Summary = report.Summary[:500] + "..."
		}
	}

	// Add default actions based on query type
	report.Actions = s.getSuggestedActions(queryType, req.WorkspaceID)

	return report
}

// getSuggestedActions returns relevant actions based on report type
func (s *AIReportService) getSuggestedActions(queryType string, workspaceID string) []SuggestedAction {
	actions := []SuggestedAction{}

	switch queryType {
	case "count":
		actions = append(actions, SuggestedAction{
			Label:  "View All",
			Action: "navigate",
			Target: fmt.Sprintf("/workspace/%s/tables", workspaceID),
			Icon:   "list",
		})
		actions = append(actions, SuggestedAction{
			Label:  "Export Data",
			Action: "export",
			Target: "csv",
			Icon:   "download",
		})
	case "trend":
		actions = append(actions, SuggestedAction{
			Label:  "View Chart",
			Action: "chart",
			Target: "trend_chart",
			Icon:   "chart",
		})
	case "list":
		actions = append(actions, SuggestedAction{
			Label:  "Open Table",
			Action: "navigate",
			Target: fmt.Sprintf("/workspace/%s/tables", workspaceID),
			Icon:   "table",
		})
		actions = append(actions, SuggestedAction{
			Label:  "Filter Results",
			Action: "filter",
			Target: "advanced_filter",
			Icon:   "filter",
		})
	default:
		actions = append(actions, SuggestedAction{
			Label:  "View Details",
			Action: "navigate",
			Target: fmt.Sprintf("/workspace/%s", workspaceID),
			Icon:   "eye",
		})
	}

	return actions
}

// QuickStats generates quick statistics for a workspace
func (s *AIReportService) QuickStats(stats map[string]int) *ReportResponse {
	report := &ReportResponse{
		QueryType:  "summary",
		Confidence: 1.0,
		DataPoints: []DataPoint{},
	}

	for label, value := range stats {
		report.DataPoints = append(report.DataPoints, DataPoint{
			Label: label,
			Value: value,
		})
	}

	return report
}

// Helper functions
func containsAny(s string, substrings []string) bool {
	for _, sub := range substrings {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

func extractJSON(text string) string {
	// Try to find JSON block in markdown code blocks
	if start := strings.Index(text, "```json"); start != -1 {
		start += 7
		if end := strings.Index(text[start:], "```"); end != -1 {
			return strings.TrimSpace(text[start : start+end])
		}
	}

	// Try to find raw JSON
	if start := strings.Index(text, "{"); start != -1 {
		braceCount := 0
		for i := start; i < len(text); i++ {
			if text[i] == '{' {
				braceCount++
			} else if text[i] == '}' {
				braceCount--
				if braceCount == 0 {
					return text[start : i+1]
				}
			}
		}
	}

	return ""
}

func getString(m map[string]interface{}, key string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return ""
}

// Global AI report service instance
var AIReports *AIReportService

// InitAIReports initializes the AI report service
func InitAIReports(cohereAPIKey string) {
	if cohereAPIKey != "" {
		cohereClient := NewCohereClient(cohereAPIKey)
		AIReports = NewAIReportService(cohereClient)
		fmt.Printf("[AIReports] Service initialized with Cohere\n")
	} else {
		fmt.Printf("[AIReports] Warning: No Cohere API key, AI reports disabled\n")
	}
}

// IsReportQuery checks if a query looks like a report request
func IsReportQuery(query string) bool {
	lowerQuery := strings.ToLower(query)
	reportPatterns := []string{
		"how many",
		"total",
		"count",
		"report",
		"summary",
		"statistics",
		"stats",
		"breakdown",
		"trend",
		"growth",
		"insights",
		"analysis",
		"analyze",
		"compare",
		"show me",
		"what is",
		"what are",
		"who has",
		"who are",
		"list all",
		"give me",
	}

	for _, pattern := range reportPatterns {
		if strings.Contains(lowerQuery, pattern) {
			return true
		}
	}

	return false
}

// Generate a mock report when Cohere is not available
func (s *AIReportService) GenerateMockReport(req ReportRequest, stats map[string]int) *ReportResponse {
	queryType := s.ClassifyReportIntent(req.Query)

	report := &ReportResponse{
		QueryType:   queryType,
		Confidence:  0.9,
		Summary:     fmt.Sprintf("Based on your workspace data, here's what I found for: \"%s\"", req.Query),
		Insights:    []string{},
		DataPoints:  []DataPoint{},
		Suggestions: []string{"Try being more specific in your query", "Use filters to narrow down results"},
	}

	// Add stats as data points
	for label, value := range stats {
		report.DataPoints = append(report.DataPoints, DataPoint{
			Label: label,
			Value: value,
		})
	}

	// Add contextual insights
	if stats["tables"] > 0 {
		report.Insights = append(report.Insights, fmt.Sprintf("You have %d tables in this workspace", stats["tables"]))
	}
	if stats["forms"] > 0 {
		report.Insights = append(report.Insights, fmt.Sprintf("%d forms are actively collecting data", stats["forms"]))
	}
	if stats["rows"] > 0 {
		report.Insights = append(report.Insights, fmt.Sprintf("Total of %d records across all tables", stats["rows"]))
	}
	if stats["submissions"] > 0 {
		report.Insights = append(report.Insights, fmt.Sprintf("%d form submissions received", stats["submissions"]))
	}

	report.Actions = s.getSuggestedActions(queryType, req.WorkspaceID)

	return report
}
