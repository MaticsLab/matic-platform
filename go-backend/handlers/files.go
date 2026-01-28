package handlers

import (
	"fmt"
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ============================================================================
// TABLE FILES HANDLERS
// ============================================================================

// CreateFileRequest represents the request body for creating a file record
type CreateFileRequest struct {
	TableID          *string  `json:"table_id"`
	RowID            *string  `json:"row_id"`
	FieldID          *string  `json:"field_id"`
	WorkspaceID      *string  `json:"workspace_id"`
	Filename         string   `json:"filename" binding:"required"`
	OriginalFilename string   `json:"original_filename" binding:"required"`
	MimeType         string   `json:"mime_type" binding:"required"`
	SizeBytes        int64    `json:"size_bytes" binding:"required"`
	StorageBucket    string   `json:"storage_bucket"`
	StoragePath      string   `json:"storage_path" binding:"required"`
	PublicURL        string   `json:"public_url"`
	Description      string   `json:"description"`
	AltText          string   `json:"alt_text"`
	Tags             []string `json:"tags"`
}

// UpdateFileRequest represents the request body for updating a file record
type UpdateFileRequest struct {
	Description *string  `json:"description"`
	AltText     *string  `json:"alt_text"`
	Tags        []string `json:"tags"`
}

// FileResponse represents the response with computed fields
type FileResponse struct {
	models.TableFile
	FileCategory  string `json:"file_category"`
	FormattedSize string `json:"formatted_size"`
}

// toResponse converts TableFile to FileResponse with computed fields
func toFileResponse(file models.TableFile) FileResponse {
	return FileResponse{
		TableFile:     file,
		FileCategory:  file.GetFileCategory(),
		FormattedSize: file.FormatSize(),
	}
}

// ListFiles returns files for a table, row, or workspace
// GET /api/v1/files?table_id=xxx&row_id=xxx&field_id=xxx&workspace_id=xxx
func ListFiles(c *gin.Context) {
	tableID := c.Query("table_id")
	rowID := c.Query("row_id")
	fieldID := c.Query("field_id")
	workspaceID := c.Query("workspace_id")

	query := database.DB.Where("is_current = ? AND deleted_at IS NULL", true)

	if tableID != "" {
		query = query.Where("table_id = ?", tableID)
	}
	if rowID != "" {
		query = query.Where("row_id = ?", rowID)
	}
	if fieldID != "" {
		query = query.Where("field_id = ?", fieldID)
	}
	if workspaceID != "" {
		query = query.Where("workspace_id = ?", workspaceID)
	}

	var files []models.TableFile
	if err := query.Order("created_at DESC").Find(&files).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch files"})
		return
	}

	// Convert to response with computed fields
	responses := make([]FileResponse, len(files))
	for i, file := range files {
		responses[i] = toFileResponse(file)
	}

	c.JSON(http.StatusOK, responses)
}

// GetFile returns a single file by ID
// GET /api/v1/files/:id
func GetFile(c *gin.Context) {
	id := c.Param("id")

	var file models.TableFile
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", id).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	c.JSON(http.StatusOK, toFileResponse(file))
}

// GetRowFiles returns all current files for a specific row
// GET /api/v1/rows/:row_id/files
func GetRowFiles(c *gin.Context) {
	rowID := c.Param("row_id")

	var files []models.TableFile
	if err := database.DB.Where("row_id = ? AND is_current = ? AND deleted_at IS NULL", rowID, true).
		Order("created_at DESC").
		Find(&files).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch files"})
		return
	}

	responses := make([]FileResponse, len(files))
	for i, file := range files {
		responses[i] = toFileResponse(file)
	}

	c.JSON(http.StatusOK, responses)
}

// GetTableFiles returns all current files for a specific table
// GET /api/v1/tables/:table_id/files
func GetTableFiles(c *gin.Context) {
	tableID := c.Param("table_id")

	var files []models.TableFile
	if err := database.DB.Where("table_id = ? AND is_current = ? AND deleted_at IS NULL", tableID, true).
		Order("created_at DESC").
		Find(&files).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch files"})
		return
	}

	responses := make([]FileResponse, len(files))
	for i, file := range files {
		responses[i] = toFileResponse(file)
	}

	c.JSON(http.StatusOK, responses)
}

