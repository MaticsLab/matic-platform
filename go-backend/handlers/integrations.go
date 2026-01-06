package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/Jsanchez767/matic-platform/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"google.golang.org/api/drive/v3"
	"gorm.io/datatypes"
)

var googleDriveService *services.GoogleDriveService

// InitGoogleDriveService initializes the Google Drive service with OAuth credentials
// Uses the same GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as Gmail integration
func InitGoogleDriveService() {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")

	// Build redirect URI from environment or default
	redirectURI := os.Getenv("GOOGLE_DRIVE_REDIRECT_URI")
	if redirectURI == "" {
		// Default to the backend URL + callback path
		backendURL := os.Getenv("GO_BACKEND_URL")
		if backendURL == "" {
			backendURL = "http://localhost:8000"
		}
		redirectURI = backendURL + "/api/v1/integrations/google_drive/callback"
	}

	if clientID == "" || clientSecret == "" {
		fmt.Println("⚠️  Google OAuth credentials not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET). Drive integration disabled.")
		return
	}

	googleDriveService = services.NewGoogleDriveService(clientID, clientSecret, redirectURI)
	fmt.Println("✅ Google Drive service initialized (using shared Google OAuth credentials)")
}

// ========== Workspace Integration Handlers ==========

// ListWorkspaceIntegrations - GET /api/v1/workspaces/:workspace_id/integrations
func ListWorkspaceIntegrations(c *gin.Context) {
	workspaceID := c.Param("id")

	var integrations []models.WorkspaceIntegration
	if err := database.DB.Where("workspace_id = ?", workspaceID).Find(&integrations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch integrations"})
		return
	}

	c.JSON(http.StatusOK, integrations)
}

// GetWorkspaceIntegration - GET /api/v1/workspaces/:workspace_id/integrations/:type
func GetWorkspaceIntegration(c *gin.Context) {
	workspaceID := c.Param("id")
	integrationType := c.Param("type")

	var integration models.WorkspaceIntegration
	if err := database.DB.Where("workspace_id = ? AND integration_type = ?", workspaceID, integrationType).First(&integration).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Integration not found"})
		return
	}

	c.JSON(http.StatusOK, integration)
}

// CreateWorkspaceIntegration - POST /api/v1/workspaces/:workspace_id/integrations
func CreateWorkspaceIntegration(c *gin.Context) {
	workspaceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	var input struct {
		IntegrationType string `json:"integration_type" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if integration already exists
	var existing models.WorkspaceIntegration
	if err := database.DB.Where("workspace_id = ? AND integration_type = ?", workspaceID, input.IntegrationType).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Integration already exists"})
		return
	}

	integration := models.WorkspaceIntegration{
		WorkspaceID:     workspaceID,
		IntegrationType: input.IntegrationType,
		IsEnabled:       false,
		IsConnected:     false,
		Config:          []byte("{}"),
	}

	if err := database.DB.Create(&integration).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create integration"})
		return
	}

	c.JSON(http.StatusCreated, integration)
}

// UpdateWorkspaceIntegration - PATCH /api/v1/workspaces/:workspace_id/integrations/:type
func UpdateWorkspaceIntegration(c *gin.Context) {
	workspaceID := c.Param("id")
	integrationType := c.Param("type")

	var integration models.WorkspaceIntegration
	if err := database.DB.Where("workspace_id = ? AND integration_type = ?", workspaceID, integrationType).First(&integration).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Integration not found"})
		return
	}

	var input struct {
		IsEnabled *bool           `json:"is_enabled"`
		Config    json.RawMessage `json:"config"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.IsEnabled != nil {
		integration.IsEnabled = *input.IsEnabled
	}
	if input.Config != nil {
		integration.Config = datatypes.JSON(input.Config)
	}

	if err := database.DB.Save(&integration).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update integration"})
		return
	}

	c.JSON(http.StatusOK, integration)
}

