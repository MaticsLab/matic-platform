package handlers

import (
	"encoding/base64"
	"net/http"

	"github.com/Jsanchez767/matic-platform/services"

	"github.com/gin-gonic/gin"
)

// DocumentPIIRequest represents a request to analyze a document for PII
type DocumentPIIRequest struct {
	DocumentURL  string            `json:"document_url" binding:"required"`
	DocumentType string            `json:"document_type"` // "pdf", "image" - auto-detected if not provided
	KnownPII     map[string]string `json:"known_pii"`     // Known PII from form data
	RedactAll    bool              `json:"redact_all"`    // Whether to detect all PII or just known
}

// AnalyzeDocumentPII handles requests to detect PII in documents
// POST /api/v1/documents/analyze-pii
func AnalyzeDocumentPII(c *gin.Context) {
	var req DocumentPIIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Create Gemini client
	geminiClient := services.NewGeminiClient()

	// Detect PII
	result, err := geminiClient.DetectPII(c.Request.Context(), services.PIIDetectionRequest{
		DocumentURL:  req.DocumentURL,
		DocumentType: req.DocumentType,
		KnownPII:     req.KnownPII,
		RedactAll:    req.RedactAll,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to analyze document",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetRedactedDocument analyzes a document and returns it with PII redacted
// POST /api/v1/documents/redact
func GetRedactedDocument(c *gin.Context) {
	var req DocumentPIIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Create Gemini client
	geminiClient := services.NewGeminiClient()

	// Step 1: Use Gemini to detect PII locations with bounding boxes
	result, err := geminiClient.DetectPII(c.Request.Context(), services.PIIDetectionRequest{
		DocumentURL:  req.DocumentURL,
		DocumentType: req.DocumentType,
		KnownPII:     req.KnownPII,
		RedactAll:    req.RedactAll,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to analyze document",
			"details": err.Error(),
		})
		return
	}

	// If no PII found, return original
	if len(result.Locations) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message":      "No PII detected",
			"original_url": req.DocumentURL,
		})
		return
	}

	// Step 2: Apply redactions to the image using our backend
	redactedData, contentType, err := services.RedactImage(req.DocumentURL, result.Locations)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to redact document",
			"details": err.Error(),
		})
		return
	}

	// Return redacted image directly
	c.Data(http.StatusOK, contentType, redactedData)
}

// GetRedactedDocumentBase64 returns a redacted document as base64
// POST /api/v1/documents/redact/base64
func GetRedactedDocumentBase64(c *gin.Context) {
	var req DocumentPIIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Create Gemini client
	geminiClient := services.NewGeminiClient()

	// Step 1: Use Gemini to detect PII locations with bounding boxes
	result, err := geminiClient.DetectPII(c.Request.Context(), services.PIIDetectionRequest{
		DocumentURL:  req.DocumentURL,
		DocumentType: req.DocumentType,
		KnownPII:     req.KnownPII,
		RedactAll:    req.RedactAll,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to analyze document",
			"details": err.Error(),
		})
		return
	}

	// If no PII found, return info
	if len(result.Locations) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"redacted":       false,
			"original_url":   req.DocumentURL,
			"pii_count":      0,
			"total_redacted": 0,
			"message":        "No PII detected",
		})
		return
	}

	// Step 2: Apply redactions to the image using our backend
	redactedData, contentType, err := services.RedactImage(req.DocumentURL, result.Locations)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to redact document",
			"details": err.Error(),
		})
		return
	}

	// Encode as base64
	base64Data := base64.StdEncoding.EncodeToString(redactedData)

	// Collect PII types
	piiTypes := make([]string, 0)
	typeSet := make(map[string]bool)
	for _, loc := range result.Locations {
		if !typeSet[loc.Type] {
			typeSet[loc.Type] = true
			piiTypes = append(piiTypes, loc.Type)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"redacted":       true,
		"content_type":   contentType,
		"data":           base64Data,
		"data_url":       "data:" + contentType + ";base64," + base64Data,
		"pii_count":      len(result.Locations),
		"pii_types":      piiTypes,
		"total_redacted": len(result.Locations),
		"processing_ms":  result.ProcessingMS,
	})
}

// BatchAnalyzeDocumentsPII handles requests to analyze multiple documents
// POST /api/v1/documents/analyze-pii/batch
func BatchAnalyzeDocumentsPII(c *gin.Context) {
	var req struct {
		Documents []DocumentPIIRequest `json:"documents" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	if len(req.Documents) > 10 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Maximum 10 documents per batch"})
		return
	}

	geminiClient := services.NewGeminiClient()
	results := make([]services.PIIDetectionResponse, len(req.Documents))

	for i, doc := range req.Documents {
		result, err := geminiClient.DetectPII(c.Request.Context(), services.PIIDetectionRequest{
			DocumentURL:  doc.DocumentURL,
			DocumentType: doc.DocumentType,
			KnownPII:     doc.KnownPII,
			RedactAll:    doc.RedactAll,
		})

		if err != nil {
			results[i] = services.PIIDetectionResponse{
				Error: err.Error(),
			}
		} else {
			results[i] = *result
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"results": results,
		"total":   len(results),
	})
}
