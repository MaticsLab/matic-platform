package handlers

import (
	"encoding/json"
	"regexp"
	"strings"

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
