package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ListPortalDocuments - GET /api/v1/portal/documents?row_id=xxx
// Returns all documents for a specific application/row
func ListPortalDocuments(c *gin.Context) {
	rowIDStr := c.Query("row_id")
	if rowIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "row_id is required"})
		return
	}

	rowID, err := uuid.Parse(rowIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid row_id format"})
		return
	}

	var documents []models.PortalDocument
	if err := database.DB.Where("row_id = ?", rowID).Order("uploaded_at DESC").Find(&documents).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch documents"})
		return
	}

	// Convert to response format
	response := make([]gin.H, len(documents))
	for i, doc := range documents {
		response[i] = gin.H{
			"id":         doc.ID,
			"name":       doc.Name,
			"url":        doc.URL,
			"size":       doc.Size,
			"mime_type":  doc.MimeType,
			"uploadedAt": doc.UploadedAt.Format(time.RFC3339),
		}
	}

	c.JSON(http.StatusOK, response)
}

// UploadPortalDocument - POST /api/v1/portal/documents
// Uploads a document for an application
func UploadPortalDocument(c *gin.Context) {
	rowIDStr := c.PostForm("row_id")
	if rowIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "row_id is required"})
		return
	}

	rowID, err := uuid.Parse(rowIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid row_id format"})
		return
	}

	// Get the uploaded file
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
		return
	}
	defer file.Close()

	// Validate file size (max 10MB)
	if header.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large. Maximum size is 10MB"})
		return
	}

	// Get the row to find the form_id
	var row models.Row
	if err := database.DB.First(&row, "id = ?", rowID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Application not found"})
		return
	}

	// Generate unique filename
	ext := filepath.Ext(header.Filename)
	filename := fmt.Sprintf("%s_%s%s", uuid.New().String()[:8], strings.TrimSuffix(header.Filename, ext), ext)

	// Create uploads directory if it doesn't exist
	uploadDir := filepath.Join("uploads", "portal", rowID.String())
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Save the file
	filePath := filepath.Join(uploadDir, filename)
	dst, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write file"})
		return
	}

	// Generate URL (in production, this would be a CDN or S3 URL)
	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}
	fileURL := fmt.Sprintf("%s/uploads/portal/%s/%s", baseURL, rowID.String(), filename)

	// Create database record
	document := models.PortalDocument{
		FormID:     row.TableID,
		RowID:      rowID,
		Name:       header.Filename,
		URL:        fileURL,
		Size:       header.Size,
		MimeType:   header.Header.Get("Content-Type"),
		UploadedAt: time.Now(),
	}

	if err := database.DB.Create(&document).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save document record"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":         document.ID,
		"name":       document.Name,
		"url":        document.URL,
		"size":       document.Size,
		"mime_type":  document.MimeType,
		"uploadedAt": document.UploadedAt.Format(time.RFC3339),
	})
}

// DeletePortalDocument - DELETE /api/v1/portal/documents/:id
// Deletes a document
func DeletePortalDocument(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document ID"})
		return
	}

	var document models.PortalDocument
	if err := database.DB.First(&document, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}

	// Delete file from disk (optional, can keep files for audit trail)
	// Note: In production with S3/CDN, you'd delete from there instead

	// Delete from database
	if err := database.DB.Delete(&document).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete document"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Document deleted"})
}
