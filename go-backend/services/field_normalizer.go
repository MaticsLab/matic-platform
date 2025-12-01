package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/google/uuid"
)

// FieldNormalizer handles data normalization based on field type registry
type FieldNormalizer struct {
	registry map[string]models.FieldTypeRegistry
}

// NewFieldNormalizer creates a new field normalizer with cached registry
func NewFieldNormalizer() *FieldNormalizer {
	normalizer := &FieldNormalizer{
		registry: make(map[string]models.FieldTypeRegistry),
	}
	normalizer.loadRegistry()
	return normalizer
}

// loadRegistry loads the field type registry from database
func (n *FieldNormalizer) loadRegistry() {
	var types []models.FieldTypeRegistry
	database.DB.Find(&types)

	for _, t := range types {
		n.registry[t.ID] = t
	}
}

// RefreshRegistry reloads the registry from database
func (n *FieldNormalizer) RefreshRegistry() {
	n.loadRegistry()
}

// ============================================================
// NORMALIZE DATA FOR STORAGE
// ============================================================

// NormalizeInput represents input for data normalization
type NormalizeInput struct {
	TableID uuid.UUID
	Data    map[string]interface{}
}

// NormalizeResult represents the result of normalization
type NormalizeResult struct {
	Data     map[string]interface{}
	Errors   []NormalizationError
	Warnings []NormalizationWarning
	AIHints  []AIFieldHint
}

// NormalizationError represents a validation error
type NormalizationError struct {
	FieldName string      `json:"field_name"`
	FieldType string      `json:"field_type"`
	Message   string      `json:"message"`
	Value     interface{} `json:"value,omitempty"`
}

// NormalizationWarning represents a non-blocking warning
type NormalizationWarning struct {
	FieldName string `json:"field_name"`
	Message   string `json:"message"`
}

// AIFieldHint represents a suggestion for AI processing
type AIFieldHint struct {
	FieldName      string      `json:"field_name"`
	SuggestionType string      `json:"suggestion_type"`
	CurrentValue   interface{} `json:"current_value"`
	SuggestedValue interface{} `json:"suggested_value,omitempty"`
	Confidence     float64     `json:"confidence"`
	Reasoning      string      `json:"reasoning"`
}

// NormalizeForStorage normalizes form/portal data for storage in table_rows.data
func (n *FieldNormalizer) NormalizeForStorage(input NormalizeInput) (*NormalizeResult, error) {
	result := &NormalizeResult{
		Data:     make(map[string]interface{}),
		Errors:   []NormalizationError{},
		Warnings: []NormalizationWarning{},
		AIHints:  []AIFieldHint{},
	}

	// Get field definitions for the table
	var fields []models.Field
	if err := database.DB.Where("table_id = ?", input.TableID).Find(&fields).Error; err != nil {
		return nil, fmt.Errorf("failed to load fields: %w", err)
	}

	// Build field map for quick lookup
	fieldMap := make(map[string]models.Field)
	for _, f := range fields {
		fieldMap[f.Name] = f
	}

	// Normalize each field in the input data
	for key, value := range input.Data {
		field, exists := fieldMap[key]
		if !exists {
			// Unknown field - store as-is but add warning
			result.Data[key] = value
			result.Warnings = append(result.Warnings, NormalizationWarning{
				FieldName: key,
				Message:   "Field not defined in table schema",
			})
			continue
		}

		// Get field type from registry
		fieldTypeID := field.Type
		if field.FieldTypeID != "" {
			fieldTypeID = field.FieldTypeID
		}

		fieldType, hasType := n.registry[fieldTypeID]
		if !hasType {
			// Unknown type - store as-is
			result.Data[key] = value
			continue
		}

		// Parse field config
		var config map[string]interface{}
		json.Unmarshal(field.Config, &config)

		// Normalize based on field type
		normalized, err := n.normalizeValue(value, fieldType, config)
		if err != nil {
			result.Errors = append(result.Errors, NormalizationError{
				FieldName: key,
				FieldType: fieldTypeID,
				Message:   err.Error(),
				Value:     value,
			})
			continue
		}

		result.Data[key] = normalized

		// Check for AI suggestions
		if hint := n.checkForAIHint(key, value, normalized, fieldType); hint != nil {
			result.AIHints = append(result.AIHints, *hint)
		}
	}

	return result, nil
}

