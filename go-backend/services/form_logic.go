package services

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/Jsanchez767/matic-platform/models"
)

// FormLogicService handles conditional logic evaluation
type FormLogicService struct{}

func NewFormLogicService() *FormLogicService {
	return &FormLogicService{}
}

// EvaluateConditions evaluates a set of conditions against form data
func (s *FormLogicService) EvaluateConditions(conditions []models.FieldCondition, logic string, data map[string]interface{}) bool {
	if len(conditions) == 0 {
		return true
	}

	results := make([]bool, len(conditions))
	for i, condition := range conditions {
		results[i] = s.EvaluateCondition(condition, data)
	}

	// Default to AND logic if not specified
	if logic == "" || logic == "and" {
		for _, result := range results {
			if !result {
				return false
			}
		}
		return true
	}

	// OR logic
	if logic == "or" {
		for _, result := range results {
			if result {
				return true
			}
		}
		return false
	}

	return false
}

// EvaluateCondition evaluates a single condition
func (s *FormLogicService) EvaluateCondition(condition models.FieldCondition, data map[string]interface{}) bool {
	fieldValue, exists := data[condition.FieldKey]

	switch condition.Operator {
	// Existence checks
	case models.OperatorIsNull, models.OperatorIsEmpty:
		return !exists || fieldValue == nil || fieldValue == ""
	case models.OperatorIsNotNull, models.OperatorIsNotEmpty:
		return exists && fieldValue != nil && fieldValue != ""

	// Comparison operators (require value to exist)
	case models.OperatorEquals:
		return exists && s.compareValues(fieldValue, condition.Value, "==")
	case models.OperatorNotEquals:
		return !exists || !s.compareValues(fieldValue, condition.Value, "==")
	case models.OperatorGreaterThan:
		return exists && s.compareValues(fieldValue, condition.Value, ">")
	case models.OperatorLessThan:
		return exists && s.compareValues(fieldValue, condition.Value, "<")
	case models.OperatorGreaterOrEqual:
		return exists && s.compareValues(fieldValue, condition.Value, ">=")
	case models.OperatorLessOrEqual:
		return exists && s.compareValues(fieldValue, condition.Value, "<=")

	// String operations
	case models.OperatorContains:
		return exists && s.stringContains(fieldValue, condition.Value)
	case models.OperatorNotContains:
		return !exists || !s.stringContains(fieldValue, condition.Value)
	case models.OperatorStartsWith:
		return exists && s.stringStartsWith(fieldValue, condition.Value)
	case models.OperatorEndsWith:
		return exists && s.stringEndsWith(fieldValue, condition.Value)
	case models.OperatorMatches:
		return exists && s.regexMatches(fieldValue, condition.Value)

	// Array operations
	case models.OperatorIncludes:
		return exists && s.arrayIncludes(fieldValue, condition.Value)
	case models.OperatorNotIncludes:
		return !exists || !s.arrayIncludes(fieldValue, condition.Value)
	case models.OperatorIncludesAny:
		return exists && s.arrayIncludesAny(fieldValue, condition.Value)
	case models.OperatorIncludesAll:
		return exists && s.arrayIncludesAll(fieldValue, condition.Value)

	default:
		return false
	}
}

// Helper functions for type-safe comparisons

func (s *FormLogicService) compareValues(a, b interface{}, op string) bool {
	// Try numeric comparison first
	aFloat, aOk := s.toFloat64(a)
	bFloat, bOk := s.toFloat64(b)

	if aOk && bOk {
		switch op {
		case "==":
			return aFloat == bFloat
		case ">":
			return aFloat > bFloat
		case "<":
			return aFloat < bFloat
		case ">=":
			return aFloat >= bFloat
		case "<=":
			return aFloat <= bFloat
		}
	}

	// Try date comparison
	aDate, aDateOk := s.toTime(a)
	bDate, bDateOk := s.toTime(b)

	if aDateOk && bDateOk {
		switch op {
		case "==":
			return aDate.Equal(bDate)
		case ">":
			return aDate.After(bDate)
		case "<":
			return aDate.Before(bDate)
		case ">=":
			return aDate.After(bDate) || aDate.Equal(bDate)
		case "<=":
			return aDate.Before(bDate) || aDate.Equal(bDate)
		}
	}

	// Fall back to string comparison
	aStr := fmt.Sprint(a)
	bStr := fmt.Sprint(b)

	if op == "==" {
		return strings.EqualFold(aStr, bStr)
	}

	return false
}

func (s *FormLogicService) stringContains(haystack, needle interface{}) bool {
	haystackStr := strings.ToLower(fmt.Sprint(haystack))
	needleStr := strings.ToLower(fmt.Sprint(needle))
	return strings.Contains(haystackStr, needleStr)
}

func (s *FormLogicService) stringStartsWith(str, prefix interface{}) bool {
	strVal := strings.ToLower(fmt.Sprint(str))
	prefixVal := strings.ToLower(fmt.Sprint(prefix))
	return strings.HasPrefix(strVal, prefixVal)
}

