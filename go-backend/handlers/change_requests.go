package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/Jsanchez767/matic-platform/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ============================================================
// CHANGE REQUESTS - Approval Workflow
// ============================================================

// ListChangeRequests returns pending change requests for a workspace
func ListChangeRequests(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	tableID := c.Query("table_id")
	status := c.DefaultQuery("status", "pending")

	var requests []models.ChangeRequest
	query := database.DB.Order("created_at DESC")

	if workspaceID != "" {
		query = query.Where("workspace_id = ?", workspaceID)
	}
	if tableID != "" {
		query = query.Where("table_id = ?", tableID)
	}
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}

	if err := query.Find(&requests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, requests)
}

// GetChangeRequest returns a single change request
func GetChangeRequest(c *gin.Context) {
	id := c.Param("id")

	var request models.ChangeRequest
	if err := database.DB.First(&request, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Change request not found"})
		return
	}

	c.JSON(http.StatusOK, request)
}

// CreateChangeRequestInput represents input for creating a change request
type CreateChangeRequestInput struct {
	TableID      string                 `json:"table_id" binding:"required"`
	RowID        string                 `json:"row_id" binding:"required"`
	ProposedData map[string]interface{} `json:"proposed_data" binding:"required"`
	ChangeReason string                 `json:"change_reason"`
	ExpiresIn    int                    `json:"expires_in"` // Hours until expiry
}

// CreateChangeRequest creates a new change request for approval
func CreateChangeRequest(c *gin.Context) {
	var input CreateChangeRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tableID := uuid.MustParse(input.TableID)
	rowID := uuid.MustParse(input.RowID)

	// Get current row data
	var row models.Row
	if err := database.DB.First(&row, "id = ?", rowID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Row not found"})
		return
	}

	// Get table to find workspace
	var table models.Table
	if err := database.DB.First(&table, "id = ?", tableID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table not found"})
		return
	}

	// Parse current data
	var currentData map[string]interface{}
	json.Unmarshal(row.Data, &currentData)

	// Find changed fields
	var changedFields []string
	for key, newVal := range input.ProposedData {
		oldVal, exists := currentData[key]
		if !exists || !deepEqual(oldVal, newVal) {
			changedFields = append(changedFields, key)
		}
	}

	// Generate change summary
	summary := generateChangeSummary(changedFields, input.ChangeReason)

	// Get user ID (required for change requests)
	userIDStr, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User authentication required"})
		return
	}
	userID := uuid.MustParse(userIDStr)

	// Calculate expiry
	var expiresAt *time.Time
	if input.ExpiresIn > 0 {
		t := time.Now().Add(time.Duration(input.ExpiresIn) * time.Hour)
		expiresAt = &t
	}

	currentDataJSON, _ := json.Marshal(currentData)
	proposedDataJSON, _ := json.Marshal(input.ProposedData)

	request := models.ChangeRequest{
		WorkspaceID:   table.WorkspaceID,
		TableID:       tableID,
		RowID:         rowID,
		CurrentData:   currentDataJSON,
		ProposedData:  proposedDataJSON,
		ChangedFields: changedFields,
		ChangeReason:  input.ChangeReason,
		ChangeSummary: summary,
		RequestedBy:   userID,
		Status:        models.ChangeRequestStatusPending,
		ExpiresAt:     expiresAt,
	}

	if err := database.DB.Create(&request).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, request)
}

// ReviewChangeRequestInput represents input for reviewing a change request
type ReviewChangeRequestInput struct {
	Action      string `json:"action" binding:"required"` // approve, reject
	ReviewNotes string `json:"review_notes"`
}

