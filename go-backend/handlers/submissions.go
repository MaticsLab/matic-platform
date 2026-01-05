package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ==================== REQUEST/RESPONSE TYPES ====================

// AutosaveInput represents the request body for autosave
type AutosaveInput struct {
	Changes     map[string]interface{} `json:"changes" binding:"required"`
	BaseVersion int                    `json:"base_version" binding:"required"`
}

// AutosaveResponse represents the response from autosave
type AutosaveResponse struct {
	Version       int                    `json:"version"`
	SavedAt       time.Time              `json:"saved_at"`
	Conflict      bool                   `json:"conflict,omitempty"`
	ServerData    map[string]interface{} `json:"server_data,omitempty"`
	ServerVersion int                    `json:"server_version,omitempty"`
}

// StartSubmissionInput represents the request to start a new submission
type StartSubmissionInput struct {
	FormID string `json:"form_id" binding:"required"`
}

// SubmissionResponse is the standard response for submission operations
type SubmissionResponse struct {
	ID             uuid.UUID              `json:"id"`
	UserID         string                 `json:"user_id"`
	FormID         uuid.UUID              `json:"form_id"`
	Status         string                 `json:"status"`
	StageID        *uuid.UUID             `json:"stage_id,omitempty"`
	Data           map[string]interface{} `json:"data"`
	Version        int                    `json:"version"`
	SubmittedAt    *time.Time             `json:"submitted_at,omitempty"`
	LastAutosaveAt *time.Time             `json:"last_autosave_at,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
}

// ==================== HANDLERS ====================

// GetOrStartSubmission gets an existing submission or creates a new one
// POST /api/v1/forms/:id/start
func GetOrStartSubmission(c *gin.Context) {
	formID := c.Param("id")
	userID := c.GetString("user_id") // From Better Auth middleware

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Validate form exists
	var table models.Table
	if err := database.DB.First(&table, "id = ?", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	formUUID := uuid.MustParse(formID)

	// Check for existing submission
	var submission models.ApplicationSubmission
	err := database.DB.Where("form_id = ? AND user_id = ?", formUUID, userID).First(&submission).Error

	if err == nil {
		// Return existing submission
		c.JSON(http.StatusOK, toSubmissionResponse(submission))
		return
	}

	// Create new submission
	submission = models.ApplicationSubmission{
		UserID:  userID,
		FormID:  formUUID,
		Status:  models.SubmissionStatusDraft,
		Version: 1,
		Data:    []byte("{}"),
	}

	if err := database.DB.Create(&submission).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create submission: " + err.Error()})
		return
	}

	fmt.Printf("✅ Created new submission %s for user %s on form %s\n", submission.ID, userID, formID)
	c.JSON(http.StatusCreated, toSubmissionResponse(submission))
}

// GetSubmission gets a submission by ID
// GET /api/v1/submissions/:id
func GetSubmission(c *gin.Context) {
	submissionID := c.Param("id")
	userID := c.GetString("user_id")

	var submission models.ApplicationSubmission
	query := database.DB.Where("id = ?", submissionID)

	// If user is authenticated, verify ownership (unless they're staff)
	if userID != "" {
		// Check if user is staff or owner
		var user struct {
			UserType string `gorm:"column:user_type"`
		}
		database.DB.Raw("SELECT user_type FROM ba_users WHERE id = ?", userID).Scan(&user)

		if user.UserType == "applicant" {
			query = query.Where("user_id = ?", userID)
		}
	}

	if err := query.First(&submission).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	c.JSON(http.StatusOK, toSubmissionResponse(submission))
}

// AutosaveSubmission handles optimistic autosave with conflict detection
// POST /api/v1/submissions/:id/autosave
func AutosaveSubmission(c *gin.Context) {
	submissionID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	var input AutosaveInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get submission and verify ownership
	var submission models.ApplicationSubmission
	if err := database.DB.Where("id = ? AND user_id = ?", submissionID, userID).First(&submission).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Check for version conflict (optimistic locking)
	if submission.Version != input.BaseVersion {
		var serverData map[string]interface{}
		json.Unmarshal(submission.Data, &serverData)

		fmt.Printf("⚠️ Autosave conflict: submission %s, client version %d, server version %d\n",
			submissionID, input.BaseVersion, submission.Version)

		c.JSON(http.StatusConflict, AutosaveResponse{
			Conflict:      true,
			ServerData:    serverData,
			ServerVersion: submission.Version,
		})
		return
	}

	// Merge changes into existing data
	var existingData map[string]interface{}
	if err := json.Unmarshal(submission.Data, &existingData); err != nil || existingData == nil {
		existingData = make(map[string]interface{})
	}

	// Track which fields changed
	changedFields := make([]string, 0, len(input.Changes))
	for key, value := range input.Changes {
		existingData[key] = value
		changedFields = append(changedFields, key)
	}

	// Serialize updated data
	dataBytes, err := json.Marshal(existingData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize data"})
		return
	}

	// Update submission with version increment
	now := time.Now()
	newVersion := submission.Version + 1

	result := database.DB.Model(&submission).Updates(map[string]interface{}{
		"data":             dataBytes,
		"version":          newVersion,
		"last_autosave_at": now,
	})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save: " + result.Error.Error()})
		return
	}

	// Create version record (async for performance)
	go func() {
		version := models.SubmissionVersion{
			SubmissionID:  submission.ID,
			Version:       newVersion,
			Data:          dataBytes,
			ChangedFields: changedFields,
			ChangeType:    models.SubmissionChangeTypeAutosave,
		}
		database.DB.Create(&version)
	}()

	fmt.Printf("✅ Autosave: submission %s, version %d → %d, %d fields changed\n",
		submissionID, input.BaseVersion, newVersion, len(changedFields))

	c.JSON(http.StatusOK, AutosaveResponse{
		Version: newVersion,
		SavedAt: now,
	})
}

// ManualSaveSubmission saves with full data (not just changes)
// PUT /api/v1/submissions/:id
func ManualSaveSubmission(c *gin.Context) {
	submissionID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	var input struct {
		Data    map[string]interface{} `json:"data" binding:"required"`
		Version int                    `json:"version"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get submission and verify ownership
	var submission models.ApplicationSubmission
	if err := database.DB.Where("id = ? AND user_id = ?", submissionID, userID).First(&submission).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Version check if provided
	if input.Version > 0 && submission.Version != input.Version {
		var serverData map[string]interface{}
		json.Unmarshal(submission.Data, &serverData)

		c.JSON(http.StatusConflict, gin.H{
			"conflict":       true,
			"server_data":    serverData,
			"server_version": submission.Version,
		})
		return
	}

	dataBytes, _ := json.Marshal(input.Data)
	now := time.Now()
	newVersion := submission.Version + 1

	submission.Data = dataBytes
	submission.Version = newVersion
	submission.LastAutosaveAt = &now

	if err := database.DB.Save(&submission).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save"})
		return
	}

	// Create version record
	go func() {
		version := models.SubmissionVersion{
			SubmissionID: submission.ID,
			Version:      newVersion,
			Data:         dataBytes,
			ChangeType:   models.SubmissionChangeTypeManualSave,
		}
		database.DB.Create(&version)
	}()

	c.JSON(http.StatusOK, toSubmissionResponse(submission))
}

