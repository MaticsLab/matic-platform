package handlers

import (
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/gin-gonic/gin"
)

// RemoveStudentInformationField removes the student_information key from all table_rows
// POST /api/v1/admin/cleanup/remove-student-information
func RemoveStudentInformationField(c *gin.Context) {
	// Execute the cleanup query
	result := database.DB.Exec(`
		UPDATE table_rows
		SET data = data - 'student_information'
		WHERE data ? 'student_information'
	`)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to remove student_information field",
			"details": result.Error.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"rows_affected": result.RowsAffected,
		"message":       "Successfully removed student_information field from all records",
	})
}

// CleanupEmptyFields removes all empty/null fields from table_rows data
// POST /api/v1/admin/cleanup/remove-empty-fields
func CleanupEmptyFields(c *gin.Context) {
	var req struct {
		FieldNames []string `json:"field_names"` // Optional: specific fields to remove
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		// If no body, just remove student_information
		req.FieldNames = []string{"student_information"}
	}

	if len(req.FieldNames) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No field names provided",
		})
		return
	}

	totalAffected := int64(0)
	for _, fieldName := range req.FieldNames {
		result := database.DB.Exec(`
			UPDATE table_rows
			SET data = data - ?
			WHERE data ? ?
		`, fieldName, fieldName)

		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to remove fields",
				"details": result.Error.Error(),
				"field":   fieldName,
			})
			return
		}

		totalAffected += result.RowsAffected
	}

	c.JSON(http.StatusOK, gin.H{
		"success":        true,
		"rows_affected":  totalAffected,
		"fields_removed": req.FieldNames,
		"message":        "Successfully removed specified fields from all records",
	})
}
