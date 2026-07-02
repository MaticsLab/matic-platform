package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm/clause"
)

// RecordRecentView upserts a "viewed" timestamp for a form/table for the current user.
// POST /api/v1/recently-viewed
func RecordRecentView(c *gin.Context) {
	var input struct {
		WorkspaceID uuid.UUID `json:"workspace_id" binding:"required"`
		EntityID    uuid.UUID `json:"entity_id" binding:"required"`
		EntityType  string    `json:"entity_type" binding:"required,oneof=form table"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user ID not found"})
		return
	}

	view := models.RecentlyViewed{
		WorkspaceID: input.WorkspaceID,
		BAUserID:    userID,
		EntityID:    input.EntityID,
		EntityType:  input.EntityType,
		ViewedAt:    time.Now(),
	}

	// Upsert: on (workspace_id, ba_user_id, entity_id, entity_type) conflict, bump viewed_at.
	err := database.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "workspace_id"}, {Name: "ba_user_id"}, {Name: "entity_id"}, {Name: "entity_type"}},
		DoUpdates: clause.AssignmentColumns([]string{"viewed_at"}),
	}).Create(&view).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record view"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ListRecentViews returns the current user's most recently viewed forms/tables in a workspace.
// GET /api/v1/recently-viewed?workspace_id=uuid&limit=8
func ListRecentViews(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing workspace_id"})
		return
	}
	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user ID not found"})
		return
	}

	limit := 8
	if limitParam := c.Query("limit"); limitParam != "" {
		var l int
		if _, err := fmt.Sscanf(limitParam, "%d", &l); err == nil && l > 0 {
			limit = l
		}
	}

	var views []models.RecentlyViewed
	if err := database.DB.
		Where("workspace_id = ? AND ba_user_id = ?", workspaceUUID, userID).
		Order("viewed_at DESC").
		Limit(limit).
		Find(&views).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load recent views"})
		return
	}

	c.JSON(http.StatusOK, views)
}