// normalizeValue normalizes a single value based on field type
func (n *FieldNormalizer) normalizeValue(value interface{}, fieldType models.FieldTypeRegistry, config map[string]interface{}) (interface{}, error) {
	// Skip nil values
	if value == nil {
		return nil, nil
	}

	switch fieldType.ID {
	case "text", "textarea":
		return n.normalizeText(value)

	case "email":
		return n.normalizeEmail(value)

	case "phone":
		return n.normalizePhone(value)

	case "url":
		return n.normalizeURL(value)

	case "number", "rating":
		return n.normalizeNumber(value)

	case "date":
		return n.normalizeDate(value)

	case "datetime":
		return n.normalizeDatetime(value)

	case "select", "radio":
		return n.normalizeSelect(value, config)

	case "multiselect":
		return n.normalizeMultiselect(value, config)

	case "checkbox":
		return n.normalizeCheckbox(value)

	case "repeater":
		return n.normalizeRepeater(value, config)

	case "group":
		return n.normalizeGroup(value, config)

	case "file", "image":
		return n.normalizeFile(value)

	case "divider", "heading", "paragraph", "section", "callout":
		// Layout fields don't store data
		return nil, nil

	default:
		// Unknown type - return as-is
		return value, nil
	}
}

// ============================================================
// TYPE-SPECIFIC NORMALIZERS
// ============================================================

func (n *FieldNormalizer) normalizeText(value interface{}) (interface{}, error) {
	str, ok := value.(string)
	if !ok {
		// Try to convert to string
		str = fmt.Sprintf("%v", value)
	}
	return strings.TrimSpace(str), nil
}

func (n *FieldNormalizer) normalizeEmail(value interface{}) (interface{}, error) {
	str, ok := value.(string)
	if !ok {
		return nil, fmt.Errorf("email must be a string")
	}

	str = strings.TrimSpace(strings.ToLower(str))

	// Basic email validation
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if str != "" && !emailRegex.MatchString(str) {
		return str, fmt.Errorf("invalid email format")
	}

	return str, nil
}

func (n *FieldNormalizer) normalizePhone(value interface{}) (interface{}, error) {
	str, ok := value.(string)
	if !ok {
		str = fmt.Sprintf("%v", value)
	}

	// Remove all non-numeric characters except + at the start
	str = strings.TrimSpace(str)
	if str == "" {
		return "", nil
	}

	// Keep only digits and leading +
	hasPlus := strings.HasPrefix(str, "+")
	cleaned := regexp.MustCompile(`[^\d]`).ReplaceAllString(str, "")
	if hasPlus {
		cleaned = "+" + cleaned
	}

	return cleaned, nil
}

func (n *FieldNormalizer) normalizeURL(value interface{}) (interface{}, error) {
	str, ok := value.(string)
	if !ok {
		return nil, fmt.Errorf("URL must be a string")
	}

	str = strings.TrimSpace(str)
	if str == "" {
		return "", nil
	}

	// Add https:// if no protocol specified
	if !strings.HasPrefix(str, "http://") && !strings.HasPrefix(str, "https://") {
		str = "https://" + str
	}

	return str, nil
}

func (n *FieldNormalizer) normalizeNumber(value interface{}) (interface{}, error) {
	switch v := value.(type) {
	case float64:
		return v, nil
	case int:
		return float64(v), nil
	case int64:
		return float64(v), nil
	case string:
		// Try to parse string as number
		if v == "" {
			return nil, nil
		}
		var num float64
		if _, err := fmt.Sscanf(v, "%f", &num); err != nil {
			return nil, fmt.Errorf("invalid number format")
		}
		return num, nil
	default:
		return nil, fmt.Errorf("cannot convert to number")
	}
}

func (n *FieldNormalizer) normalizeDate(value interface{}) (interface{}, error) {
	str, ok := value.(string)
	if !ok {
		return nil, fmt.Errorf("date must be a string in YYYY-MM-DD format")
	}

	str = strings.TrimSpace(str)
	if str == "" {
		return "", nil
	}

	// Validate YYYY-MM-DD format
	dateRegex := regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	if !dateRegex.MatchString(str) {
		// Try to parse and reformat common formats
		// For now, just return with warning
		return str, nil
	}

	return str, nil
}

func (n *FieldNormalizer) normalizeDatetime(value interface{}) (interface{}, error) {
	str, ok := value.(string)
	if !ok {
		return nil, fmt.Errorf("datetime must be a string in ISO format")
	}

	return strings.TrimSpace(str), nil
}