// CreateFile creates a new file record
// POST /api/v1/files
func CreateFile(c *gin.Context) {
	var req CreateFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	file := models.TableFile{
		Filename:         req.Filename,
		OriginalFilename: req.OriginalFilename,
		MimeType:         req.MimeType,
		SizeBytes:        req.SizeBytes,
		StoragePath:      req.StoragePath,
		PublicURL:        req.PublicURL,
		Description:      req.Description,
		AltText:          req.AltText,
		Tags:             req.Tags,
		IsCurrent:        true,
		Version:          1,
	}

	// Set storage bucket with default
	if req.StorageBucket != "" {
		file.StorageBucket = req.StorageBucket
	} else {
		file.StorageBucket = "workspace-assets"
	}

	// Parse optional UUIDs
	if req.TableID != nil && *req.TableID != "" {
		id, err := uuid.Parse(*req.TableID)
		if err == nil {
			file.TableID = &id
		}
	}
	if req.RowID != nil && *req.RowID != "" {
		id, err := uuid.Parse(*req.RowID)
		if err == nil {
			file.RowID = &id
		}
	}
	if req.FieldID != nil && *req.FieldID != "" {
		id, err := uuid.Parse(*req.FieldID)
		if err == nil {
			file.FieldID = &id
		}
	}
	if req.WorkspaceID != nil && *req.WorkspaceID != "" {
		id, err := uuid.Parse(*req.WorkspaceID)
		if err == nil {
			file.WorkspaceID = &id
		}
	}

	// Get uploaded_by from auth context if available
	if userIDStr, exists := middleware.GetUserID(c); exists {
		file.BAUploadedBy = &userIDStr
	}

	if err := database.DB.Create(&file).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file record"})
		return
	}

	c.JSON(http.StatusCreated, toFileResponse(file))
}

// CreateRowFile creates a file record for a specific row
// POST /api/v1/rows/:row_id/files
func CreateRowFile(c *gin.Context) {
	rowID := c.Param("row_id")

	rowUUID, err := uuid.Parse(rowID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid row ID"})
		return
	}

	// Get the row to find table_id
	var row models.Row
	if err := database.DB.First(&row, "id = ?", rowID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Row not found"})
		return
	}

	var req CreateFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	file := models.TableFile{
		TableID:          &row.TableID,
		RowID:            &rowUUID,
		Filename:         req.Filename,
		OriginalFilename: req.OriginalFilename,
		MimeType:         req.MimeType,
		SizeBytes:        req.SizeBytes,
		StoragePath:      req.StoragePath,
		PublicURL:        req.PublicURL,
		Description:      req.Description,
		AltText:          req.AltText,
		Tags:             req.Tags,
		IsCurrent:        true,
		Version:          1,
	}

	// Set storage bucket with default
	if req.StorageBucket != "" {
		file.StorageBucket = req.StorageBucket
	} else {
		file.StorageBucket = "workspace-assets"
	}

	// Parse optional field_id
	if req.FieldID != nil && *req.FieldID != "" {
		id, err := uuid.Parse(*req.FieldID)
		if err == nil {
			file.FieldID = &id
		}
	}

	// Get uploaded_by from auth context if available
	if userIDStr, exists := middleware.GetUserID(c); exists {
		file.BAUploadedBy = &userIDStr
	}

	if err := database.DB.Create(&file).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file record"})
		return
	}

	c.JSON(http.StatusCreated, toFileResponse(file))
}

// UpdateFile updates a file's metadata
// PATCH /api/v1/files/:id
func UpdateFile(c *gin.Context) {
	id := c.Param("id")

	var file models.TableFile
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", id).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	var req UpdateFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.AltText != nil {
		updates["alt_text"] = *req.AltText
	}
	if req.Tags != nil {
		updates["tags"] = req.Tags
	}

	if len(updates) > 0 {
		if err := database.DB.Model(&file).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update file"})
			return
		}
	}

	// Reload file
	database.DB.First(&file, "id = ?", id)
	c.JSON(http.StatusOK, toFileResponse(file))
}

