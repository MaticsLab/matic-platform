package handlers

import (
	"net/http"

	"github.com/Jsanchez767/matic-platform/services"
	"github.com/gin-gonic/gin"
)

// isKnownBucketAlias validates a client-supplied bucket name against the two buckets
// this app actually provisions — never let a caller pick an arbitrary S3 bucket.
func isKnownBucketAlias(bucket string) bool {
	return bucket == services.BucketWorkspaceAssets || bucket == services.BucketUserAssets
}

// UploadStorageObject handles authenticated file uploads (staff and logged-in
// applicants) to either the workspace-assets or user-assets bucket.
// POST /api/v1/storage/upload (multipart form: bucket, path, file)
func UploadStorageObject(c *gin.Context) {
	bucket := c.PostForm("bucket")
	if !isKnownBucketAlias(bucket) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bucket must be workspace-assets or user-assets"})
		return
	}

	storagePath := c.PostForm("path")
	if storagePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "path is required"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read uploaded file"})
		return
	}
	defer file.Close()

	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	publicURL, err := services.UploadObject(bucket, storagePath, file, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"storagePath": storagePath,
		"publicUrl":   publicURL,
		"bucket":      bucket,
	})
}

// DeleteStorageObject handles authenticated deletes.
// DELETE /api/v1/storage/object  { "bucket": "...", "path": "..." }
func DeleteStorageObject(c *gin.Context) {
	var req struct {
		Bucket string `json:"bucket" binding:"required"`
		Path   string `json:"path" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !isKnownBucketAlias(req.Bucket) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bucket must be workspace-assets or user-assets"})
		return
	}

	if err := services.DeleteObject(req.Bucket, req.Path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// GetStorageObject streams an object back to the browser. Public/unauthenticated,
// matching the public-bucket behavior these buckets had on Supabase Storage.
// GET /api/v1/storage/object/:bucket/*path
func GetStorageObject(c *gin.Context) {
	bucket := c.Param("bucket")
	if !isKnownBucketAlias(bucket) {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	// Gin's *path wildcard includes the leading "/" — strip it.
	storagePath := c.Param("path")
	if len(storagePath) > 0 && storagePath[0] == '/' {
		storagePath = storagePath[1:]
	}
	if storagePath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	body, contentType, err := services.GetObject(bucket, storagePath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "object not found"})
		return
	}
	defer body.Close()

	c.Header("Cache-Control", "public, max-age=3600")
	c.DataFromReader(http.StatusOK, -1, contentType, body, nil)
}
