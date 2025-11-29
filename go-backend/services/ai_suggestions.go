package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// AISuggestionService analyzes table data and generates AI suggestions
type AISuggestionService struct{}

// NewAISuggestionService creates a new AI suggestion service
func NewAISuggestionService() *AISuggestionService {
	return &AISuggestionService{}
}

// ============================================================
// FIELD PATTERN DETECTION
// ============================================================

// PatternDetector holds regex patterns for field type detection
type PatternDetector struct {
	EmailPattern    *regexp.Regexp
	PhonePattern    *regexp.Regexp
	URLPattern      *regexp.Regexp
	DatePattern     *regexp.Regexp
	SSNPattern      *regexp.Regexp
	ZipCodePattern  *regexp.Regexp
	CurrencyPattern *regexp.Regexp
}

// NewPatternDetector creates a pattern detector with common patterns
func NewPatternDetector() *PatternDetector {
	return &PatternDetector{
		EmailPattern:    regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`),
		PhonePattern:    regexp.MustCompile(`^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$`),
		URLPattern:      regexp.MustCompile(`^(https?://)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$`),
		DatePattern:     regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$|^\d{2}/\d{2}/\d{4}$|^\d{2}-\d{2}-\d{4}$`),
		SSNPattern:      regexp.MustCompile(`^\d{3}-\d{2}-\d{4}$`),
		ZipCodePattern:  regexp.MustCompile(`^\d{5}(-\d{4})?$`),
		CurrencyPattern: regexp.MustCompile(`^\$?[\d,]+(\.\d{2})?$`),
	}
}

// ============================================================
// ANALYZE TABLE FOR SUGGESTIONS
// ============================================================

// AnalyzeTableInput represents input for table analysis
type AnalyzeTableInput struct {
	TableID     uuid.UUID
	WorkspaceID uuid.UUID
	MaxRows     int // Limit rows to analyze (default 100)
}

// AnalyzeTableResult represents the result of table analysis
type AnalyzeTableResult struct {
	TableID          uuid.UUID                  `json:"table_id"`
	SuggestionsCount int                        `json:"suggestions_count"`
	Suggestions      []models.AIFieldSuggestion `json:"suggestions"`
	FieldAnalysis    map[string]FieldAnalysis   `json:"field_analysis"`
}

// FieldAnalysis represents analysis of a single field
type FieldAnalysis struct {
	FieldName       string        `json:"field_name"`
	FieldType       string        `json:"field_type"`
	TotalValues     int           `json:"total_values"`
	UniqueValues    int           `json:"unique_values"`
	NullCount       int           `json:"null_count"`
	DetectedPattern string        `json:"detected_pattern,omitempty"`
	PatternMatches  int           `json:"pattern_matches"`
	SampleValues    []interface{} `json:"sample_values"`
	Suggestions     []string      `json:"suggestions"`
}

// AnalyzeTable analyzes a table's data and generates AI suggestions
func (s *AISuggestionService) AnalyzeTable(input AnalyzeTableInput) (*AnalyzeTableResult, error) {
	maxRows := input.MaxRows
	if maxRows <= 0 {
		maxRows = 100
	}

	// Get table fields
	var fields []models.Field
	if err := database.DB.Where("table_id = ?", input.TableID).Find(&fields).Error; err != nil {
		return nil, fmt.Errorf("failed to load fields: %w", err)
	}

	// Get sample rows
	var rows []models.Row
	if err := database.DB.Where("table_id = ?", input.TableID).Limit(maxRows).Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("failed to load rows: %w", err)
	}

	detector := NewPatternDetector()
	result := &AnalyzeTableResult{
		TableID:       input.TableID,
		Suggestions:   []models.AIFieldSuggestion{},
		FieldAnalysis: make(map[string]FieldAnalysis),
	}

	// Analyze each field
	for _, field := range fields {
		analysis := s.analyzeField(field, rows, detector)
		result.FieldAnalysis[field.Name] = analysis

		// Generate suggestions based on analysis
		suggestions := s.generateSuggestionsForField(input.WorkspaceID, input.TableID, field, analysis)
		result.Suggestions = append(result.Suggestions, suggestions...)
	}

	// Check for potential duplicate fields
	duplicateSuggestions := s.detectDuplicateFields(input.WorkspaceID, input.TableID, fields, rows)
	result.Suggestions = append(result.Suggestions, duplicateSuggestions...)

	result.SuggestionsCount = len(result.Suggestions)

	// Save suggestions to database
	for _, suggestion := range result.Suggestions {
		database.DB.Create(&suggestion)
	}

	return result, nil
}

// analyzeField analyzes a single field's values
func (s *AISuggestionService) analyzeField(field models.Field, rows []models.Row, detector *PatternDetector) FieldAnalysis {
	analysis := FieldAnalysis{
		FieldName:    field.Name,
		FieldType:    field.Type,
		SampleValues: []interface{}{},
		Suggestions:  []string{},
	}

	valueMap := make(map[string]int)
	patternCounts := make(map[string]int)

	for _, row := range rows {
		var data map[string]interface{}
		json.Unmarshal(row.Data, &data)

		value, exists := data[field.Name]
		if !exists || value == nil {
			analysis.NullCount++
			continue
		}

		analysis.TotalValues++

		// Track unique values
		valueStr := fmt.Sprintf("%v", value)
		valueMap[valueStr]++

		// Collect sample values (max 5)
		if len(analysis.SampleValues) < 5 {
			analysis.SampleValues = append(analysis.SampleValues, value)
		}

		// Detect patterns for string values
		if str, ok := value.(string); ok {
			if detector.EmailPattern.MatchString(str) {
				patternCounts["email"]++
			} else if detector.PhonePattern.MatchString(str) {
				patternCounts["phone"]++
			} else if detector.URLPattern.MatchString(str) {
				patternCounts["url"]++
			} else if detector.DatePattern.MatchString(str) {
				patternCounts["date"]++
			} else if detector.SSNPattern.MatchString(str) {
				patternCounts["ssn"]++
			} else if detector.ZipCodePattern.MatchString(str) {
				patternCounts["zipcode"]++
			}
		}
	}

	analysis.UniqueValues = len(valueMap)

	// Find dominant pattern
	maxCount := 0
	for pattern, count := range patternCounts {
		if count > maxCount && float64(count)/float64(analysis.TotalValues) >= 0.8 {
			analysis.DetectedPattern = pattern
			analysis.PatternMatches = count
			maxCount = count
		}
	}

	return analysis
}

// generateSuggestionsForField generates suggestions for a field based on analysis
func (s *AISuggestionService) generateSuggestionsForField(
	workspaceID, tableID uuid.UUID,
	field models.Field,
	analysis FieldAnalysis,
) []models.AIFieldSuggestion {
	var suggestions []models.AIFieldSuggestion

	// Suggest semantic type based on detected pattern
	if analysis.DetectedPattern != "" && analysis.DetectedPattern != field.SemanticType {
		confidence := float64(analysis.PatternMatches) / float64(analysis.TotalValues)
		if confidence >= 0.8 {
			sampleData, _ := json.Marshal(analysis.SampleValues)
			suggestedValue, _ := json.Marshal(map[string]string{"semantic_type": analysis.DetectedPattern})

			suggestions = append(suggestions, models.AIFieldSuggestion{
				ID:             uuid.New(),
				WorkspaceID:    workspaceID,
				TableID:        tableID,
				FieldID:        &field.ID,
				SuggestionType: models.SuggestionTypeSemanticTypeChange,
				CurrentValue:   datatypes.JSON([]byte(fmt.Sprintf(`{"semantic_type": "%s"}`, field.SemanticType))),
				SuggestedValue: datatypes.JSON(suggestedValue),
				Confidence:     confidence,
				Reasoning:      fmt.Sprintf("%.0f%% of values match %s pattern", confidence*100, analysis.DetectedPattern),
				SampleData:     datatypes.JSON(sampleData),
				PatternMatches: &analysis.PatternMatches,
				TotalValues:    &analysis.TotalValues,
				Status:         models.SuggestionStatusPending,
			})
		}
	}

	// Suggest field type change if pattern suggests different type
	if analysis.DetectedPattern != "" {
		suggestedType := mapPatternToFieldType(analysis.DetectedPattern)
		if suggestedType != "" && suggestedType != field.Type {
			confidence := float64(analysis.PatternMatches) / float64(analysis.TotalValues)
			if confidence >= 0.9 {
				suggestedValue, _ := json.Marshal(map[string]string{"type": suggestedType})

				suggestions = append(suggestions, models.AIFieldSuggestion{
					ID:             uuid.New(),
					WorkspaceID:    workspaceID,
					TableID:        tableID,
					FieldID:        &field.ID,
					SuggestionType: "field_type_change",
					CurrentValue:   datatypes.JSON([]byte(fmt.Sprintf(`{"type": "%s"}`, field.Type))),
					SuggestedValue: datatypes.JSON(suggestedValue),
					Confidence:     confidence,
					Reasoning:      fmt.Sprintf("%.0f%% of values match %s format, consider changing field type", confidence*100, suggestedType),
					Status:         models.SuggestionStatusPending,
				})
			}
		}
	}

	// Suggest validation rule if high pattern match
	if analysis.DetectedPattern != "" && analysis.PatternMatches == analysis.TotalValues {
		validationRule := getValidationForPattern(analysis.DetectedPattern)
		if validationRule != "" {
			suggestedValue, _ := json.Marshal(map[string]interface{}{
				"validation": map[string]string{"pattern": validationRule},
			})

			suggestions = append(suggestions, models.AIFieldSuggestion{
				ID:             uuid.New(),
				WorkspaceID:    workspaceID,
				TableID:        tableID,
				FieldID:        &field.ID,
				SuggestionType: models.SuggestionTypeValidationRule,
				SuggestedValue: datatypes.JSON(suggestedValue),
				Confidence:     1.0,
				Reasoning:      fmt.Sprintf("All %d values match %s pattern", analysis.TotalValues, analysis.DetectedPattern),
				Status:         models.SuggestionStatusPending,
			})
		}
	}

	return suggestions
}

// detectDuplicateFields finds potential duplicate or similar fields
func (s *AISuggestionService) detectDuplicateFields(
	workspaceID, tableID uuid.UUID,
	fields []models.Field,
	rows []models.Row,
) []models.AIFieldSuggestion {
	var suggestions []models.AIFieldSuggestion

	// Compare field names for similarity
	for i := 0; i < len(fields); i++ {
		for j := i + 1; j < len(fields); j++ {
			// Check for similar names
			if areSimilarNames(fields[i].Name, fields[j].Name) {
				// Check if values are similar
				similarity := s.calculateValueSimilarity(fields[i].Name, fields[j].Name, rows)
				if similarity >= 0.9 {
					suggestedValue, _ := json.Marshal(map[string]interface{}{
						"merge_into": fields[i].Name,
						"remove":     fields[j].Name,
					})

					suggestions = append(suggestions, models.AIFieldSuggestion{
						ID:             uuid.New(),
						WorkspaceID:    workspaceID,
						TableID:        tableID,
						FieldID:        &fields[i].ID,
						SuggestionType: "merge_fields",
						SuggestedValue: datatypes.JSON(suggestedValue),
						Confidence:     similarity,
						Reasoning:      fmt.Sprintf("Fields '%s' and '%s' have %.0f%% similar values", fields[i].Name, fields[j].Name, similarity*100),
						Status:         models.SuggestionStatusPending,
					})
				}
			}
		}
	}

	return suggestions
}

// calculateValueSimilarity calculates how similar two fields' values are
func (s *AISuggestionService) calculateValueSimilarity(field1, field2 string, rows []models.Row) float64 {
	matches := 0
	total := 0

	for _, row := range rows {
		var data map[string]interface{}
		json.Unmarshal(row.Data, &data)

		val1, exists1 := data[field1]
		val2, exists2 := data[field2]

		if exists1 && exists2 && val1 != nil && val2 != nil {
			total++
			if fmt.Sprintf("%v", val1) == fmt.Sprintf("%v", val2) {
				matches++
			}
		}
	}

	if total == 0 {
		return 0
	}
	return float64(matches) / float64(total)
}

// ============================================================
// ANALYZE ROW FOR TYPOS/CORRECTIONS
// ============================================================

// AnalyzeRowInput represents input for row analysis
type AnalyzeRowInput struct {
	RowID       uuid.UUID
	TableID     uuid.UUID
	WorkspaceID uuid.UUID
}

// AnalyzeRow analyzes a single row for potential corrections
func (s *AISuggestionService) AnalyzeRow(input AnalyzeRowInput) ([]models.AIFieldSuggestion, error) {
	var suggestions []models.AIFieldSuggestion

	// Get the row
	var row models.Row
	if err := database.DB.First(&row, input.RowID).Error; err != nil {
		return nil, fmt.Errorf("row not found: %w", err)
	}

	// Get table fields
	var fields []models.Field
	if err := database.DB.Where("table_id = ?", input.TableID).Find(&fields).Error; err != nil {
		return nil, fmt.Errorf("failed to load fields: %w", err)
	}

	// Get sample of other rows for comparison
	var otherRows []models.Row
	database.DB.Where("table_id = ? AND id != ?", input.TableID, input.RowID).Limit(100).Find(&otherRows)

	var rowData map[string]interface{}
	json.Unmarshal(row.Data, &rowData)

	detector := NewPatternDetector()

	for _, field := range fields {
		value, exists := rowData[field.Name]
		if !exists || value == nil {
			continue
		}

		// Check for format issues
		if str, ok := value.(string); ok {
			// Check if value doesn't match expected pattern for the field type
			if field.SemanticType == "email" && !detector.EmailPattern.MatchString(str) {
				suggestions = append(suggestions, models.AIFieldSuggestion{
					ID:             uuid.New(),
					WorkspaceID:    input.WorkspaceID,
					TableID:        input.TableID,
					RowID:          &input.RowID,
					FieldID:        &field.ID,
					SuggestionType: models.SuggestionTypeFormatCorrection,
					CurrentValue:   datatypes.JSON([]byte(fmt.Sprintf(`"%s"`, str))),
					SuggestedValue: datatypes.JSON([]byte(`"Please check email format"`)),
					Confidence:     0.8,
					Reasoning:      "Value doesn't match expected email format",
					Status:         models.SuggestionStatusPending,
				})
			}

			// Check for potential typos using common value frequency
			typoSuggestion := s.detectTypo(field, str, otherRows)
			if typoSuggestion != nil {
				typoSuggestion.WorkspaceID = input.WorkspaceID
				typoSuggestion.TableID = input.TableID
				typoSuggestion.RowID = &input.RowID
				typoSuggestion.FieldID = &field.ID
				suggestions = append(suggestions, *typoSuggestion)
			}
		}
	}

	return suggestions, nil
}

// detectTypo checks if a value might be a typo of a more common value
func (s *AISuggestionService) detectTypo(field models.Field, value string, otherRows []models.Row) *models.AIFieldSuggestion {
	// Count value frequencies
	valueCounts := make(map[string]int)
	for _, row := range otherRows {
		var data map[string]interface{}
		json.Unmarshal(row.Data, &data)

		if v, exists := data[field.Name]; exists {
			if str, ok := v.(string); ok {
				valueCounts[str]++
			}
		}
	}

	// Check if current value is rare and similar to a common value
	for commonValue, count := range valueCounts {
		if count >= 5 && isTypoOf(value, commonValue) {
			suggestedValue, _ := json.Marshal(commonValue)
			return &models.AIFieldSuggestion{
				ID:             uuid.New(),
				SuggestionType: models.SuggestionTypeTypoCorrection,
				CurrentValue:   datatypes.JSON([]byte(fmt.Sprintf(`"%s"`, value))),
				SuggestedValue: datatypes.JSON(suggestedValue),
				Confidence:     0.7,
				Reasoning:      fmt.Sprintf("'%s' appears %d times, this might be a typo", commonValue, count),
				Status:         models.SuggestionStatusPending,
			}
		}
	}

	return nil
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// mapPatternToFieldType maps a detected pattern to a field type
func mapPatternToFieldType(pattern string) string {
	switch pattern {
	case "email":
		return "email"
	case "phone":
		return "phone"
	case "url":
		return "url"
	case "date":
		return "date"
	default:
		return ""
	}
}

// getValidationForPattern returns a validation regex for a pattern
func getValidationForPattern(pattern string) string {
	switch pattern {
	case "email":
		return `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
	case "phone":
		return `^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$`
	case "url":
		return `^(https?://)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$`
	case "zipcode":
		return `^\d{5}(-\d{4})?$`
	default:
		return ""
	}
}

// areSimilarNames checks if two field names are similar
func areSimilarNames(name1, name2 string) bool {
	n1 := strings.ToLower(strings.ReplaceAll(name1, "_", ""))
	n2 := strings.ToLower(strings.ReplaceAll(name2, "_", ""))

	// Check for common variations
	if n1 == n2 {
		return true
	}

	// Check for prefix/suffix matches
	if strings.HasPrefix(n1, n2) || strings.HasPrefix(n2, n1) {
		return true
	}

	// Check Levenshtein distance (simplified)
	if len(n1) > 3 && len(n2) > 3 {
		// If they share 70% of characters in same positions
		matches := 0
		minLen := len(n1)
		if len(n2) < minLen {
			minLen = len(n2)
		}
		for i := 0; i < minLen; i++ {
			if n1[i] == n2[i] {
				matches++
			}
		}
		return float64(matches)/float64(minLen) >= 0.7
	}

	return false
}

// isTypoOf checks if value might be a typo of target (simple Levenshtein check)
func isTypoOf(value, target string) bool {
	if value == target {
		return false
	}

	v := strings.ToLower(value)
	t := strings.ToLower(target)

	// Must be similar length
	lenDiff := len(v) - len(t)
	if lenDiff < -2 || lenDiff > 2 {
		return false
	}

	// Count matching characters
	matches := 0
	minLen := len(v)
	if len(t) < minLen {
		minLen = len(t)
	}

	for i := 0; i < minLen; i++ {
		if v[i] == t[i] {
			matches++
		}
	}

	// At least 80% match
	return float64(matches)/float64(len(t)) >= 0.8
}

// ============================================================
// SCHEDULED ANALYSIS
// ============================================================

// AnalyzeWorkspace analyzes all tables in a workspace
func (s *AISuggestionService) AnalyzeWorkspace(workspaceID uuid.UUID) error {
	var tables []models.Table
	if err := database.DB.Where("workspace_id = ?", workspaceID).Find(&tables).Error; err != nil {
		return err
	}

	for _, table := range tables {
		_, err := s.AnalyzeTable(AnalyzeTableInput{
			TableID:     table.ID,
			WorkspaceID: workspaceID,
			MaxRows:     100,
		})
		if err != nil {
			// Log but continue with other tables
			fmt.Printf("Failed to analyze table %s: %v\n", table.Name, err)
		}

		// Rate limit
		time.Sleep(100 * time.Millisecond)
	}

	return nil
}