func (n *FieldNormalizer) normalizeSelect(value interface{}, config map[string]interface{}) (interface{}, error) {
	str, ok := value.(string)
	if !ok {
		return nil, fmt.Errorf("select value must be a string")
	}

	return strings.TrimSpace(str), nil
}

func (n *FieldNormalizer) normalizeMultiselect(value interface{}, config map[string]interface{}) (interface{}, error) {
	switch v := value.(type) {
	case []interface{}:
		result := make([]string, 0, len(v))
		for _, item := range v {
			if str, ok := item.(string); ok {
				result = append(result, strings.TrimSpace(str))
			}
		}
		return result, nil
	case []string:
		result := make([]string, len(v))
		for i, s := range v {
			result[i] = strings.TrimSpace(s)
		}
		return result, nil
	default:
		return nil, fmt.Errorf("multiselect value must be an array")
	}
}

func (n *FieldNormalizer) normalizeCheckbox(value interface{}) (interface{}, error) {
	switch v := value.(type) {
	case bool:
		return v, nil
	case string:
		lower := strings.ToLower(strings.TrimSpace(v))
		return lower == "true" || lower == "yes" || lower == "1", nil
	case float64:
		return v != 0, nil
	case int:
		return v != 0, nil
	default:
		return false, nil
	}
}

func (n *FieldNormalizer) normalizeRepeater(value interface{}, config map[string]interface{}) (interface{}, error) {
	arr, ok := value.([]interface{})
	if !ok {
		return nil, fmt.Errorf("repeater value must be an array")
	}

	// Get children field definitions from config
	children, _ := config["children"].([]interface{})
	childFields := make(map[string]map[string]interface{})
	for _, child := range children {
		if childMap, ok := child.(map[string]interface{}); ok {
			if name, ok := childMap["name"].(string); ok {
				childFields[name] = childMap
			}
		}
	}

	// Normalize each item
	result := make([]map[string]interface{}, 0, len(arr))
	for _, item := range arr {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		normalizedItem := make(map[string]interface{})
		for key, val := range itemMap {
			// Get child field type
			if childDef, exists := childFields[key]; exists {
				childType, _ := childDef["type"].(string)
				if childType != "" {
					if fieldType, hasType := n.registry[childType]; hasType {
						normalized, _ := n.normalizeValue(val, fieldType, childDef)
						normalizedItem[key] = normalized
						continue
					}
				}
			}
			// Default: store as-is
			normalizedItem[key] = val
		}

		result = append(result, normalizedItem)
	}

	return result, nil
}

func (n *FieldNormalizer) normalizeGroup(value interface{}, config map[string]interface{}) (interface{}, error) {
	obj, ok := value.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("group value must be an object")
	}

	// Get children field definitions from config
	children, _ := config["children"].([]interface{})
	childFields := make(map[string]map[string]interface{})
	for _, child := range children {
		if childMap, ok := child.(map[string]interface{}); ok {
			if name, ok := childMap["name"].(string); ok {
				childFields[name] = childMap
			}
		}
	}

	// Normalize each field in the group
	result := make(map[string]interface{})
	for key, val := range obj {
		if childDef, exists := childFields[key]; exists {
			childType, _ := childDef["type"].(string)
			if childType != "" {
				if fieldType, hasType := n.registry[childType]; hasType {
					normalized, _ := n.normalizeValue(val, fieldType, childDef)
					result[key] = normalized
					continue
				}
			}
		}
		// Default: store as-is
		result[key] = val
	}

	return result, nil
}

func (n *FieldNormalizer) normalizeFile(value interface{}) (interface{}, error) {
	// File should be an object with url, name, size, etc.
	obj, ok := value.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("file value must be an object with url, name, size")
	}

	// Ensure required fields
	result := make(map[string]interface{})
	if url, ok := obj["url"].(string); ok {
		result["url"] = url
	}
	if name, ok := obj["name"].(string); ok {
		result["name"] = name
	}
	if size, ok := obj["size"].(float64); ok {
		result["size"] = size
	}
	if mimeType, ok := obj["mime_type"].(string); ok {
		result["mime_type"] = mimeType
	}

	return result, nil
}

// ============================================================
// AI HINT DETECTION
// ============================================================

