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

// GetRowVersion returns a specific version snapshot with prev/next navigation
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

	// Parse version data
	var data map[string]interface{}
	json.Unmarshal(version.Data, &data)

	// Get previous and next version numbers
	var prevVersion, nextVersion *int
	var prev, next int
	if err := database.DB.Raw(`
		SELECT version_number FROM row_versions 
		WHERE row_id = ? AND version_number < ? 
		ORDER BY version_number DESC LIMIT 1
	`, rowUUID, versionNumber).Scan(&prev).Error; err == nil && prev > 0 {
		prevVersion = &prev
	}
	if err := database.DB.Raw(`
		SELECT version_number FROM row_versions 
		WHERE row_id = ? AND version_number > ? 
		ORDER BY version_number ASC LIMIT 1
	`, rowUUID, versionNumber).Scan(&next).Error; err == nil && next > 0 {
		nextVersion = &next
	}

	c.JSON(http.StatusOK, gin.H{
		"version":          version,
		"data":             data,
		"changes":          changes,
		"previous_version": prevVersion,
		"next_version":     nextVersion,
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

	// Restore version
	result, err := VersionService.RestoreVersion(rowUUID, versionNumber, input.Reason, &userIDStr)
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

	if err := VersionService.ArchiveVersion(versionID, userIDStr); err != nil {
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
	category := c.Query("category")  // optional filter: primitive, container, layout, special
	moduleId := c.Query("module_id") // optional filter by module

	query := database.DB.Order("category, id")

	if category != "" {
		query = query.Where("category = ?", category)
	}
	if moduleId != "" {
		query = query.Where("module_id = ? OR module_id IS NULL", moduleId)
	}

	var types []models.FieldTypeRegistry
	if err := query.Find(&types).Error; err != nil {
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

// FieldTypeSummary is a simplified version for toolbox display
type FieldTypeSummary struct {
	ID          string `json:"id"`
	Category    string `json:"category"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Color       string `json:"color"`
	IsContainer bool   `json:"is_container"`
}

// GetFieldTypesToolbox returns a simplified list grouped by category for the portal builder
// GET /api/v1/field-types/toolbox
func GetFieldTypesToolbox(c *gin.Context) {
	var fieldTypes []models.FieldTypeRegistry
	if err := database.DB.
		Where("is_system_field = false OR is_system_field IS NULL").
		Order("category, label").
		Find(&fieldTypes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Group by category for easier frontend consumption
	grouped := map[string][]FieldTypeSummary{
		"primitive": {},
		"container": {},
		"layout":    {},
		"special":   {},
	}

	for _, ft := range fieldTypes {
		summary := FieldTypeSummary{
			ID:          ft.ID,
			Category:    ft.Category,
			Label:       ft.Label,
			Description: ft.Description,
			Icon:        ft.Icon,
			Color:       ft.Color,
			IsContainer: ft.IsContainer,
		}
		grouped[ft.Category] = append(grouped[ft.Category], summary)
	}

	c.JSON(http.StatusOK, grouped)
}

// ValidateFieldType checks if a field type ID is valid and returns the registry entry
func ValidateFieldType(fieldTypeID string) (*models.FieldTypeRegistry, error) {
	var fieldType models.FieldTypeRegistry
	if err := database.DB.First(&fieldType, "id = ?", fieldTypeID).Error; err != nil {
		return nil, err
	}
	return &fieldType, nil
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

	// Get user ID (Better Auth - TEXT format)
	baUserID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Update approval status
	now := time.Now()
	approval.Status = input.Action + "d" // approved or rejected
	approval.BAReviewedBy = &baUserID
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
			BAChangedBy:  &baUserID,
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

	// Get user ID (Better Auth - TEXT format)
	baUserID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	now := time.Now()
	suggestion.BAReviewedBy = &baUserID
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
			BAChangedBy:    &baUserID,
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

// AnalyzeTableForSuggestions triggers AI analysis of a table's data
func AnalyzeTableForSuggestions(c *gin.Context) {
	tableID := c.Param("id")

	tableUUID, err := uuid.Parse(tableID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID"})
		return
	}

	// Get table to find workspace
	var table models.Table
	if err := database.DB.First(&table, tableUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table not found"})
		return
	}

	// Parse max rows from query
	maxRows := 100
	if m, err := strconv.Atoi(c.Query("max_rows")); err == nil && m > 0 {
		maxRows = m
	}

	// Run analysis
	aiService := services.NewAISuggestionService()
	result, err := aiService.AnalyzeTable(services.AnalyzeTableInput{
		TableID:     tableUUID,
		WorkspaceID: table.WorkspaceID,
		MaxRows:     maxRows,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// AnalyzeRowForSuggestions triggers AI analysis of a single row
func AnalyzeRowForSuggestions(c *gin.Context) {
	tableID := c.Param("id")
	rowID := c.Param("row_id")

	tableUUID, err := uuid.Parse(tableID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID"})
		return
	}

	rowUUID, err := uuid.Parse(rowID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid row ID"})
		return
	}

	// Get table to find workspace
	var table models.Table
	if err := database.DB.First(&table, tableUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table not found"})
		return
	}

	// Run analysis
	aiService := services.NewAISuggestionService()
	suggestions, err := aiService.AnalyzeRow(services.AnalyzeRowInput{
		RowID:       rowUUID,
		TableID:     tableUUID,
		WorkspaceID: table.WorkspaceID,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"row_id":      rowID,
		"suggestions": suggestions,
	})
}

// ============================================================
// ACTIVITY FEED HANDLERS
// ============================================================

// UserSummary represents a brief user info for activity feeds
type UserSummary struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email,omitempty"`
}

// GetWorkspaceActivity returns activity feed for a workspace
func GetWorkspaceActivity(c *gin.Context) {
	workspaceID := c.Param("id")
	limit := 50
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		limit = l
	}
	cursor := c.Query("cursor") // For pagination

	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	// Get recent versions from tables in this workspace
	var versions []models.RowVersion
	query := database.DB.Joins("JOIN data_tables ON data_tables.id = row_versions.table_id").
		Where("data_tables.workspace_id = ?", workspaceUUID).
		Order("row_versions.changed_at DESC").
		Limit(limit + 1) // Fetch one extra to check if there's more

	if cursor != "" {
		// Parse cursor as timestamp for pagination
		if cursorTime, err := time.Parse(time.RFC3339, cursor); err == nil {
			query = query.Where("row_versions.changed_at < ?", cursorTime)
		}
	}

	query.Find(&versions)

	// Check if there are more results
	var nextCursor string
	if len(versions) > limit {
		versions = versions[:limit]
		nextCursor = versions[len(versions)-1].ChangedAt.Format(time.RFC3339)
	}

	// Get user info for all ba_changed_by users
	userIDs := make([]string, 0)
	for _, v := range versions {
		if v.BAChangedBy != nil {
			userIDs = append(userIDs, *v.BAChangedBy)
		}
	}

	// Fetch user summaries from Better Auth user table
	userMap := make(map[string]UserSummary)
	if len(userIDs) > 0 {
		var profiles []struct {
			ID    string
			Name  string
			Email string
		}
		database.DB.Raw(`
			SELECT id, COALESCE(name, email) as name, email
			FROM "user" WHERE id IN ?
		`, userIDs).Scan(&profiles)

		for _, p := range profiles {
			userMap[p.ID] = UserSummary{
				ID:    p.ID,
				Name:  p.Name,
				Email: p.Email,
			}
		}

		// Also check portal_applicants for users not found in ba_users
		missingIDs := make([]string, 0)
		for _, id := range userIDs {
			if _, found := userMap[id]; !found {
				missingIDs = append(missingIDs, id)
			}
		}
		if len(missingIDs) > 0 {
			var applicants []struct {
				BAUserID string `gorm:"column:ba_user_id"`
				FullName string `gorm:"column:full_name"`
				Email    string
			}
			database.DB.Raw(`
				SELECT ba_user_id, full_name, email
				FROM portal_applicants WHERE ba_user_id IN ?
			`, missingIDs).Scan(&applicants)

			for _, a := range applicants {
				name := a.FullName
				if name == "" {
					name = a.Email
				}
				userMap[a.BAUserID] = UserSummary{
					ID:    a.BAUserID,
					Name:  name,
					Email: a.Email,
				}
			}
		}
	}

	// Get entity titles (row display values)
	rowIDs := make([]uuid.UUID, 0)
	for _, v := range versions {
		rowIDs = append(rowIDs, v.RowID)
	}
	titleMap := make(map[uuid.UUID]string)
	if len(rowIDs) > 0 {
		var rows []struct {
			ID   uuid.UUID
			Data json.RawMessage
		}
		database.DB.Raw(`SELECT id, data FROM table_rows WHERE id IN ?`, rowIDs).Scan(&rows)
		for _, r := range rows {
			var data map[string]interface{}
			json.Unmarshal(r.Data, &data)
			// Try to get a title from common fields
			for _, key := range []string{"name", "title", "email", "first_name", "label"} {
				if val, ok := data[key].(string); ok && val != "" {
					titleMap[r.ID] = val
					break
				}
			}
		}
	}

	// Transform to activity items
	activities := make([]gin.H, len(versions))
	for i, v := range versions {
		activityType := "row_updated"
		if v.ChangeType == models.ChangeTypeCreate {
			activityType = "row_created"
		} else if v.AIAssisted {
			activityType = "ai_suggestion"
		}

		// Get user summary
		var changedBy interface{}
		if v.BAChangedBy != nil {
			if user, ok := userMap[*v.BAChangedBy]; ok {
				changedBy = user
			} else {
				changedBy = UserSummary{ID: *v.BAChangedBy, Name: "Unknown User"}
			}
		}

		// Get entity title
		entityTitle := titleMap[v.RowID]
		if entityTitle == "" {
			entityTitle = "Row " + v.RowID.String()[:8]
		}

		activities[i] = gin.H{
			"id":           v.ID,
			"type":         activityType,
			"entity_type":  "row",
			"entity_id":    v.RowID,
			"entity_title": entityTitle,
			"summary":      v.ChangeSummary,
			"changed_by":   changedBy,
			"timestamp":    v.ChangedAt,
			"details": gin.H{
				"version_number": v.VersionNumber,
				"change_type":    v.ChangeType,
				"ai_assisted":    v.AIAssisted,
			},
		}
	}

	response := gin.H{
		"activities": activities,
	}
	if nextCursor != "" {
		response["next_cursor"] = nextCursor
	}

	c.JSON(http.StatusOK, response)
}

// ============================================================
// AI SCHEMA HANDLERS
// ============================================================

// ValueStats represents statistics about field values
type ValueStats struct {
	NullCount   int `json:"null_count"`
	UniqueCount int `json:"unique_count"`
	TotalCount  int `json:"total_count"`
}

// AIHints represents AI processing hints from field_type_registry
type AIHints struct {
	EmbeddingStrategy     string  `json:"embedding_strategy,omitempty"`
	PrivacyLevel          string  `json:"privacy_level,omitempty"`
	SummarizationTemplate string  `json:"summarization_template,omitempty"`
	SearchWeight          float64 `json:"search_weight,omitempty"`
}

// AIFieldSchema represents AI-friendly field schema
type AIFieldSchema struct {
	ID           uuid.UUID  `json:"id"`
	Name         string     `json:"name"`
	Label        string     `json:"label"`
	Type         string     `json:"type"`
	SemanticType string     `json:"semantic_type,omitempty"`
	Description  string     `json:"description,omitempty"`
	SampleValues []string   `json:"sample_values"`
	ValueStats   ValueStats `json:"value_stats"`
	AIHints      AIHints    `json:"ai_hints"`
}

// AITableSchema represents AI-friendly table schema
type AITableSchema struct {
	TableID    uuid.UUID                `json:"table_id"`
	TableName  string                   `json:"table_name"`
	EntityType string                   `json:"entity_type,omitempty"`
	Fields     []AIFieldSchema          `json:"fields"`
	SampleRows []map[string]interface{} `json:"sample_rows"`
}

// GetTableAISchema returns an AI-friendly schema representation for a table
// GET /tables/:id/schema/ai
func GetTableAISchema(c *gin.Context) {
	tableID := c.Param("id")

	tableUUID, err := uuid.Parse(tableID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID"})
		return
	}

	// Get table with fields
	var table models.Table
	if err := database.DB.Preload("Fields").First(&table, tableUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table not found"})
		return
	}

	// Get 3 sample rows
	var sampleRows []models.Row
	database.DB.Where("table_id = ?", tableUUID).
		Order("created_at DESC").
		Limit(3).
		Find(&sampleRows)

	// Convert sample rows to maps
	sampleRowMaps := make([]map[string]interface{}, len(sampleRows))
	for i, row := range sampleRows {
		var data map[string]interface{}
		json.Unmarshal(row.Data, &data)
		sampleRowMaps[i] = data
	}

	// Get total row count for stats
	var totalRowCount int64
	database.DB.Model(&models.Row{}).Where("table_id = ?", tableUUID).Count(&totalRowCount)

	// Build AI field schemas
	aiFields := make([]AIFieldSchema, len(table.Fields))
	for i, field := range table.Fields {
		// Get sample values for this field (up to 5 unique values)
		var sampleValues []string
		database.DB.Raw(`
			SELECT DISTINCT data->>? AS val
			FROM table_rows
			WHERE table_id = ? AND data->>? IS NOT NULL
			LIMIT 5
		`, field.Name, tableUUID, field.Name).Scan(&sampleValues)

		// Get value stats
		var nullCount int64
		database.DB.Raw(`
			SELECT COUNT(*) FROM table_rows
			WHERE table_id = ? AND (data->>? IS NULL OR data->>? = '')
		`, tableUUID, field.Name, field.Name).Scan(&nullCount)

		var uniqueCount int64
		database.DB.Raw(`
			SELECT COUNT(DISTINCT data->>?) FROM table_rows
			WHERE table_id = ? AND data->>? IS NOT NULL
		`, field.Name, tableUUID, field.Name).Scan(&uniqueCount)

		// Get AI hints from field_type_registry
		var aiHints AIHints
		var fieldTypeReg models.FieldTypeRegistry
		if err := database.DB.Where("id = ?", field.Type).First(&fieldTypeReg).Error; err == nil {
			var aiSchema map[string]interface{}
			json.Unmarshal(fieldTypeReg.AISchema, &aiSchema)
			if strategy, ok := aiSchema["embedding_strategy"].(string); ok {
				aiHints.EmbeddingStrategy = strategy
			}
			if privacy, ok := aiSchema["privacy_level"].(string); ok {
				aiHints.PrivacyLevel = privacy
			}
			if template, ok := aiSchema["summarization_template"].(string); ok {
				aiHints.SummarizationTemplate = template
			}
			if weight, ok := aiSchema["search_weight"].(float64); ok {
				aiHints.SearchWeight = weight
			}
		}

		// Get description from field settings if available
		description := field.Description
		var settings map[string]interface{}
		json.Unmarshal(field.Settings, &settings)
		if desc, ok := settings["description"].(string); ok && description == "" {
			description = desc
		}

		// Use semantic type from field model
		semanticType := field.SemanticType

		aiFields[i] = AIFieldSchema{
			ID:           field.ID,
			Name:         field.Name,
			Label:        field.Label,
			Type:         field.Type,
			SemanticType: semanticType,
			Description:  description,
			SampleValues: sampleValues,
			ValueStats: ValueStats{
				NullCount:   int(nullCount),
				UniqueCount: int(uniqueCount),
				TotalCount:  int(totalRowCount),
			},
			AIHints: aiHints,
		}
	}

	// Get entity type from table model directly
	entityType := table.EntityType

	schema := AITableSchema{
		TableID:    table.ID,
		TableName:  table.Name,
		EntityType: entityType,
		Fields:     aiFields,
		SampleRows: sampleRowMaps,
	}

	c.JSON(http.StatusOK, schema)
}