// DeleteWorkspaceIntegration - DELETE /api/v1/workspaces/:workspace_id/integrations/:type
func DeleteWorkspaceIntegration(c *gin.Context) {
	workspaceID := c.Param("id")
	integrationType := c.Param("type")

	result := database.DB.Where("workspace_id = ? AND integration_type = ?", workspaceID, integrationType).Delete(&models.WorkspaceIntegration{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete integration"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Integration not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Integration deleted"})
}

// ========== Google Drive OAuth Handlers ==========

// GetGoogleDriveAuthURL - GET /api/v1/workspaces/:workspace_id/integrations/google_drive/auth-url
func GetGoogleDriveAuthURL(c *gin.Context) {
	if googleDriveService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Google Drive integration not configured"})
		return
	}

	workspaceID := c.Param("id")
	state := workspaceID // Use workspace ID as state for callback

	authURL := googleDriveService.GetAuthURL(state)
	c.JSON(http.StatusOK, gin.H{"auth_url": authURL, "state": state})
}

// GoogleDriveCallback - GET /api/v1/integrations/google_drive/callback
func GoogleDriveCallback(c *gin.Context) {
	if googleDriveService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Google Drive integration not configured"})
		return
	}

	code := c.Query("code")
	state := c.Query("state") // This is the workspace ID

	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization code required"})
		return
	}

	workspaceID, err := uuid.Parse(state)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state parameter"})
		return
	}

	// Exchange code for tokens
	ctx := context.Background()
	token, err := googleDriveService.ExchangeCode(ctx, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange authorization code"})
		return
	}

	// Get or create integration record
	var integration models.WorkspaceIntegration
	err = database.DB.Where("workspace_id = ? AND integration_type = ?", workspaceID, "google_drive").First(&integration).Error
	if err != nil {
		// Create new integration
		integration = models.WorkspaceIntegration{
			WorkspaceID:     workspaceID,
			IntegrationType: "google_drive",
			Config:          []byte("{}"),
		}
	}

	// Update with tokens
	integration.AccessToken = token.AccessToken
	integration.RefreshToken = token.RefreshToken
	integration.TokenExpiresAt = &token.Expiry
	integration.IsConnected = true
	now := time.Now()
	integration.ConnectedAt = &now

	// Get user email
	srv, err := googleDriveService.GetDriveClient(ctx, token.AccessToken, token.RefreshToken, token.Expiry)
	if err == nil {
		email, err := googleDriveService.GetUserEmail(ctx, srv)
		if err == nil {
			integration.ConnectedEmail = email
		}
	}

	if err := database.DB.Save(&integration).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save integration"})
		return
	}

	// Redirect to workspace settings with success message
	frontendURL := os.Getenv("NEXT_PUBLIC_APP_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	redirectURL := fmt.Sprintf("%s/workspaces/%s/settings?integration=google_drive&status=connected", frontendURL, workspaceID)
	c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}

// DisconnectGoogleDrive - POST /api/v1/workspaces/:workspace_id/integrations/google_drive/disconnect
func DisconnectGoogleDrive(c *gin.Context) {
	workspaceID := c.Param("id")

	var integration models.WorkspaceIntegration
	if err := database.DB.Where("workspace_id = ? AND integration_type = ?", workspaceID, "google_drive").First(&integration).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Integration not found"})
		return
	}

	// Clear tokens and mark as disconnected
	integration.AccessToken = ""
	integration.RefreshToken = ""
	integration.TokenExpiresAt = nil
	integration.IsConnected = false
	integration.ConnectedEmail = ""
	integration.ConnectedAt = nil

	if err := database.DB.Save(&integration).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to disconnect integration"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Google Drive disconnected"})
}

// ========== Google Drive Operations ==========