func (n *FieldNormalizer) checkForAIHint(fieldName string, original, normalized interface{}, fieldType models.FieldTypeRegistry) *AIFieldHint {
	// Check for potential typo corrections
	origStr, origIsStr := original.(string)
	normStr, normIsStr := normalized.(string)

	if origIsStr && normIsStr && origStr != normStr {
		// Data was modified during normalization
		return &AIFieldHint{
			FieldName:      fieldName,
			SuggestionType: "format_correction",
			CurrentValue:   original,
			SuggestedValue: normalized,
			Confidence:     0.95,
			Reasoning:      "Value was automatically formatted",
		}
	}

	// Check for common patterns that might indicate issues
	if origIsStr && fieldType.ID == "email" {
		// Check for potential typos in email domains
		if hint := n.checkEmailTypos(origStr); hint != nil {
			hint.FieldName = fieldName
			return hint
		}
	}

	return nil
}

func (n *FieldNormalizer) checkEmailTypos(email string) *AIFieldHint {
	// Common email domain typos
	typoMap := map[string]string{
		"gmial.com":   "gmail.com",
		"gmal.com":    "gmail.com",
		"gamil.com":   "gmail.com",
		"gnail.com":   "gmail.com",
		"yahooo.com":  "yahoo.com",
		"yaho.com":    "yahoo.com",
		"hotmal.com":  "hotmail.com",
		"hotmial.com": "hotmail.com",
		"outlok.com":  "outlook.com",
		"outloo.com":  "outlook.com",
	}

	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return nil
	}

	domain := strings.ToLower(parts[1])
	if correction, exists := typoMap[domain]; exists {
		return &AIFieldHint{
			SuggestionType: "typo_correction",
			CurrentValue:   email,
			SuggestedValue: parts[0] + "@" + correction,
			Confidence:     0.9,
			Reasoning:      fmt.Sprintf("Domain '%s' appears to be a typo for '%s'", domain, correction),
		}
	}

	return nil
}

// ============================================================
// EMBEDDING TEXT GENERATION
// ============================================================

// IndexedFieldInfo represents info about a field that was indexed
type IndexedFieldInfo struct {
	FieldID         string  `json:"field_id"`
	FieldName       string  `json:"field_name"`
	FieldLabel      string  `json:"field_label,omitempty"`
	SemanticType    string  `json:"semantic_type,omitempty"`
	ContributedText string  `json:"contributed_text"`
	Weight          float64 `json:"weight"`
}

// FieldEmbeddingInput represents field-specific text for embeddings
type FieldEmbeddingInput struct {
	FullText       string             `json:"full_text"`
	BySemanticType map[string]string  `json:"by_semantic_type"` // semantic_type -> text
	IndexedFields  []IndexedFieldInfo `json:"indexed_fields"`
}

// GenerateFieldAwareEmbeddingInput creates structured input for field-aware embeddings
func (n *FieldNormalizer) GenerateFieldAwareEmbeddingInput(tableID uuid.UUID, data map[string]interface{}) *FieldEmbeddingInput {
	result := &FieldEmbeddingInput{
		BySemanticType: make(map[string]string),
		IndexedFields:  []IndexedFieldInfo{},
	}

	var fullTextParts []string

	// Get field definitions
	var fields []models.Field
	database.DB.Where("table_id = ?", tableID).Order("position ASC").Find(&fields)

	for _, field := range fields {
		value, exists := data[field.Name]
		if !exists || value == nil {
			continue
		}

		// Get field type from registry
		fieldTypeID := field.Type
		if field.FieldTypeID != "" {
			fieldTypeID = field.FieldTypeID
		}

		fieldType, hasType := n.registry[fieldTypeID]
		if !hasType {
			continue
		}

		// Parse AI schema
		var aiSchema map[string]interface{}
		json.Unmarshal(fieldType.AISchema, &aiSchema)

		strategy, _ := aiSchema["embedding_strategy"].(string)
		privacyLevel, _ := aiSchema["privacy_level"].(string)
		searchWeight := 1.0
		if w, ok := aiSchema["search_weight"].(float64); ok {
			searchWeight = w
		}

		// Skip PII and fields marked to skip
		if strategy == "skip" || privacyLevel == "pii" {
			continue
		}

		// Generate text based on strategy
		var text string
		switch strategy {
		case "value_only":
			text = n.valueToString(value)
		case "with_label":
			text = fmt.Sprintf("%s: %s", field.Label, n.valueToString(value))
		case "summarize_count":
			if arr, ok := value.([]interface{}); ok {
				template, _ := aiSchema["summarization_template"].(string)
				if template == "" {
					template = "{count} items"
				}
				text = strings.Replace(template, "{count}", fmt.Sprintf("%d", len(arr)), 1)
				text = fmt.Sprintf("%s: %s", field.Label, text)
			}
		case "children_only":
			if obj, ok := value.(map[string]interface{}); ok {
				var childParts []string
				for k, v := range obj {
					childParts = append(childParts, fmt.Sprintf("%s: %s", k, n.valueToString(v)))
				}
				text = strings.Join(childParts, ". ")
			}
		case "filename_only":
			if obj, ok := value.(map[string]interface{}); ok {
				if name, ok := obj["name"].(string); ok {
					text = fmt.Sprintf("File: %s", name)
				}
			}
		default:
			text = n.valueToString(value)
		}

		if text == "" {
			continue
		}

		// Add to full text
		fullTextParts = append(fullTextParts, text)

		// Track indexed field info
		result.IndexedFields = append(result.IndexedFields, IndexedFieldInfo{
			FieldID:         field.ID.String(),
			FieldName:       field.Name,
			FieldLabel:      field.Label,
			SemanticType:    field.SemanticType,
			ContributedText: text,
			Weight:          searchWeight,
		})

		// Group by semantic type for field-specific embeddings
		semanticType := field.SemanticType
		if semanticType == "" {
			semanticType = fieldType.DefaultSemanticType
		}
		if semanticType != "" {
			if existing, ok := result.BySemanticType[semanticType]; ok {
				result.BySemanticType[semanticType] = existing + ". " + text
			} else {
				result.BySemanticType[semanticType] = text
			}
		}
	}

	result.FullText = strings.Join(fullTextParts, ". ")
	return result
}

