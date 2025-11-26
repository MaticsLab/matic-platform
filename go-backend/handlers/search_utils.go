package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetSearchSuggestions returns search suggestions based on existing entities
func GetSearchSuggestions(c *gin.Context) {
	query := c.Query("q")
	workspaceID := c.Query("workspace_id")
	limit := 5

	if limitParam := c.Query("limit"); limitParam != "" {
		var err error
		if _, err = uuid.Parse(limitParam); err == nil {
			// Parse int
			var l int
			if _, err = fmt.Sscanf(limitParam, "%d", &l); err == nil {
				limit = l
			}
		}
	}

	if query == "" || workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing query or workspace_id"})
		return
	}

	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	var suggestions []string
	searchPattern := strings.ToLower(query) + "%"

	// Get table name suggestions
	var tables []models.Table
	database.DB.Where("workspace_id = ? AND icon != 'form' AND LOWER(name) LIKE ?", workspaceUUID, searchPattern).
		Limit(limit).
		Select("name").
		Find(&tables)
	for _, t := range tables {
		suggestions = append(suggestions, t.Name)
	}

	// Get form name suggestions
	var forms []models.Table
	database.DB.Where("workspace_id = ? AND icon = 'form' AND LOWER(name) LIKE ?", workspaceUUID, searchPattern).
		Limit(limit - len(suggestions)).
		Select("name").
		Find(&forms)
	for _, f := range forms {
		suggestions = append(suggestions, f.Name)
	}

	// Get hub name suggestions
	if len(suggestions) < limit {
		var hubs []models.ActivitiesHub
		database.DB.Where("workspace_id = ? AND LOWER(name) LIKE ?", workspaceUUID, searchPattern).
			Limit(limit - len(suggestions)).
			Select("name").
			Find(&hubs)
		for _, h := range hubs {
			suggestions = append(suggestions, h.Name)
		}
	}

	// Limit to requested count
	if len(suggestions) > limit {
		suggestions = suggestions[:limit]
	}

	c.JSON(http.StatusOK, gin.H{
		"suggestions": suggestions,
	})
}

// GetRecentSearches returns recent searches for a workspace
func GetRecentSearches(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	limit := 10

	if limitParam := c.Query("limit"); limitParam != "" {
		var l int
		if _, err := fmt.Sscanf(limitParam, "%d", &l); err == nil {
			limit = l
		}
	}

	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing workspace_id"})
		return
	}

	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	var searchHistory []models.SearchHistory
	database.DB.Where("workspace_id = ?", workspaceUUID).
		Order("created_at DESC").
		Limit(limit).
		Find(&searchHistory)

	// Extract unique queries
	seen := make(map[string]bool)
	var searches []string
	for _, sh := range searchHistory {
		if !seen[sh.Query] && sh.Query != "" {
			searches = append(searches, sh.Query)
			seen[sh.Query] = true
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"searches": searches,
	})
}

// SaveSearchHistory saves a search query to history
func SaveSearchHistory(c *gin.Context) {
	var request struct {
		WorkspaceID string `json:"workspace_id" binding:"required"`
		Query       string `json:"query" binding:"required"`
		ResultCount int    `json:"result_count"`
		UserID      string `json:"user_id"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	workspaceUUID, err := uuid.Parse(request.WorkspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	history := models.SearchHistory{
		WorkspaceID: workspaceUUID,
		Query:       request.Query,
		ResultCount: request.ResultCount,
		CreatedAt:   time.Now(),
	}

	if request.UserID != "" {
		userUUID, err := uuid.Parse(request.UserID)
		if err == nil {
			history.UserID = userUUID
		}
	}

	if err := database.DB.Create(&history).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save search history"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Search history saved",
		"id":      history.ID,
	})
}

// GetPopularSearches returns most popular searches in a workspace
func GetPopularSearches(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	limit := 5

	if limitParam := c.Query("limit"); limitParam != "" {
		var l int
		if _, err := fmt.Sscanf(limitParam, "%d", &l); err == nil {
			limit = l
		}
	}

	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing workspace_id"})
		return
	}

	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	// Get popular searches (grouped by query, counted)
	type PopularSearch struct {
		Query string `json:"query"`
		Count int    `json:"count"`
	}

	var popularSearches []PopularSearch
	database.DB.Raw(`
		SELECT query, COUNT(*) as count 
		FROM search_histories 
		WHERE workspace_id = ? 
		AND query != ''
		AND created_at > NOW() - INTERVAL '30 days'
		GROUP BY query 
		ORDER BY count DESC 
		LIMIT ?
	`, workspaceUUID, limit).Scan(&popularSearches)

	c.JSON(http.StatusOK, gin.H{
		"searches": popularSearches,
	})
}

// ClearSearchHistory clears search history for a workspace
func ClearSearchHistory(c *gin.Context) {
	workspaceID := c.Param("workspace_id")

	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	if err := database.DB.Where("workspace_id = ?", workspaceUUID).Delete(&models.SearchHistory{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Search history cleared",
	})
}