// CreateFormFolder - POST /api/v1/forms/:id/integrations/google_drive/folder
// Creates a folder in Google Drive for a form/application
func CreateFormFolder(c *gin.Context) {
	formID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form ID"})
		return
	}

	// Get form
	var form models.Table
	if err := database.DB.First(&form, "id = ?", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	// Get workspace integration
	var integration models.WorkspaceIntegration
	if err := database.DB.Where("workspace_id = ? AND integration_type = ? AND is_connected = ?", form.WorkspaceID, "google_drive", true).First(&integration).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Google Drive not connected for this workspace"})
		return
	}

	// Get Drive client
	ctx := context.Background()
	srv, err := getGoogleDriveClient(ctx, &integration)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to Google Drive"})
		return
	}

	// Parse config to get root folder
	var config models.GoogleDriveConfig
	json.Unmarshal(integration.Config, &config)

	// Create folder for the form
	folderName := services.SanitizeFolderName(form.Name)
	folder, err := googleDriveService.FindOrCreateFolder(ctx, srv, folderName, config.RootFolderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create folder: " + err.Error()})
		return
	}

	// Save form integration settings
	var formIntegration models.FormIntegrationSetting
	err = database.DB.Where("form_id = ? AND workspace_integration_id = ?", formID, integration.ID).First(&formIntegration).Error
	if err != nil {
		formIntegration = models.FormIntegrationSetting{
			FormID:                 formID,
			WorkspaceIntegrationID: integration.ID,
			IsEnabled:              true,
		}
	}
	formIntegration.ExternalFolderID = folder.ID
	formIntegration.ExternalFolderURL = folder.URL

	if err := database.DB.Save(&formIntegration).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save form integration settings"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"folder_id":   folder.ID,
		"folder_name": folder.Name,
		"folder_url":  folder.URL,
	})
}

// CreateApplicantFolder - POST /api/v1/rows/:row_id/integrations/google_drive/folder
// Creates a folder for an applicant in the form's Google Drive folder
func CreateApplicantFolder(c *gin.Context) {
	rowID, err := uuid.Parse(c.Param("row_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid row ID"})
		return
	}

	// Get row with table info
	var row models.Row
	if err := database.DB.Preload("Table").First(&row, "id = ?", rowID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Application not found"})
		return
	}

	// Get form integration settings
	var formIntegration models.FormIntegrationSetting
	if err := database.DB.Preload("WorkspaceIntegration").Where("form_id = ? AND is_enabled = ?", row.TableID, true).First(&formIntegration).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Google Drive not enabled for this form"})
		return
	}

	if !formIntegration.WorkspaceIntegration.IsConnected {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Google Drive not connected"})
		return
	}

	// Check if folder already exists
	var existingFolder models.ApplicantFolder
	if err := database.DB.Where("form_integration_id = ? AND row_id = ?", formIntegration.ID, rowID).First(&existingFolder).Error; err == nil {
		c.JSON(http.StatusOK, gin.H{
			"folder_id":  existingFolder.ExternalFolderID,
			"folder_url": existingFolder.ExternalFolderURL,
			"existing":   true,
		})
		return
	}

	// Get Drive client
	ctx := context.Background()
	srv, err := getGoogleDriveClient(ctx, &formIntegration.WorkspaceIntegration)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to Google Drive"})
		return
	}

	// Parse row data for folder naming
	var rowData map[string]interface{}
	json.Unmarshal(row.Data, &rowData)

	// Generate folder name
	var formSettings models.FormDriveSettings
	json.Unmarshal(formIntegration.Settings, &formSettings)
	folderName := services.GenerateApplicantFolderName(formSettings.ApplicantFolderTemplate, rowData)

	// Create folder
	folder, err := googleDriveService.CreateFolder(ctx, srv, folderName, formIntegration.ExternalFolderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create folder: " + err.Error()})
		return
	}

	// Generate identifier from data
	identifier := folderName
	if email, ok := rowData["email"].(string); ok && email != "" {
		identifier = email
	}

	// Save applicant folder record
	applicantFolder := models.ApplicantFolder{
		FormIntegrationID:   formIntegration.ID,
		RowID:               rowID,
		ApplicantIdentifier: identifier,
		ExternalFolderID:    folder.ID,
		ExternalFolderURL:   folder.URL,
		SyncStatus:          "synced",
	}
	now := time.Now()
	applicantFolder.LastSyncAt = &now

	if err := database.DB.Create(&applicantFolder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save folder record"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"folder_id":  folder.ID,
		"folder_url": folder.URL,
		"name":       folderName,
	})
}