// SubmitApplication finalizes a submission
// POST /api/v1/submissions/:id/submit
func SubmitApplication(c *gin.Context) {
	submissionID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get submission and verify ownership
	var submission models.ApplicationSubmission
	if err := database.DB.Where("id = ? AND user_id = ?", submissionID, userID).First(&submission).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Check if already submitted
	if submission.Status == models.SubmissionStatusSubmitted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Application already submitted"})
		return
	}

	// Update status
	now := time.Now()
	newVersion := submission.Version + 1

	submission.Status = models.SubmissionStatusSubmitted
	submission.SubmittedAt = &now
	submission.Version = newVersion

	// Find the initial stage for this form's workflow
	var initialStage models.ApplicationStage
	if err := database.DB.Where("review_workflow_id IN (SELECT id FROM review_workflows WHERE form_id = ?) AND order_index = 0",
		submission.FormID).First(&initialStage).Error; err == nil {
		submission.StageID = &initialStage.ID
	}

	if err := database.DB.Save(&submission).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit"})
		return
	}

	// Create version record
	go func() {
		version := models.SubmissionVersion{
			SubmissionID: submission.ID,
			Version:      newVersion,
			Data:         submission.Data,
			ChangeType:   models.SubmissionChangeTypeSubmit,
		}
		database.DB.Create(&version)
	}()

	// Trigger webhooks async
	go TriggerNewSubmissionWebhook(submission.FormID, submission.ID, nil)

	fmt.Printf("✅ Application submitted: %s by user %s\n", submissionID, userID)
	c.JSON(http.StatusOK, toSubmissionResponse(submission))
}

