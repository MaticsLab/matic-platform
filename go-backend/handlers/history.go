package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/Jsanchez767/matic-platform/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Global version service
var VersionService = services.NewVersionService()

// ============================================================
// ROW HISTORY HANDLERS
// ============================================================

// GetRowHistory returns version history for a row
func GetRowHistory(c *gin.Context) {
	tableID := c.Param("id")
	rowID := c.Param("row_id")

	rowUUID, err := uuid.Parse(rowID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid row ID"})
		return
	}

	// Parse options
	redactPII := c.Query("redact_pii") == "true"
	includeArchived := c.Query("include_archived") == "true"
	limit := 50
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		limit = l
	}

	// Get history
	history, err := VersionService.GetRowHistory(services.GetRowHistoryInput{
		RowID:           rowUUID,
		RedactPII:       redactPII,
		IncludeArchived: includeArchived,
		Limit:           limit,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get total count
	var total int64
	database.DB.Model(&models.RowVersion{}).Where("row_id = ?", rowUUID).Count(&total)

	c.JSON(http.StatusOK, gin.H{
		"row_id":         rowID,
		"table_id":       tableID,
		"total_versions": total,
		"versions":       history,
	})
}

// GetRowVersion returns a specific version snapshot
func GetRowVersion(c *gin.Context) {
	rowID := c.Param("row_id")
	versionStr := c.Param("version")

	rowUUID, err := uuid.Parse(rowID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid row ID"})
		return
	}

	versionNumber, err := strconv.Atoi(versionStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version number"})
		return
	}

	var version models.RowVersion
	if err := database.DB.Where("row_id = ? AND version_number = ?", rowUUID, versionNumber).First(&version).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Version not found"})
		return
	}

	// Get field changes for this version
	var changes []models.FieldChange
	database.DB.Where("row_version_id = ?", version.ID).Find(&changes)

	c.JSON(http.StatusOK, gin.H{
		"version":       version,
		"field_changes": changes,
	})
}

// CompareVersions returns diff between two versions
func CompareVersions(c *gin.Context) {
	rowID := c.Param("row_id")
	v1Str := c.Param("v1")
	v2Str := c.Param("v2")

	rowUUID, err := uuid.Parse(rowID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid row ID"})
		return
	}

	v1, _ := strconv.Atoi(v1Str)
	v2, _ := strconv.Atoi(v2Str)

	// Get both versions
	var version1, version2 models.RowVersion
	if err := database.DB.Where("row_id = ? AND version_number = ?", rowUUID, v1).First(&version1).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Version 1 not found"})
		return
	}
	if err := database.DB.Where("row_id = ? AND version_number = ?", rowUUID, v2).First(&version2).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Version 2 not found"})
		return
	}

	// Get field changes between versions (from v2)
	var changes []models.FieldChange
	database.DB.Where("row_version_id = ?", version2.ID).Find(&changes)

	c.JSON(http.StatusOK, gin.H{
		"version1":    v1,
		"version2":    v2,
		"field_diffs": changes,
	})
}

// RestoreVersion restores a row to a previous version
func RestoreVersion(c *gin.Context) {
	rowID := c.Param("row_id")
	versionStr := c.Param("version")

	rowUUID, err := uuid.Parse(rowID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid row ID"})
		return
	}

	versionNumber, err := strconv.Atoi(versionStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version number"})
		return
	}

	var input struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Reason is required"})
		return
	}

	// Get user ID
	userIDStr, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := uuid.Parse(userIDStr)

	// Restore version
	result, err := VersionService.RestoreVersion(rowUUID, versionNumber, input.Reason, &userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":            true,
		"new_version_id":     result.VersionID,
		"new_version_number": result.VersionNumber,
	})
}