// SyncFileToDrive - POST /api/v1/rows/:row_id/integrations/google_drive/sync-file
// Syncs a file from the row to Google Drive
func SyncFileToDrive(c *gin.Context) {
	rowID, err := uuid.Parse(c.Param("row_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid row ID"})
		return
	}

	var input struct {
		FileID   string `json:"file_id"`
		FileURL  string `json:"file_url" binding:"required"`
		FileName string `json:"file_name" binding:"required"`
		MimeType string `json:"mime_type"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get row
	var row models.Row
	if err := database.DB.First(&row, "id = ?", rowID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Application not found"})
		return
	}

	// Get applicant folder
	var applicantFolder models.ApplicantFolder
	if err := database.DB.Preload("FormIntegration.WorkspaceIntegration").
		Joins("JOIN form_integration_settings ON form_integration_settings.id = applicant_folders.form_integration_id").
		Where("applicant_folders.row_id = ? AND form_integration_settings.form_id = ?", rowID, row.TableID).
		First(&applicantFolder).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No Drive folder found for this application. Create folder first."})
		return
	}

	// Get Drive client
	ctx := context.Background()
	srv, err := getGoogleDriveClient(ctx, &applicantFolder.FormIntegration.WorkspaceIntegration)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to Google Drive"})
		return
	}

	// Upload file
	driveFile, err := googleDriveService.UploadFileFromURL(ctx, srv, input.FileName, input.FileURL, applicantFolder.ExternalFolderID)
	if err != nil {
		// Log sync error
		syncLog := models.FileSyncLog{
			ApplicantFolderID: applicantFolder.ID,
			OriginalFilename:  input.FileName,
			MimeType:          input.MimeType,
			SyncStatus:        "error",
			SyncError:         err.Error(),
		}
		database.DB.Create(&syncLog)

		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload file: " + err.Error()})
		return
	}

	// Parse file ID if provided
	var tableFileID *uuid.UUID
	if input.FileID != "" {
		if id, err := uuid.Parse(input.FileID); err == nil {
			tableFileID = &id
		}
	}

	// Log successful sync
	now := time.Now()
	syncLog := models.FileSyncLog{
		ApplicantFolderID: applicantFolder.ID,
		TableFileID:       tableFileID,
		ExternalFileID:    driveFile.ID,
		ExternalFileURL:   driveFile.URL,
		OriginalFilename:  input.FileName,
		FileSizeBytes:     driveFile.Size,
		MimeType:          driveFile.MimeType,
		SyncStatus:        "synced",
		SyncedAt:          &now,
	}
	database.DB.Create(&syncLog)

	// Update folder last sync time
	applicantFolder.LastSyncAt = &now
	applicantFolder.SyncStatus = "synced"
	database.DB.Save(&applicantFolder)

	c.JSON(http.StatusOK, gin.H{
		"file_id":   driveFile.ID,
		"file_url":  driveFile.URL,
		"file_name": driveFile.Name,
	})
}

// SyncAllFilesToDrive - POST /api/v1/rows/:row_id/integrations/google_drive/sync-all
// Syncs all files from a row to Google Drive
func SyncAllFilesToDrive(c *gin.Context) {
	rowID, err := uuid.Parse(c.Param("row_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid row ID"})
		return
	}

	// Get row with table
	var row models.Row
	if err := database.DB.Preload("Table").First(&row, "id = ?", rowID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Application not found"})
		return
	}

	// Get applicant folder
	var applicantFolder models.ApplicantFolder
	if err := database.DB.Preload("FormIntegration.WorkspaceIntegration").
		Joins("JOIN form_integration_settings ON form_integration_settings.id = applicant_folders.form_integration_id").
		Where("applicant_folders.row_id = ? AND form_integration_settings.form_id = ?", rowID, row.TableID).
		First(&applicantFolder).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No Drive folder found for this application"})
		return
	}

	// Get Drive client
	ctx := context.Background()
	srv, err := getGoogleDriveClient(ctx, &applicantFolder.FormIntegration.WorkspaceIntegration)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to Google Drive"})
		return
	}

	// Get files associated with this row
	var files []models.TableFile
	database.DB.Where("row_id = ? AND deleted_at IS NULL", rowID).Find(&files)

	var syncedFiles []gin.H
	var errors []string

	for _, file := range files {
		// Check if already synced
		var existingSync models.FileSyncLog
		if err := database.DB.Where("table_file_id = ? AND sync_status = ?", file.ID, "synced").First(&existingSync).Error; err == nil {
			// Already synced
			syncedFiles = append(syncedFiles, gin.H{
				"file_id":   existingSync.ExternalFileID,
				"file_url":  existingSync.ExternalFileURL,
				"file_name": file.Filename,
				"skipped":   true,
			})
			continue
		}

		// Upload file
		driveFile, err := googleDriveService.UploadFileFromURL(ctx, srv, file.Filename, file.PublicURL, applicantFolder.ExternalFolderID)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Failed to sync %s: %s", file.Filename, err.Error()))
			continue
		}

		// Log sync
		now := time.Now()
		syncLog := models.FileSyncLog{
			ApplicantFolderID: applicantFolder.ID,
			TableFileID:       &file.ID,
			ExternalFileID:    driveFile.ID,
			ExternalFileURL:   driveFile.URL,
			OriginalFilename:  file.Filename,
			FileSizeBytes:     file.SizeBytes,
			MimeType:          file.MimeType,
			SyncStatus:        "synced",
			SyncedAt:          &now,
		}
		database.DB.Create(&syncLog)

		syncedFiles = append(syncedFiles, gin.H{
			"file_id":   driveFile.ID,
			"file_url":  driveFile.URL,
			"file_name": driveFile.Name,
		})
	}

	// Update folder last sync time
	now := time.Now()
	applicantFolder.LastSyncAt = &now
	applicantFolder.SyncStatus = "synced"
	database.DB.Save(&applicantFolder)

	result := gin.H{
		"synced_files": syncedFiles,
		"total":        len(syncedFiles),
	}
	if len(errors) > 0 {
		result["errors"] = errors
	}

	c.JSON(http.StatusOK, result)
}

// GetFormIntegrationSettings - GET /api/v1/forms/:id/integrations/google_drive
func GetFormIntegrationSettings(c *gin.Context) {
	formID := c.Param("id")

	var formIntegration models.FormIntegrationSetting
	if err := database.DB.Preload("WorkspaceIntegration").
		Joins("JOIN workspace_integrations ON workspace_integrations.id = form_integration_settings.workspace_integration_id").
		Where("form_integration_settings.form_id = ? AND workspace_integrations.integration_type = ?", formID, "google_drive").
		First(&formIntegration).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Integration settings not found"})
		return
	}

	c.JSON(http.StatusOK, formIntegration)
}

// UpdateFormIntegrationSettings - PATCH /api/v1/forms/:id/integrations/google_drive
func UpdateFormIntegrationSettings(c *gin.Context) {
	formID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form ID"})
		return
	}

	// Get form to find workspace
	var form models.Table
	if err := database.DB.First(&form, "id = ?", formID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	// Get workspace integration
	var integration models.WorkspaceIntegration
	if err := database.DB.Where("workspace_id = ? AND integration_type = ?", form.WorkspaceID, "google_drive").First(&integration).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Google Drive not configured for this workspace"})
		return
	}

	var input struct {
		IsEnabled *bool           `json:"is_enabled"`
		Settings  json.RawMessage `json:"settings"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get or create form integration settings
	var formIntegration models.FormIntegrationSetting
	err = database.DB.Where("form_id = ? AND workspace_integration_id = ?", formID, integration.ID).First(&formIntegration).Error
	if err != nil {
		formIntegration = models.FormIntegrationSetting{
			FormID:                 formID,
			WorkspaceIntegrationID: integration.ID,
			IsEnabled:              true,
		}
	}

	if input.IsEnabled != nil {
		formIntegration.IsEnabled = *input.IsEnabled
	}
	if input.Settings != nil {
		formIntegration.Settings = datatypes.JSON(input.Settings)
	}

	if err := database.DB.Save(&formIntegration).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save settings"})
		return
	}

	c.JSON(http.StatusOK, formIntegration)
}

