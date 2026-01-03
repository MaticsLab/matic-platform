package handlers

import (
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Resend Integration Management Endpoints

// GetResendIntegration returns the Resend integration for a workspace
func GetResendIntegration(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var integration models.ResendIntegration
	if err := database.DB.Where("workspace_id = ?", workspaceID).First(&integration).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Resend integration not configured"})
		return
	}

	// Don't expose API key in response
	integration.APIKey = ""

	c.JSON(http.StatusOK, integration)
}

// CreateResendIntegration creates or updates a Resend integration
func CreateResendIntegration(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var req struct {
		APIKey    string `json:"api_key" binding:"required"`
		FromEmail string `json:"from_email" binding:"required"`
		FromName  string `json:"from_name"`
		IsActive  bool   `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	wsUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	var integration models.ResendIntegration
	err = database.DB.Where("workspace_id = ?", wsUUID).First(&integration).Error

		if err != nil {
		// Create new integration
		integration = models.ResendIntegration{
			ID:          uuid.New(),
			WorkspaceID: wsUUID,
			APIKey:      req.APIKey,
			FromEmail:   req.FromEmail,
			FromName:    req.FromName,
			IsActive:    req.IsActive,
		}
		if !req.IsActive {
			// Default to true if not specified
			integration.IsActive = true
		}

		if err := database.DB.Create(&integration).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Resend integration"})
			return
		}
	} else {
		// Update existing integration
		integration.APIKey = req.APIKey
		integration.FromEmail = req.FromEmail
		integration.FromName = req.FromName
		integration.IsActive = req.IsActive

		if err := database.DB.Save(&integration).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update Resend integration"})
			return
		}
	}

	// Don't expose API key in response
	integration.APIKey = ""

	c.JSON(http.StatusOK, integration)
}

// UpdateResendIntegration updates an existing Resend integration
func UpdateResendIntegration(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var req struct {
		APIKey    string `json:"api_key"`
		FromEmail string `json:"from_email"`
		FromName  string `json:"from_name"`
		IsActive  *bool  `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	wsUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	var integration models.ResendIntegration
	if err := database.DB.Where("workspace_id = ?", wsUUID).First(&integration).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Resend integration not found"})
		return
	}

	// Update only provided fields
	if req.APIKey != "" {
		integration.APIKey = req.APIKey
	}
	if req.FromEmail != "" {
		integration.FromEmail = req.FromEmail
	}
	if req.FromName != "" {
		integration.FromName = req.FromName
	}
	if req.IsActive != nil {
		integration.IsActive = *req.IsActive
	}

	if err := database.DB.Save(&integration).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update Resend integration"})
		return
	}

	// Don't expose API key in response
	integration.APIKey = ""

	c.JSON(http.StatusOK, integration)
}

// DeleteResendIntegration deletes a Resend integration
func DeleteResendIntegration(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	wsUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	if err := database.DB.Where("workspace_id = ?", wsUUID).Delete(&models.ResendIntegration{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete Resend integration"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// TestResendIntegration tests the Resend API connection
func TestResendIntegration(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var integration models.ResendIntegration
	if err := database.DB.Where("workspace_id = ?", workspaceID).First(&integration).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Resend integration not configured"})
		return
	}

	// Simple test - try to make an API call (or just verify config is valid)
	// For now, just return success if integration exists and is active
	if !integration.IsActive {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "Integration is inactive",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Integration configured",
	})
}

