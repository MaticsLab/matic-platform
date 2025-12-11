package handlers

import (
	"log"
	"net/http"

	"github.com/Jsanchez767/matic-platform/config"
	"github.com/Jsanchez767/matic-platform/services"
	"github.com/gin-gonic/gin"
)

type TranslateInput struct {
	Content        map[string]string `json:"content"`
	TargetLanguage string            `json:"target_language"`
	Format         string            `json:"format,omitempty"` // "legacy" or "i18next" (default: auto-detect)
}

func TranslateContent(c *gin.Context) {
	var input TranslateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("🌐 Translation request: %d items to %s (format: %s)",
		len(input.Content), input.TargetLanguage, input.Format)

	cfg := config.LoadConfig()
	if cfg.CohereAPIKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI service not configured"})
		return
	}

	client := services.NewCohereClient(cfg.CohereAPIKey)
	translated, err := client.TranslateJSON(input.Content, input.TargetLanguage)
	if err != nil {
		log.Printf("❌ Translation failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Translation failed: " + err.Error()})
		return
	}

	log.Printf("✅ Translation completed: %d items translated", len(translated))
	c.JSON(http.StatusOK, gin.H{"translations": translated})
}