// ArchiveVersion archives a version (30-day retention)
func ArchiveVersion(c *gin.Context) {
	versionIDStr := c.Param("version_id")

	versionID, err := uuid.Parse(versionIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version ID"})
		return
	}

	// Get user ID
	userIDStr, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := uuid.Parse(userIDStr)

	if err := VersionService.ArchiveVersion(versionID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// DeleteVersion permanently deletes a version (admin only)
func DeleteVersion(c *gin.Context) {
	versionIDStr := c.Param("version_id")

	versionID, err := uuid.Parse(versionIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version ID"})
		return
	}

	// TODO: Check if user is admin

	if err := VersionService.DeleteVersion(versionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============================================================
// FIELD TYPE REGISTRY HANDLERS
// ============================================================

// GetFieldTypes returns all field types from registry
func GetFieldTypes(c *gin.Context) {
	var types []models.FieldTypeRegistry
	if err := database.DB.Find(&types).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, types)
}

// GetFieldType returns a specific field type
func GetFieldType(c *gin.Context) {
	typeID := c.Param("type_id")

	var fieldType models.FieldTypeRegistry
	if err := database.DB.First(&fieldType, "id = ?", typeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Field type not found"})
		return
	}

	c.JSON(http.StatusOK, fieldType)
}

// ============================================================
// CHANGE APPROVAL HANDLERS
// ============================================================

// ListApprovals returns pending approvals for a table
func ListApprovals(c *gin.Context) {
	tableID := c.Param("id")
	status := c.DefaultQuery("status", "pending")

	tableUUID, err := uuid.Parse(tableID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID"})
		return
	}

	var approvals []models.ChangeApproval
	query := database.DB.Where("table_id = ?", tableUUID)
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	query.Order("requested_at DESC").Find(&approvals)

	c.JSON(http.StatusOK, approvals)
}

// GetApproval returns a specific approval request
func GetApproval(c *gin.Context) {
	approvalID := c.Param("approval_id")

	approvalUUID, err := uuid.Parse(approvalID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid approval ID"})
		return
	}

	var approval models.ChangeApproval
	if err := database.DB.First(&approval, approvalUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Approval not found"})
		return
	}

	c.JSON(http.StatusOK, approval)
}

// ReviewApproval approves or rejects a change request
func ReviewApproval(c *gin.Context) {
	approvalID := c.Param("approval_id")

	approvalUUID, err := uuid.Parse(approvalID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid approval ID"})
		return
	}

	var input struct {
		Action string `json:"action" binding:"required"` // approve or reject
		Notes  string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Action != "approve" && input.Action != "reject" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Action must be 'approve' or 'reject'"})
		return
	}

	// Get approval
	var approval models.ChangeApproval
	if err := database.DB.First(&approval, approvalUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Approval not found"})
		return
	}

	if approval.Status != models.ApprovalStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Approval is not pending"})
		return
	}

	// Get user ID
	userIDStr, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := uuid.Parse(userIDStr)

	// Update approval status
	now := time.Now()
	approval.Status = input.Action + "d" // approved or rejected
	approval.ReviewedBy = &userID
	approval.ReviewedAt = &now
	approval.ReviewNotes = input.Notes

	var versionID *uuid.UUID

	if input.Action == "approve" {
		// Apply the pending changes
		var pendingData map[string]interface{}
		json.Unmarshal(approval.PendingData, &pendingData)

		// Create version
		result, err := VersionService.CreateVersion(services.CreateVersionInput{
			RowID:        approval.RowID,
			TableID:      approval.TableID,
			Data:         pendingData,
			ChangeType:   models.ChangeTypeApproval,
			ChangeReason: "Approved: " + input.Notes,
			ChangedBy:    &userID,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Update the actual row
		database.DB.Model(&models.Row{}).Where("id = ?", approval.RowID).Update("data", approval.PendingData)

		versionID = &result.VersionID
	}

	database.DB.Save(&approval)

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"version_id": versionID,
	})
}

// ============================================================
// AI SUGGESTIONS HANDLERS
// ============================================================

// GetTableSuggestions returns AI suggestions for a table
func GetTableSuggestions(c *gin.Context) {
	tableID := c.Param("id")
	status := c.DefaultQuery("status", "pending")
	suggestionType := c.Query("type")
	minConfidence := 0.0
	if mc, err := strconv.ParseFloat(c.Query("min_confidence"), 64); err == nil {
		minConfidence = mc
	}
	limit := 50
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		limit = l
	}

	tableUUID, err := uuid.Parse(tableID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID"})
		return
	}

	query := database.DB.Where("table_id = ?", tableUUID)
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	if suggestionType != "" {
		query = query.Where("suggestion_type = ?", suggestionType)
	}
	if minConfidence > 0 {
		query = query.Where("confidence >= ?", minConfidence)
	}

	var suggestions []models.AIFieldSuggestion
	var total int64
	query.Model(&models.AIFieldSuggestion{}).Count(&total)
	query.Order("confidence DESC").Limit(limit).Find(&suggestions)

	c.JSON(http.StatusOK, gin.H{
		"table_id":    tableID,
		"suggestions": suggestions,
		"total":       total,
	})
}

// ApplySuggestion applies or rejects an AI suggestion
func ApplySuggestion(c *gin.Context) {
	suggestionID := c.Param("suggestion_id")

	suggestionUUID, err := uuid.Parse(suggestionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid suggestion ID"})
		return
	}

	var input struct {
		Apply bool   `json:"apply"`
		Notes string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get suggestion
	var suggestion models.AIFieldSuggestion
	if err := database.DB.First(&suggestion, suggestionUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Suggestion not found"})
		return
	}

	if suggestion.Status != models.SuggestionStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Suggestion is not pending"})
		return
	}

	// Get user ID
	userIDStr, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := uuid.Parse(userIDStr)

	now := time.Now()
	suggestion.ReviewedBy = &userID
	suggestion.ReviewedAt = &now
	suggestion.ReviewNotes = input.Notes

	var versionID *uuid.UUID

	if input.Apply && suggestion.RowID != nil {
		// Apply the suggestion to the row
		var row models.Row
		if err := database.DB.First(&row, suggestion.RowID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Row not found"})
			return
		}

		// Update the field value
		var data map[string]interface{}
		json.Unmarshal(row.Data, &data)

		var suggestedValue interface{}
		json.Unmarshal(suggestion.SuggestedValue, &suggestedValue)

		// Get field name from field_id if available
		fieldName := ""
		if suggestion.FieldID != nil {
			var field models.Field
			if err := database.DB.First(&field, suggestion.FieldID).Error; err == nil {
				fieldName = field.Name
			}
		}

		if fieldName != "" {
			data[fieldName] = suggestedValue
		}

		// Create version
		result, err := VersionService.CreateVersion(services.CreateVersionInput{
			RowID:          *suggestion.RowID,
			TableID:        suggestion.TableID,
			Data:           data,
			ChangeType:     models.ChangeTypeAIEdit,
			ChangeReason:   "AI suggestion: " + suggestion.SuggestionType,
			ChangedBy:      &userID,
			AIAssisted:     true,
			AIConfidence:   &suggestion.Confidence,
			AISuggestionID: &suggestion.ID,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Update the row
		dataJSON, _ := json.Marshal(data)
		database.DB.Model(&row).Update("data", dataJSON)

		suggestion.Status = models.SuggestionStatusAccepted
		suggestion.AppliedVersionID = &result.VersionID
		versionID = &result.VersionID
	} else if input.Apply {
		suggestion.Status = models.SuggestionStatusAccepted
	} else {
		suggestion.Status = models.SuggestionStatusRejected
	}

	database.DB.Save(&suggestion)

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"version_id": versionID,
	})
}

// DismissSuggestion dismisses an AI suggestion
func DismissSuggestion(c *gin.Context) {
	suggestionID := c.Param("suggestion_id")

	suggestionUUID, err := uuid.Parse(suggestionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid suggestion ID"})
		return
	}

	database.DB.Model(&models.AIFieldSuggestion{}).Where("id = ?", suggestionUUID).Update("status", models.SuggestionStatusDismissed)

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ============================================================
// ACTIVITY FEED HANDLERS
// ============================================================

// GetWorkspaceActivity returns activity feed for a workspace
func GetWorkspaceActivity(c *gin.Context) {
	workspaceID := c.Param("id")
	limit := 50
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		limit = l
	}

	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	// Get recent versions from tables in this workspace
	var versions []models.RowVersion
	database.DB.Joins("JOIN data_tables ON data_tables.id = row_versions.table_id").
		Where("data_tables.workspace_id = ?", workspaceUUID).
		Order("row_versions.changed_at DESC").
		Limit(limit).
		Find(&versions)

	// Transform to activity items
	activities := make([]gin.H, len(versions))
	for i, v := range versions {
		activityType := "row_updated"
		if v.ChangeType == models.ChangeTypeCreate {
			activityType = "row_created"
		} else if v.AIAssisted {
			activityType = "ai_suggestion"
		}

		activities[i] = gin.H{
			"id":          v.ID,
			"type":        activityType,
			"entity_type": "row",
			"entity_id":   v.RowID,
			"summary":     v.ChangeSummary,
			"changed_by":  v.ChangedBy,
			"timestamp":   v.ChangedAt,
			"details": gin.H{
				"version_number": v.VersionNumber,
				"change_type":    v.ChangeType,
				"ai_assisted":    v.AIAssisted,
			},
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"activities": activities,
	})
}
