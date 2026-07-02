package handlers

import (
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// StarItem stars a form/table for the current user. Idempotent.
// POST /api/v1/starred-items
func StarItem(c *gin.Context) {
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

	var star models.StarredItem
	lookup := models.StarredItem{
		WorkspaceID: input.WorkspaceID,
		BAUserID:    userID,
		EntityID:    input.EntityID,
		EntityType:  input.EntityType,
	}

	// Idempotent: no-op if already starred.
	if err := database.DB.Where(lookup).FirstOrCreate(&star, lookup).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to star item"})
		return
	}

	c.JSON(http.StatusOK, star)
}

// UnstarItem removes a star.
// DELETE /api/v1/starred-items?workspace_id=uuid&entity_id=uuid&entity_type=form
func UnstarItem(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	entityID := c.Query("entity_id")
	entityType := c.Query("entity_type")

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user ID not found"})
		return
	}

	if err := database.DB.
		Where("workspace_id = ? AND ba_user_id = ? AND entity_id = ? AND entity_type = ?", workspaceID, userID, entityID, entityType).
		Delete(&models.StarredItem{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unstar item"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ListStarredItems returns all starred forms/tables for the current user in a workspace.
// GET /api/v1/starred-items?workspace_id=uuid
func ListStarredItems(c *gin.Context) {
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

	var stars []models.StarredItem
	if err := database.DB.
		Where("workspace_id = ? AND ba_user_id = ?", workspaceUUID, userID).
		Order("created_at DESC").
		Find(&stars).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load starred items"})
		return
	}

	c.JSON(http.StatusOK, stars)
}
