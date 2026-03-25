package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
)

type FileDiscoveryResult struct {
	SourceType string      `json:"source_type"` // "table_file" or "raw_data"
	FileID     string      `json:"file_id,omitempty"`
	Filename   string      `json:"filename"`
	URL        string      `json:"url,omitempty"`
	FieldID    string      `json:"field_id,omitempty"`
	FieldLabel string      `json:"field_label,omitempty"`
	RowID      string      `json:"row_id,omitempty"`
	TableID    string      `json:"table_id,omitempty"`
	TableName  string      `json:"table_name,omitempty"`
	FormID     string      `json:"form_id,omitempty"`
	UploadedBy string      `json:"uploaded_by,omitempty"`
	CreatedAt  string      `json:"created_at,omitempty"`
	SyncStatus string      `json:"sync_status,omitempty"`
	SyncError  string      `json:"sync_error,omitempty"`
	Details    interface{} `json:"details,omitempty"`
}

// ListDiscoveredFilesForUser lists all files discovered for a specific user
func ListDiscoveredFilesForUser(c *gin.Context) {
	userEmail := c.Query("email")
	if userEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email query parameter required"})
		return
	}

	// Find the ba_users record for this email
	var user struct {
		ID    string
		Email string
	}
	if err := database.DB.Table("ba_users").Where("email = ?", userEmail).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("User not found: %s", userEmail)})
		return
	}

	results := []FileDiscoveryResult{}

	// 1. Get table_files uploaded by this user
	var tableFiles []struct {
		models.TableFile
		TableName string
		FieldName string
	}

	// Add error handling for empty result
	query := database.DB.
		Select("table_files.*, data_tables.name as table_name, table_fields.label as field_name").
		Joins("LEFT JOIN data_tables ON data_tables.id = table_files.table_id").
		Joins("LEFT JOIN table_fields ON table_fields.id = table_files.field_id").
		Where("table_files.uploaded_by = ?", user.ID)

	if err := query.Find(&tableFiles).Error; err != nil {
		log.Printf("Error querying table_files: %v", err)
	}

	for _, tf := range tableFiles {
		fieldID := ""
		if tf.FieldID != nil {
			fieldID = tf.FieldID.String()
		}
		rowID := ""
		if tf.RowID != nil {
			rowID = tf.RowID.String()
		}
		tableID := ""
		if tf.TableID != nil {
			tableID = tf.TableID.String()
		}

		results = append(results, FileDiscoveryResult{
			SourceType: "table_file",
			FileID:     tf.ID.String(),
			Filename:   tf.OriginalFilename,
			URL:        tf.PublicURL,
			FieldID:    fieldID,
			FieldLabel: tf.FieldName,
			RowID:      rowID,
			TableID:    tableID,
			TableName:  tf.TableName,
			UploadedBy: user.ID,
			CreatedAt:  tf.CreatedAt.String(),
		})
	}

	// 2. Get form submissions for this user and extract discovered files from raw_data
	var formSubmissions []models.FormSubmission
	if err := database.DB.Where("user_id = ?", user.ID).Limit(100).Find(&formSubmissions).Error; err != nil {
		log.Printf("Error querying form_submissions: %v", err)
	}

	// Build field label map for each form
	for _, submission := range formSubmissions {
		// Get the form to access field labels
		var form models.Form
		if err := database.DB.Preload("Fields").First(&form, "id = ?", submission.FormID).Error; err != nil {
			log.Printf("Error loading form %s: %v", submission.FormID, err)
			continue
		}

		// Build label map
		labelMap := make(map[string]string)
		for _, field := range form.Fields {
			labelMap[field.ID.String()] = field.Label
			if field.FieldKey != "" {
				labelMap[field.FieldKey] = field.Label
			}
		}

		// Extract documents from raw_data
		var rawDataMap map[string]interface{}
		if err := json.Unmarshal(submission.RawData, &rawDataMap); err != nil {
			log.Printf("Error unmarshaling raw_data for submission %s: %v", submission.ID, err)
			continue
		}

		discovered := []backfillDocumentCandidate{}
		collectRawDataDocumentCandidates(rawDataMap, "", &discovered)

		for _, candidate := range discovered {
			// Resolve field label from map
			fieldLabel := candidate.FieldLabel
			if label, exists := labelMap[candidate.Source]; exists {
				fieldLabel = label
			}

			filename := candidate.Filename
			if filename == "" {
				// Try to extract filename from URL
				parts := strings.Split(candidate.URL, "/")
				if len(parts) > 0 {
					filename = parts[len(parts)-1]
					if idx := strings.Index(filename, "?"); idx > 0 {
						filename = filename[:idx]
					}
				}
			}

			results = append(results, FileDiscoveryResult{
				SourceType: "raw_data",
				Filename:   filename,
				URL:        candidate.URL,
				FieldID:    candidate.Source, // Store source path as field ref
				FieldLabel: fieldLabel,
				FormID:     submission.FormID.String(),
				UploadedBy: submission.UserID,
				CreatedAt:  submission.CreatedAt.String(),
				Details: map[string]interface{}{
					"submission_id": submission.ID.String(),
					"source_path":   candidate.Source,
				},
			})
		}
	}

	// 3. Get sync status for discovered files
	var syncLogs []struct {
		FileID      string
		SyncStatus  string
		ErrorReason string
		SyncedAt    string
	}

	// Query file_sync_logs for any files we found
	if len(results) > 0 {
		fileIDs := []string{}
		for _, r := range results {
			if r.FileID != "" && r.SourceType == "table_file" {
				fileIDs = append(fileIDs, r.FileID)
			}
		}

		if len(fileIDs) > 0 {
			if err := database.DB.
				Table("file_sync_logs").
				Select("file_id, status as sync_status, error_reason, synced_at").
				Where("file_id = ANY(?)", pq.Array(fileIDs)).
				Order("synced_at DESC").
				Find(&syncLogs).Error; err != nil {
				log.Printf("Error querying file_sync_logs: %v", err)
			}

			// Map sync status back to results
			syncStatusMap := make(map[string]struct {
				Status string
				Error  string
			})
			for _, log := range syncLogs {
				syncStatusMap[log.FileID] = struct {
					Status string
					Error  string
				}{log.SyncStatus, log.ErrorReason}
			}

			for i, r := range results {
				if r.FileID != "" {
					if status, exists := syncStatusMap[r.FileID]; exists {
						results[i].SyncStatus = status.Status
						results[i].SyncError = status.Error
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"email":          userEmail,
		"user_id":        user.ID,
		"total_files":    len(results),
		"files":          results,
		"table_files":    countBySource(results, "table_file"),
		"raw_data_files": countBySource(results, "raw_data"),
		"synced_count":   countByStatus(results, "synced"),
		"failed_count":   countByStatus(results, "failed"),
		"pending_count":  countByStatus(results, "pending"),
	})
}

func countBySource(results []FileDiscoveryResult, sourceType string) int {
	count := 0
	for _, r := range results {
		if r.SourceType == sourceType {
			count++
		}
	}
	return count
}

func countByStatus(results []FileDiscoveryResult, status string) int {
	count := 0
	for _, r := range results {
		if r.SyncStatus == status {
			count++
		}
	}
	return count
}

// ListSubmissionDiscoveredFiles lists all discovered files for a specific submission
func ListSubmissionDiscoveredFiles(c *gin.Context) {
	submissionID := c.Param("submissionId")

	var submission models.FormSubmission
	if err := database.DB.First(&submission, "id = ?", submissionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Get the form to access field labels
	var form models.Form
	if err := database.DB.Preload("Fields").First(&form, "id = ?", submission.FormID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not load form"})
		return
	}

	// Build label map
	labelMap := make(map[string]string)
	for _, field := range form.Fields {
		labelMap[field.ID.String()] = field.Label
		if field.FieldKey != "" {
			labelMap[field.FieldKey] = field.Label
		}
	}

	// Extract documents from raw_data
	var rawDataMap map[string]interface{}
	if err := json.Unmarshal(submission.RawData, &rawDataMap); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not parse raw_data"})
		return
	}

	discovered := []backfillDocumentCandidate{}
	collectRawDataDocumentCandidates(rawDataMap, "", &discovered)

	results := []FileDiscoveryResult{}
	for _, candidate := range discovered {
		// Resolve field label from map
		fieldLabel := candidate.FieldLabel
		if label, exists := labelMap[candidate.Source]; exists {
			fieldLabel = label
		}

		filename := candidate.Filename
		if filename == "" {
			// Try to extract filename from URL
			parts := strings.Split(candidate.URL, "/")
			if len(parts) > 0 {
				filename = parts[len(parts)-1]
				if idx := strings.Index(filename, "?"); idx > 0 {
					filename = filename[:idx]
				}
			}
		}

		results = append(results, FileDiscoveryResult{
			SourceType: "raw_data",
			Filename:   filename,
			URL:        candidate.URL,
			FieldID:    candidate.Source,
			FieldLabel: fieldLabel,
			FormID:     submission.FormID.String(),
			UploadedBy: submission.UserID,
			CreatedAt:  submission.CreatedAt.String(),
			Details: map[string]interface{}{
				"submission_id": submission.ID.String(),
				"source_path":   candidate.Source,
			},
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"submission_id": submissionID,
		"form_id":       submission.FormID,
		"user_id":       submission.UserID,
		"total_files":   len(results),
		"files":         results,
	})
}
