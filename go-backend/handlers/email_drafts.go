package handlers

import (
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Email Draft Management Endpoints

// ListEmailDrafts returns all drafts for a user/workspace
func ListEmailDrafts(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	userID := c.Query("user_id")

	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var drafts []models.EmailDraft
	query := database.DB.Where("workspace_id = ?", workspaceID)

	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}

	// Only show drafts from last 30 days (auto-cleanup)
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)
	query = query.Where("created_at > ?", thirtyDaysAgo)

	query.Order("updated_at DESC").Find(&drafts)

	c.JSON(http.StatusOK, drafts)
}

// GetEmailDraft returns a single draft by ID
func GetEmailDraft(c *gin.Context) {
	id := c.Param("id")

	var draft models.EmailDraft
	if err := database.DB.First(&draft, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Draft not found"})
		return
	}

	c.JSON(http.StatusOK, draft)
}

// CreateEmailDraft creates a new email draft
func CreateEmailDraft(c *gin.Context) {
	var draft models.EmailDraft
	if err := c.ShouldBindJSON(&draft); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if draft.ID == uuid.Nil {
		draft.ID = uuid.New()
	}

	draft.AutoSavedAt = time.Now()

	if err := database.DB.Create(&draft).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create draft"})
		return
	}

	c.JSON(http.StatusCreated, draft)
}

// UpdateEmailDraft updates an existing email draft (auto-save)
func UpdateEmailDraft(c *gin.Context) {
	id := c.Param("id")

	var draft models.EmailDraft
	if err := database.DB.First(&draft, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Draft not found"})
		return
	}

	// Only update fields that are provided
	var updates struct {
		RecipientEmails datatypes.JSON `json:"recipient_emails"`
		Subject         string         `json:"subject"`
		Body            string         `json:"body"`
		BodyHTML        string         `json:"body_html"`
		TemplateID      *uuid.UUID     `json:"template_id"`
		MergeFields     datatypes.JSON `json:"merge_fields"`
		Metadata        datatypes.JSON `json:"metadata"`
	}

	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields if provided
	if updates.RecipientEmails != nil {
		draft.RecipientEmails = updates.RecipientEmails
	}
	if updates.Subject != "" {
		draft.Subject = updates.Subject
	}
	if updates.Body != "" {
		draft.Body = updates.Body
	}
	if updates.BodyHTML != "" {
		draft.BodyHTML = updates.BodyHTML
	}
	if updates.TemplateID != nil {
		draft.TemplateID = updates.TemplateID
	}
	if updates.MergeFields != nil {
		draft.MergeFields = updates.MergeFields
	}
	if updates.Metadata != nil {
		draft.Metadata = updates.Metadata
	}

	draft.AutoSavedAt = time.Now()

	if err := database.DB.Save(&draft).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update draft"})
		return
	}

	c.JSON(http.StatusOK, draft)
}

// DeleteEmailDraft deletes an email draft
func DeleteEmailDraft(c *gin.Context) {
	id := c.Param("id")

	if err := database.DB.Delete(&models.EmailDraft{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete draft"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// CleanupOldDrafts removes drafts older than 30 days (should be called periodically)
func CleanupOldDrafts(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)
	result := database.DB.Where("workspace_id = ? AND created_at < ?", workspaceID, thirtyDaysAgo).Delete(&models.EmailDraft{})

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"deleted_count": result.RowsAffected,
	})
}