func (s *FormLogicService) stringEndsWith(str, suffix interface{}) bool {
	strVal := strings.ToLower(fmt.Sprint(str))
	suffixVal := strings.ToLower(fmt.Sprint(suffix))
	return strings.HasSuffix(strVal, suffixVal)
}

func (s *FormLogicService) regexMatches(str, pattern interface{}) bool {
	strVal := fmt.Sprint(str)
	patternVal := fmt.Sprint(pattern)

	matched, err := regexp.MatchString(patternVal, strVal)
	if err != nil {
		return false
	}
	return matched
}

func (s *FormLogicService) arrayIncludes(arr, value interface{}) bool {
	arrSlice, ok := s.toSlice(arr)
	if !ok {
		return false
	}

	valueStr := fmt.Sprint(value)
	for _, item := range arrSlice {
		if strings.EqualFold(fmt.Sprint(item), valueStr) {
			return true
		}
	}
	return false
}

func (s *FormLogicService) arrayIncludesAny(arr, values interface{}) bool {
	arrSlice, ok := s.toSlice(arr)
	if !ok {
		return false
	}

	valuesSlice, ok := s.toSlice(values)
	if !ok {
		return false
	}

	for _, item := range arrSlice {
		for _, value := range valuesSlice {
			if strings.EqualFold(fmt.Sprint(item), fmt.Sprint(value)) {
				return true
			}
		}
	}
	return false
}

func (s *FormLogicService) arrayIncludesAll(arr, values interface{}) bool {
	arrSlice, ok := s.toSlice(arr)
	if !ok {
		return false
	}

	valuesSlice, ok := s.toSlice(values)
	if !ok {
		return false
	}

	for _, value := range valuesSlice {
		found := false
		for _, item := range arrSlice {
			if strings.EqualFold(fmt.Sprint(item), fmt.Sprint(value)) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// Type conversion helpers

func (s *FormLogicService) toFloat64(val interface{}) (float64, bool) {
	switch v := val.(type) {
	case float64:
		return v, true
	case float32:
		return float64(v), true
	case int:
		return float64(v), true
	case int64:
		return float64(v), true
	case int32:
		return float64(v), true
	case string:
		var f float64
		_, err := fmt.Sscanf(v, "%f", &f)
		return f, err == nil
	}
	return 0, false
}

func (s *FormLogicService) toTime(val interface{}) (time.Time, bool) {
	switch v := val.(type) {
	case time.Time:
		return v, true
	case string:
		// Try common date formats
		formats := []string{
			time.RFC3339,
			"2006-01-02",
			"2006-01-02T15:04:05",
			"01/02/2006",
			"01-02-2006",
		}
		for _, format := range formats {
			if t, err := time.Parse(format, v); err == nil {
				return t, true
			}
		}
	}
	return time.Time{}, false
}

func (s *FormLogicService) toSlice(val interface{}) ([]interface{}, bool) {
	switch v := val.(type) {
	case []interface{}:
		return v, true
	case []string:
		result := make([]interface{}, len(v))
		for i, s := range v {
			result[i] = s
		}
		return result, true
	case string:
		// Try to split comma-separated values
		if strings.Contains(v, ",") {
			parts := strings.Split(v, ",")
			result := make([]interface{}, len(parts))
			for i, p := range parts {
				result[i] = strings.TrimSpace(p)
			}
			return result, true
		}
		// Single value becomes single-item array
		return []interface{}{v}, true
	}
	return nil, false
}

// GetVisibleFields returns field keys that should be visible based on conditions
func (s *FormLogicService) GetVisibleFields(fields []models.FormField, data map[string]interface{}) []string {
	visibleKeys := []string{}

	for _, field := range fields {
		// Parse conditions from JSONB
		var actions []models.ConditionalAction
		if field.Conditions != nil {
			// Unmarshal JSON to actions
			// In practice, you'd use json.Unmarshal here
		}

		visible := true
		for _, action := range actions {
			if action.Type == "show" || action.Type == "hide" {
				conditionMet := s.EvaluateConditions(action.Conditions, action.Logic, data)
				if action.Type == "hide" && conditionMet {
					visible = false
					break
				}
				if action.Type == "show" && !conditionMet {
					visible = false
					break
				}
			}
		}

		if visible {
			visibleKeys = append(visibleKeys, field.FieldKey)
		}
	}

	return visibleKeys
}

// GetNextSection returns the next section ID based on branching rules
func (s *FormLogicService) GetNextSection(currentSectionID string, branchingRules []models.BranchingRule, data map[string]interface{}) *string {
	// Sort rules by priority (lower number = higher priority)
	// Evaluate in order until a condition matches

	for _, rule := range branchingRules {
		if rule.FromSectionID == currentSectionID {
			if s.EvaluateConditions(rule.Conditions, "and", data) {
				return &rule.ToSectionID
			}
		}
	}

	return nil // No branching, proceed to next section in sequence
}