// CreateApplicationSummary - POST /api/v1/rows/:row_id/integrations/google_drive/summary
// Creates and uploads a text summary of the application data
func CreateApplicationSummary(c *gin.Context) {
	rowID, err := uuid.Parse(c.Param("row_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid row ID"})
		return
	}

	// Get row with table
	var row models.Row
	if err := database.DB.Preload("Table").First(&row, "id = ?", rowID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Application not found"})
		return
	}

	// Get applicant folder
	var applicantFolder models.ApplicantFolder
	if err := database.DB.Preload("FormIntegration.WorkspaceIntegration").
		Joins("JOIN form_integration_settings ON form_integration_settings.id = applicant_folders.form_integration_id").
		Where("applicant_folders.row_id = ? AND form_integration_settings.form_id = ?", rowID, row.TableID).
		First(&applicantFolder).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No Drive folder found for this application"})
		return
	}

	// Get Drive client
	ctx := context.Background()
	srv, err := getGoogleDriveClient(ctx, &applicantFolder.FormIntegration.WorkspaceIntegration)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to Google Drive"})
		return
	}

	// Parse row data
	var rowData map[string]interface{}
	json.Unmarshal(row.Data, &rowData)

	// Create summary content
	formName := row.Table.Name
	content := services.CreateFormDataSummary(formName, rowData)

	// Upload as text file
	fileName := fmt.Sprintf("Application_Summary_%s.txt", time.Now().Format("2006-01-02"))
	driveFile, err := googleDriveService.UploadFile(ctx, srv, fileName, "text/plain", bytes.NewReader([]byte(content)), applicantFolder.ExternalFolderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload summary: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"file_id":   driveFile.ID,
		"file_url":  driveFile.URL,
		"file_name": driveFile.Name,
	})
}

// Helper function to get Google Drive client from integration
func getGoogleDriveClient(ctx context.Context, integration *models.WorkspaceIntegration) (*drive.Service, error) {
	if googleDriveService == nil {
		return nil, fmt.Errorf("Google Drive service not initialized")
	}

	// Check if token needs refresh
	if integration.TokenExpiresAt != nil && integration.TokenExpiresAt.Before(time.Now()) {
		// Refresh token
		newToken, err := googleDriveService.RefreshToken(ctx, integration.RefreshToken)
		if err != nil {
			return nil, fmt.Errorf("failed to refresh token: %w", err)
		}

		// Update tokens in database
		integration.AccessToken = newToken.AccessToken
		integration.TokenExpiresAt = &newToken.Expiry
		if newToken.RefreshToken != "" {
			integration.RefreshToken = newToken.RefreshToken
		}
		database.DB.Save(integration)
	}

	expiresAt := time.Now().Add(time.Hour)
	if integration.TokenExpiresAt != nil {
		expiresAt = *integration.TokenExpiresAt
	}

	return googleDriveService.GetDriveClient(ctx, integration.AccessToken, integration.RefreshToken, expiresAt)
}
