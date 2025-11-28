package handlers

import (
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Organization Handlers

// ListOrganizations returns all organizations the authenticated user is a member of
func ListOrganizations(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var organizations []models.Organization

	// Get all organizations where the user is a member
	if err := database.DB.
		Joins("JOIN organization_members ON organization_members.organization_id = organizations.id").
		Where("organization_members.user_id = ?", userID).
		Preload("Members").
		Order("organizations.created_at DESC").
		Find(&organizations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, organizations)
}

func GetOrganization(c *gin.Context) {
	id := c.Param("id")
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var organization models.Organization

	// Verify user is a member of this organization
	if err := database.DB.
		Joins("JOIN organization_members ON organization_members.organization_id = organizations.id").
		Where("organizations.id = ? AND organization_members.user_id = ?", id, userID).
		Preload("Members").
		Preload("Workspaces").
		First(&organization).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found or access denied"})
		return
	}

	c.JSON(http.StatusOK, organization)
}

type CreateOrganizationInput struct {
	Name        string                 `json:"name" binding:"required"`
	Slug        string                 `json:"slug" binding:"required"`
	Description string                 `json:"description"`
	Settings    map[string]interface{} `json:"settings"`
}

func CreateOrganization(c *gin.Context) {
	var input CreateOrganizationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Check for duplicate slug
	var existing models.Organization
	if err := database.DB.Where("slug = ?", input.Slug).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Organization with this slug already exists"})
		return
	}

	// Begin transaction
	tx := database.DB.Begin()

	// Create organization
	organization := models.Organization{
		Name:        input.Name,
		Slug:        input.Slug,
		Description: input.Description,
		Settings:    mapToJSON(input.Settings),
	}

	if err := tx.Create(&organization).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add creator as owner
	member := models.OrganizationMember{
		OrganizationID: organization.ID,
		UserID:         parsedUserID,
		Role:           "owner",
	}

	if err := tx.Create(&member).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add user as owner"})
		return
	}

	tx.Commit()

	c.JSON(http.StatusCreated, organization)
}

type UpdateOrganizationInput struct {
	Name        *string                 `json:"name"`
	Slug        *string                 `json:"slug"`
	Description *string                 `json:"description"`
	Settings    *map[string]interface{} `json:"settings"`
}

func UpdateOrganization(c *gin.Context) {
	id := c.Param("id")
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Check if user is admin or owner
	var member models.OrganizationMember
	if err := database.DB.Where("organization_id = ? AND user_id = ? AND role IN ('owner', 'admin')", id, userID).First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owners and admins can update organizations"})
		return
	}

	var organization models.Organization
	if err := database.DB.First(&organization, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	var input UpdateOrganizationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check slug conflicts if updating
	if input.Slug != nil && *input.Slug != organization.Slug {
		var existing models.Organization
		if err := database.DB.Where("slug = ? AND id != ?", *input.Slug, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Organization with this slug already exists"})
			return
		}
		organization.Slug = *input.Slug
	}

	if input.Name != nil {
		organization.Name = *input.Name
	}
	if input.Description != nil {
		organization.Description = *input.Description
	}
	if input.Settings != nil {
		organization.Settings = mapToJSON(*input.Settings)
	}

	if err := database.DB.Save(&organization).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, organization)
}

func DeleteOrganization(c *gin.Context) {
	id := c.Param("id")
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Only owners can delete organizations
	var member models.OrganizationMember
	if err := database.DB.Where("organization_id = ? AND user_id = ? AND role = 'owner'", id, userID).First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owners can delete organizations"})
		return
	}

	if err := database.DB.Delete(&models.Organization{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Organization deleted successfully"})
}