// ReviewChangeRequest approves or rejects a change request
func ReviewChangeRequest(c *gin.Context) {
	id := c.Param("id")

	var input ReviewChangeRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var request models.ChangeRequest
	if err := database.DB.First(&request, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Change request not found"})
		return
	}

	if request.Status != models.ChangeRequestStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Change request is not pending"})
		return
	}

	// Check if expired
	if request.ExpiresAt != nil && time.Now().After(*request.ExpiresAt) {
		request.Status = models.ChangeRequestStatusExpired
		database.DB.Save(&request)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Change request has expired"})
		return
	}

	// Get reviewer ID
	var reviewerID *uuid.UUID
	if userIDStr, exists := middleware.GetUserID(c); exists {
		parsedID := uuid.MustParse(userIDStr)
		reviewerID = &parsedID
	}

	now := time.Now()
	request.ReviewedBy = reviewerID
	request.ReviewedAt = &now
	request.ReviewNotes = input.ReviewNotes

	if input.Action == "approve" {
		// Apply the changes
		var proposedData map[string]interface{}
		json.Unmarshal(request.ProposedData, &proposedData)

		// Update the row
		var row models.Row
		if err := database.DB.First(&row, "id = ?", request.RowID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Row not found"})
			return
		}

		// Begin transaction
		tx := database.DB.Begin()

		row.Data = request.ProposedData
		row.UpdatedAt = time.Now()
		if err := tx.Save(&row).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update row"})
			return
		}

		// Create version
		versionService := services.NewVersionService()
		result, err := versionService.CreateVersionTx(tx, services.CreateVersionInput{
			RowID:        request.RowID,
			TableID:      request.TableID,
			Data:         proposedData,
			ChangeType:   models.ChangeTypeUpdate,
			ChangeReason: "Approved change request: " + request.ChangeReason,
			ChangedBy:    reviewerID,
		})
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create version"})
			return
		}

		request.Status = models.ChangeRequestStatusApproved
		request.AppliedVersionID = &result.VersionID

		if err := tx.Save(&request).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update request"})
			return
		}

		tx.Commit()

		// Queue for embedding
		go func() {
			database.DB.Exec(`
				INSERT INTO embedding_queue (entity_id, entity_type, priority, status)
				VALUES ($1, 'row', 5, 'pending')
				ON CONFLICT (entity_id, entity_type) 
				DO UPDATE SET priority = 5, status = 'pending', created_at = NOW()
			`, request.RowID)
		}()

	} else if input.Action == "reject" {
		request.Status = models.ChangeRequestStatusRejected
		if err := database.DB.Save(&request).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid action. Use 'approve' or 'reject'"})
		return
	}

	c.JSON(http.StatusOK, request)
}

// CancelChangeRequest cancels a pending change request
func CancelChangeRequest(c *gin.Context) {
	id := c.Param("id")

	var request models.ChangeRequest
	if err := database.DB.First(&request, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Change request not found"})
		return
	}

	if request.Status != models.ChangeRequestStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only cancel pending requests"})
		return
	}

	// Verify requester
	if userIDStr, exists := middleware.GetUserID(c); exists {
		parsedID := uuid.MustParse(userIDStr)
		if request.RequestedBy != parsedID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only the requester can cancel this request"})
			return
		}
	}

	request.Status = models.ChangeRequestStatusCancelled
	if err := database.DB.Save(&request).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, request)
}

// GetPendingChangesForRow returns pending change requests for a specific row
func GetPendingChangesForRow(c *gin.Context) {
	rowID := c.Param("row_id")

	var requests []models.ChangeRequest
	if err := database.DB.Where("row_id = ? AND status = ?", rowID, models.ChangeRequestStatusPending).
		Order("created_at DESC").
		Find(&requests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, requests)
}

// Helper functions

func generateChangeSummary(changedFields []string, reason string) string {
	if reason != "" {
		return reason
	}
	if len(changedFields) == 1 {
		return "Changed " + changedFields[0]
	}
	if len(changedFields) > 0 {
		return "Changed " + changedFields[0] + " and " + string(rune(len(changedFields)-1)) + " other fields"
	}
	return "No changes"
}

func deepEqual(a, b interface{}) bool {
	aJSON, _ := json.Marshal(a)
	bJSON, _ := json.Marshal(b)
	return string(aJSON) == string(bJSON)
}