// DeleteFile soft-deletes a file
// DELETE /api/v1/files/:id
func DeleteFile(c *gin.Context) {
	id := c.Param("id")

	result := database.DB.Model(&models.TableFile{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Updates(map[string]interface{}{
			"deleted_at": database.DB.NowFunc(),
			"is_current": false,
		})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete file"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "File deleted"})
}

// GetFileVersions returns all versions of a file
// GET /api/v1/files/:id/versions
func GetFileVersions(c *gin.Context) {
	id := c.Param("id")

	// First get the file to find the chain
	var file models.TableFile
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", id).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Find all files in the version chain (by row_id + field_id)
	var files []models.TableFile
	query := database.DB.Where("deleted_at IS NULL")

	if file.RowID != nil && file.FieldID != nil {
		query = query.Where("row_id = ? AND field_id = ?", file.RowID, file.FieldID)
	} else {
		// Just get this file if no row/field context
		files = append(files, file)
		responses := make([]FileResponse, len(files))
		for i, f := range files {
			responses[i] = toFileResponse(f)
		}
		c.JSON(http.StatusOK, responses)
		return
	}

	if err := query.Order("version DESC").Find(&files).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch file versions"})
		return
	}

	responses := make([]FileResponse, len(files))
	for i, f := range files {
		responses[i] = toFileResponse(f)
	}

	c.JSON(http.StatusOK, responses)
}

// CreateFileVersion creates a new version of an existing file
// POST /api/v1/files/:id/versions
func CreateFileVersion(c *gin.Context) {
	parentID := c.Param("id")

	parentUUID, err := uuid.Parse(parentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	// Get the parent file
	var parentFile models.TableFile
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", parentID).First(&parentFile).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parent file not found"})
		return
	}

	var req CreateFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Start transaction
	tx := database.DB.Begin()

	// Mark parent as not current
	if err := tx.Model(&parentFile).Update("is_current", false).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update parent file"})
		return
	}

	// Create new version
	newFile := models.TableFile{
		TableID:          parentFile.TableID,
		RowID:            parentFile.RowID,
		FieldID:          parentFile.FieldID,
		WorkspaceID:      parentFile.WorkspaceID,
		Filename:         req.Filename,
		OriginalFilename: req.OriginalFilename,
		MimeType:         req.MimeType,
		SizeBytes:        req.SizeBytes,
		StorageBucket:    parentFile.StorageBucket,
		StoragePath:      req.StoragePath,
		PublicURL:        req.PublicURL,
		Description:      parentFile.Description,
		AltText:          parentFile.AltText,
		Tags:             parentFile.Tags,
		Version:          parentFile.Version + 1,
		ParentFileID:     &parentUUID,
		IsCurrent:        true,
	}

	// Get uploaded_by from auth context if available
	if userIDStr, exists := middleware.GetUserID(c); exists {
		newFile.BAUploadedBy = &userIDStr
	}

	if err := tx.Create(&newFile).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file version"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusCreated, toFileResponse(newFile))
}

// GetFileStats returns file statistics for a row
// GET /api/v1/rows/:row_id/files/stats
func GetFileStats(c *gin.Context) {
	rowID := c.Param("row_id")

	var stats struct {
		FileCount      int64 `json:"file_count"`
		TotalSizeBytes int64 `json:"total_size_bytes"`
	}

	err := database.DB.Model(&models.TableFile{}).
		Where("row_id = ? AND is_current = ? AND deleted_at IS NULL", rowID, true).
		Select("COUNT(*) as file_count, COALESCE(SUM(size_bytes), 0) as total_size_bytes").
		Scan(&stats).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get file stats"})
		return
	}

	// Format total size
	var formattedSize string
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)
	switch {
	case stats.TotalSizeBytes >= GB:
		formattedSize = formatBytes(stats.TotalSizeBytes, GB, "GB")
	case stats.TotalSizeBytes >= MB:
		formattedSize = formatBytes(stats.TotalSizeBytes, MB, "MB")
	case stats.TotalSizeBytes >= KB:
		formattedSize = formatBytes(stats.TotalSizeBytes, KB, "KB")
	default:
		formattedSize = formatBytesSimple(stats.TotalSizeBytes)
	}

	c.JSON(http.StatusOK, gin.H{
		"file_count":       stats.FileCount,
		"total_size_bytes": stats.TotalSizeBytes,
		"formatted_size":   formattedSize,
	})
}

func formatBytes(bytes int64, divisor int64, unit string) string {
	return fmt.Sprintf("%.2f %s", float64(bytes)/float64(divisor), unit)
}

func formatBytesSimple(bytes int64) string {
	return fmt.Sprintf("%d bytes", bytes)
}