// ListUserSubmissions gets all submissions for the authenticated user
// GET /api/v1/submissions
func ListUserSubmissions(c *gin.Context) {
	userID := c.GetString("user_id")
	formID := c.Query("form_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	query := database.DB.Where("user_id = ?", userID)
	if formID != "" {
		query = query.Where("form_id = ?", formID)
	}

	var submissions []models.ApplicationSubmission
	if err := query.Order("updated_at DESC").Find(&submissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	responses := make([]SubmissionResponse, len(submissions))
	for i, s := range submissions {
		responses[i] = toSubmissionResponse(s)
	}

	c.JSON(http.StatusOK, responses)
}

// GetSubmissionVersions gets version history for a submission
// GET /api/v1/submissions/:id/versions
func GetSubmissionVersions(c *gin.Context) {
	submissionID := c.Param("id")
	userID := c.GetString("user_id")

	// Verify ownership
	var submission models.ApplicationSubmission
	if err := database.DB.Where("id = ? AND user_id = ?", submissionID, userID).First(&submission).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	var versions []models.SubmissionVersion
	database.DB.Where("submission_id = ?", submissionID).
		Order("version DESC").
		Limit(50).
		Find(&versions)

	c.JSON(http.StatusOK, versions)
}

// RestoreSubmissionVersion restores a previous version
// POST /api/v1/submissions/:id/restore/:version
func RestoreSubmissionVersion(c *gin.Context) {
	submissionID := c.Param("id")
	versionNum := c.Param("version")
	userID := c.GetString("user_id")

	// Verify ownership
	var submission models.ApplicationSubmission
	if err := database.DB.Where("id = ? AND user_id = ?", submissionID, userID).First(&submission).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	// Get the version to restore
	var version models.SubmissionVersion
	if err := database.DB.Where("submission_id = ? AND version = ?", submissionID, versionNum).First(&version).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Version not found"})
		return
	}

	// Create new version with restored data
	newVersion := submission.Version + 1
	now := time.Now()

	submission.Data = version.Data
	submission.Version = newVersion
	submission.LastAutosaveAt = &now

	if err := database.DB.Save(&submission).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore"})
		return
	}

	// Record the restore
	go func() {
		v := models.SubmissionVersion{
			SubmissionID: submission.ID,
			Version:      newVersion,
			Data:         version.Data,
			ChangeType:   models.SubmissionChangeTypeRestore,
		}
		database.DB.Create(&v)
	}()

	c.JSON(http.StatusOK, toSubmissionResponse(submission))
}

// ==================== HELPERS ====================

func toSubmissionResponse(s models.ApplicationSubmission) SubmissionResponse {
	var data map[string]interface{}
	json.Unmarshal(s.Data, &data)
	if data == nil {
		data = make(map[string]interface{})
	}

	return SubmissionResponse{
		ID:             s.ID,
		UserID:         s.UserID,
		FormID:         s.FormID,
		Status:         s.Status,
		StageID:        s.StageID,
		Data:           data,
		Version:        s.Version,
		SubmittedAt:    s.SubmittedAt,
		LastAutosaveAt: s.LastAutosaveAt,
		CreatedAt:      s.CreatedAt,
		UpdatedAt:      s.UpdatedAt,
	}
}
