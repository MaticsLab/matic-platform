package handlers

import (
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
