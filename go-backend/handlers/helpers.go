package handlers

import (
	"encoding/json"
	"regexp"
	"strings"
	"unicode"

	"gorm.io/datatypes"
)

// mapToJSON converts a map to datatypes.JSON
// Used for all JSONB fields in the database
func mapToJSON(m map[string]interface{}) datatypes.JSON {
	if m == nil {
		return datatypes.JSON("{}")
	}
	jsonBytes, _ := json.Marshal(m)
	return datatypes.JSON(jsonBytes)
}

// interfaceToJSON converts any interface to datatypes.JSON
// Used for flexible JSON fields like actions arrays
func interfaceToJSON(v interface{}) datatypes.JSON {
	if v == nil {
		return datatypes.JSON("[]")
	}
	jsonBytes, _ := json.Marshal(v)
	return datatypes.JSON(jsonBytes)
}

// generateSlug creates a URL-friendly slug from a string
func generateSlug(name string) string {
	// Convert to lowercase
	slug := strings.ToLower(name)

	// Replace spaces and special characters with hyphens
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	slug = reg.ReplaceAllString(slug, "-")

	// Remove leading/trailing hyphens
	slug = strings.Trim(slug, "-")

	// If empty after processing, use a default
	if slug == "" {
		slug = "table"
	}

	return slug
}

// toSnakeCase converts a string to snake_case
// Used for generating field names from labels
func toSnakeCase(s string) string {
	if s == "" {
		return ""
	}

	var result strings.Builder
	for i, r := range s {
		if unicode.IsUpper(r) {
			if i > 0 {
				result.WriteRune('_')
			}
			result.WriteRune(unicode.ToLower(r))
		} else if unicode.IsLetter(r) || unicode.IsDigit(r) {
			result.WriteRune(unicode.ToLower(r))
		} else if unicode.IsSpace(r) || r == '-' {
			result.WriteRune('_')
		}
	}

	// Clean up multiple underscores
	snake := result.String()
	reg := regexp.MustCompile(`_+`)
	snake = reg.ReplaceAllString(snake, "_")
	snake = strings.Trim(snake, "_")

	if snake == "" {
		return "field"
	}

	return snake
}

// GetDefaultFieldTypeID returns the field_type_id for a given type string
// This maps legacy/shorthand types to the field_type_registry IDs
func GetDefaultFieldTypeID(fieldType string) string {
	// Most types map directly to their ID in field_type_registry
	// This function exists for any special mappings if needed
	typeMap := map[string]string{
		"text":        "text",
		"textarea":    "textarea",
		"number":      "number",
		"email":       "email",
		"phone":       "phone",
		"url":         "url",
		"date":        "date",
		"datetime":    "datetime",
		"time":        "time",
		"select":      "select",
		"multiselect": "multiselect",
		"checkbox":    "checkbox",
		"radio":       "radio",
		"file":        "file",
		"image":       "image",
		"address":     "address",
		"link":        "link",
		"lookup":      "lookup",
		"rollup":      "rollup",
		"formula":     "formula",
		"repeater":    "repeater",
		"group":       "group",
		"section":     "section",
		"heading":     "heading",
		"paragraph":   "paragraph",
		"callout":     "callout",
		"divider":     "divider",
		"signature":   "signature",
		"rating":      "rating",
		"rank":        "rank",
	}

	if id, ok := typeMap[fieldType]; ok {
		return id
	}
	return fieldType // Fallback to the type itself
}