// GenerateEmbeddingText creates text for AI embeddings based on field types
func (n *FieldNormalizer) GenerateEmbeddingText(tableID uuid.UUID, data map[string]interface{}) string {
	var textParts []string

	// Get field definitions
	var fields []models.Field
	database.DB.Where("table_id = ?", tableID).Order("position ASC").Find(&fields)

	for _, field := range fields {
		value, exists := data[field.Name]
		if !exists || value == nil {
			continue
		}

		// Get field type from registry
		fieldTypeID := field.Type
		if field.FieldTypeID != "" {
			fieldTypeID = field.FieldTypeID
		}

		fieldType, hasType := n.registry[fieldTypeID]
		if !hasType {
			continue
		}

		// Parse AI schema
		var aiSchema map[string]interface{}
		json.Unmarshal(fieldType.AISchema, &aiSchema)

		strategy, _ := aiSchema["embedding_strategy"].(string)
		privacyLevel, _ := aiSchema["privacy_level"].(string)

		// Skip PII and fields marked to skip
		if strategy == "skip" || privacyLevel == "pii" {
			continue
		}

		// Generate text based on strategy
		var text string
		switch strategy {
		case "value_only":
			text = n.valueToString(value)
		case "with_label":
			text = fmt.Sprintf("%s: %s", field.Label, n.valueToString(value))
		case "summarize_count":
			if arr, ok := value.([]interface{}); ok {
				template, _ := aiSchema["summarization_template"].(string)
				if template == "" {
					template = "{count} items"
				}
				text = strings.Replace(template, "{count}", fmt.Sprintf("%d", len(arr)), 1)
				text = fmt.Sprintf("%s: %s", field.Label, text)
			}
		case "children_only":
			// For groups, recurse into children
			if obj, ok := value.(map[string]interface{}); ok {
				for k, v := range obj {
					textParts = append(textParts, fmt.Sprintf("%s: %s", k, n.valueToString(v)))
				}
				continue
			}
		case "filename_only":
			if obj, ok := value.(map[string]interface{}); ok {
				if name, ok := obj["name"].(string); ok {
					text = fmt.Sprintf("File: %s", name)
				}
			}
		default:
			text = n.valueToString(value)
		}

		if text != "" {
			textParts = append(textParts, text)
		}
	}

	return strings.Join(textParts, ". ")
}

func (n *FieldNormalizer) valueToString(value interface{}) string {
	switch v := value.(type) {
	case string:
		return v
	case []interface{}:
		strs := make([]string, 0, len(v))
		for _, item := range v {
			strs = append(strs, n.valueToString(item))
		}
		return strings.Join(strs, ", ")
	case map[string]interface{}:
		// For objects, join key-value pairs
		parts := make([]string, 0)
		for k, val := range v {
			parts = append(parts, fmt.Sprintf("%s: %s", k, n.valueToString(val)))
		}
		return strings.Join(parts, ", ")
	default:
		return fmt.Sprintf("%v", v)
	}
}
