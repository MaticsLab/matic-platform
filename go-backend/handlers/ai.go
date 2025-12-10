package handlers

import (
	"net/http"

	"github.com/Jsanchez767/matic-platform/config"
	"github.com/Jsanchez767/matic-platform/services"
	"github.com/gin-gonic/gin"
)

type TranslateInput struct {
	Content        map[string]string `json:"content"`
	TargetLanguage string            `json:"target_language"`
}

func TranslateContent(c *gin.Context) {
	var input TranslateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cfg := config.LoadConfig()
	if cfg.CohereAPIKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI service not configured"})
		return
	}

	client := services.NewCohereClient(cfg.CohereAPIKey)
	translated, err := client.TranslateJSON(input.Content, input.TargetLanguage)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Translation failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"translations": translated})
}
