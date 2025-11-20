package handlers

import (
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Form Handlers

func ListForms(c *gin.Context) {
	workspaceID := c.Query("workspace_id")

	var forms []models.Form
	query := database.DB

	if workspaceID != "" {
		query = query.Where("workspace_id = ?", workspaceID)
	}

	if err := query.Preload("Fields").Order("created_at DESC").Find(&forms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, forms)
}

func GetForm(c *gin.Context) {
	id := c.Param("id")

	var form models.Form
	if err := database.DB.Preload("Fields").First(&form, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	c.JSON(http.StatusOK, form)
}

type CreateFormInput struct {
	WorkspaceID uuid.UUID              `json:"workspace_id" binding:"required"`
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Settings    map[string]interface{} `json:"settings"`
	IsPublished bool                   `json:"is_published"`
}

func CreateForm(c *gin.Context) {
	var input CreateFormInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	form := models.Form{
		WorkspaceID: input.WorkspaceID,
		Name:        input.Name,
		Description: input.Description,
		Settings:    mapToJSON(input.Settings),
		IsPublished: input.IsPublished,
	}

	if err := database.DB.Create(&form).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, form)
}

type UpdateFormInput struct {
	Name        *string                 `json:"name"`
	Description *string                 `json:"description"`
	Settings    *map[string]interface{} `json:"settings"`
	IsPublished *bool                   `json:"is_published"`
}

func UpdateForm(c *gin.Context) {
	id := c.Param("id")

	var form models.Form
	if err := database.DB.First(&form, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	var input UpdateFormInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Name != nil {
		form.Name = *input.Name
	}
	if input.Description != nil {
		form.Description = *input.Description
	}
	if input.Settings != nil {
		form.Settings = mapToJSON(*input.Settings)
	}
	if input.IsPublished != nil {
		form.IsPublished = *input.IsPublished
	}

	if err := database.DB.Save(&form).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, form)
}

func DeleteForm(c *gin.Context) {
	id := c.Param("id")

	var form models.Form
	if err := database.DB.First(&form, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	if err := database.DB.Delete(&form).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// Form Submission Handlers

func ListFormSubmissions(c *gin.Context) {
	formID := c.Param("id")

	var submissions []models.FormSubmission
	if err := database.DB.Where("form_id = ?", formID).Order("created_at DESC").Find(&submissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, submissions)
}

type SubmitFormInput struct {
	Data map[string]interface{} `json:"data" binding:"required"`
}

func SubmitForm(c *gin.Context) {
	formID := c.Param("id")

	// Verify form exists and is published
	var form models.Form
	if err := database.DB.First(&form, "id = ?", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	if !form.IsPublished {
		c.JSON(http.StatusForbidden, gin.H{"error": "Form is not published"})
		return
	}

	var input SubmitFormInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	submission := models.FormSubmission{
		FormID:    uuid.MustParse(formID),
		Data:      mapToJSON(input.Data),
		IPAddress: c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	}

	// Add user ID if authenticated (optional for forms)
	if userID, exists := middleware.GetUserID(c); exists {
		if parsedUserID, err := uuid.Parse(userID); err == nil {
			submission.SubmittedBy = parsedUserID
		}
	}

	if err := database.DB.Create(&submission).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, submission)
}
