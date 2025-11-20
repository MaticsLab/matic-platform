package handlers

import (
	"encoding/json"

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
