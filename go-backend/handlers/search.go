package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// SearchResult represents a search result item
type SearchResult struct {
	ID          string                 `json:"id"`
	Title       string                 `json:"title"`
	Subtitle    string                 `json:"subtitle,omitempty"`
	Description string                 `json:"description,omitempty"`
	Type        string                 `json:"type"`
	URL         string                 `json:"url"`
	WorkspaceID string                 `json:"workspace_id"`
	Score       float64                `json:"score"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	Path        string                 `json:"path,omitempty"`
	Highlights  []string               `json:"highlights,omitempty"`
}

// SearchResponse represents the search API response
type SearchResponse struct {
	Results     []SearchResult `json:"results"`
	Total       int            `json:"total"`
	Query       string         `json:"query"`
	Took        int            `json:"took"` // milliseconds
	Suggestions []string       `json:"suggestions,omitempty"`
	UsedFuzzy   bool           `json:"used_fuzzy,omitempty"`
}

// SmartSearch uses the database smart_search() function for AI-optimized search
func SmartSearch(c *gin.Context) {
	startTime := time.Now()

	query := c.Query("q")
	workspaceID := c.Query("workspace_id")

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'q' is required"})
		return
	}

	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'workspace_id' is required"})
		return
	}

	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	// Build filters JSON
	filters := map[string]interface{}{}
	if hubType := c.Query("hub_type"); hubType != "" {
		filters["hub_type"] = hubType
	}
	if entityType := c.Query("entity_type"); entityType != "" {
		filters["entity_type"] = entityType
	}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	filtersJSON, _ := json.Marshal(filters)

	limit := 50
	if limitParam := c.Query("limit"); limitParam != "" {
		fmt.Sscanf(limitParam, "%d", &limit)
	}

	// Get workspace for URL generation
	var workspace models.Workspace
	if err := database.DB.Where("id = ?", workspaceUUID).First(&workspace).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	// Try smart_search first (full-text)
	var smartResults []models.SmartSearchResult
	database.DB.Raw(`
		SELECT * FROM smart_search($1, $2, $3::jsonb, $4)
	`, workspaceUUID, query, string(filtersJSON), limit).Scan(&smartResults)

	usedFuzzy := false

	// If no results, try fuzzy search
	if len(smartResults) == 0 {
		database.DB.Raw(`
			SELECT * FROM smart_search_fuzzy($1, $2, $3::jsonb, $4)
		`, workspaceUUID, query, string(filtersJSON), limit).Scan(&smartResults)
		usedFuzzy = len(smartResults) > 0
	}

	// Convert to SearchResult format
	var results []SearchResult
	for _, sr := range smartResults {
		// Build URL based on entity type
		var url, path string
		switch sr.EntityType {
		case "table":
			url = fmt.Sprintf("/workspace/%s/table/%s", workspace.Slug, sr.EntityID)
			path = fmt.Sprintf("Workspace / Tables / %s", sr.Title)
		case "row":
			if sr.TableID != nil {
				url = fmt.Sprintf("/workspace/%s/table/%s?row=%s", workspace.Slug, sr.TableID, sr.EntityID)
				path = fmt.Sprintf("Workspace / %s / Row", sr.Title)
			}
		case "form":
			url = fmt.Sprintf("/workspace/%s/form/%s", workspace.Slug, sr.EntityID)
			path = fmt.Sprintf("Workspace / Forms / %s", sr.Title)
		default:
			url = fmt.Sprintf("/workspace/%s", workspace.Slug)
		}

		// Parse metadata
		var metadata map[string]interface{}
		if sr.Metadata != nil {
			json.Unmarshal(sr.Metadata, &metadata)
		}

		results = append(results, SearchResult{
			ID:          sr.EntityID.String(),
			Title:       sr.Title,
			Subtitle:    sr.Subtitle,
			Description: sr.ContentSnippet,
			Type:        sr.EntityType,
			URL:         url,
			WorkspaceID: workspaceID,
			Score:       sr.Score,
			Metadata:    metadata,
			Path:        path,
			Highlights:  extractHighlights(sr.ContentSnippet),
		})
	}

	took := int(time.Since(startTime).Milliseconds())

	c.JSON(http.StatusOK, SearchResponse{
		Results:   results,
		Total:     len(results),
		Query:     query,
		Took:      took,
		UsedFuzzy: usedFuzzy,
	})
}

// extractHighlights extracts highlighted text from content snippet
func extractHighlights(snippet string) []string {
	var highlights []string
	parts := strings.Split(snippet, "<mark>")
	for i := 1; i < len(parts); i++ {
		if idx := strings.Index(parts[i], "</mark>"); idx > 0 {
			highlights = append(highlights, parts[i][:idx])
		}
	}
	return highlights
}

// SearchWorkspace searches across all entities in a workspace (legacy, use SmartSearch)
func SearchWorkspace(c *gin.Context) {
	startTime := time.Now()

	query := c.Query("q")
	workspaceID := c.Query("workspace_id")

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'q' is required"})
		return
	}

	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'workspace_id' is required"})
		return
	}

	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace_id"})
		return
	}

	var results []SearchResult

	// Get workspace slug for URL generation
	var workspace models.Workspace
	if err := database.DB.Where("id = ?", workspaceUUID).First(&workspace).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	// Search Data Tables
	tableResults := searchDataTables(workspaceUUID, workspace.Slug, query)
	results = append(results, tableResults...)

	// Search Forms
	formResults := searchForms(workspaceUUID, workspace.Slug, query)
	results = append(results, formResults...)

	// Search Table Rows (if query is long enough)
	if len(query) >= 3 {
		rowResults := searchTableRows(workspaceUUID, workspace.Slug, query)
		results = append(results, rowResults...)
	}

	// Sort by score
	sortByScore(results)

	// Limit to top 50 results
	if len(results) > 50 {
		results = results[:50]
	}

	took := int(time.Since(startTime).Milliseconds())

	c.JSON(http.StatusOK, SearchResponse{
		Results: results,
		Total:   len(results),
		Query:   query,
		Took:    took,
	})
}

// searchDataTables searches for data tables
func searchDataTables(workspaceID uuid.UUID, workspaceSlug, query string) []SearchResult {
	var tables []models.Table
	searchPattern := "%" + strings.ToLower(query) + "%"

	database.DB.Preload("Fields").
		Where("workspace_id = ? AND icon != 'form' AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)",
			workspaceID, searchPattern, searchPattern).
		Limit(20).
		Find(&tables)

	var results []SearchResult
	for _, table := range tables {
		score := calculateScore(table.Name, query)
		if descScore := calculateScore(table.Description, query); descScore > score {
			score = descScore
		}

		results = append(results, SearchResult{
			ID:          table.ID.String(),
			Title:       table.Name,
			Subtitle:    table.Description,
			Description: table.Description,
			Type:        "table",
			URL:         fmt.Sprintf("/workspace/%s/table/%s", workspaceSlug, table.ID),
			WorkspaceID: workspaceID.String(),
			Score:       score,
			Metadata: map[string]interface{}{
				"columnCount": len(table.Fields),
				"lastUpdated": table.UpdatedAt,
				"createdAt":   table.CreatedAt,
			},
			Path: fmt.Sprintf("Workspace / Tables / %s", table.Name),
		})
	}

	return results
}

// searchForms searches for forms
func searchForms(workspaceID uuid.UUID, workspaceSlug, query string) []SearchResult {
	var forms []models.Table
	searchPattern := "%" + strings.ToLower(query) + "%"

	database.DB.Preload("Fields").
		Where("workspace_id = ? AND icon = 'form' AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)",
			workspaceID, searchPattern, searchPattern).
		Limit(20).
		Find(&forms)

	var results []SearchResult
	for _, form := range forms {
		score := calculateScore(form.Name, query)
		if descScore := calculateScore(form.Description, query); descScore > score {
			score = descScore
		}

		// Count submissions
		var submissionCount int64
		database.DB.Model(&models.Row{}).Where("table_id = ?", form.ID).Count(&submissionCount)

		// Check if published
		isPublished := false
		var view models.View
		if err := database.DB.Where("table_id = ? AND type = ?", form.ID, "form").First(&view).Error; err == nil {
			var config map[string]interface{}
			json.Unmarshal(view.Config, &config)
			if val, ok := config["is_published"].(bool); ok {
				isPublished = val
			}
		}

		results = append(results, SearchResult{
			ID:          form.ID.String(),
			Title:       form.Name,
			Subtitle:    form.Description,
			Description: form.Description,
			Type:        "form",
			URL:         fmt.Sprintf("/workspace/%s/form/%s", workspaceSlug, form.ID),
			WorkspaceID: workspaceID.String(),
			Score:       score,
			Metadata: map[string]interface{}{
				"fieldCount":      len(form.Fields),
				"submissionCount": submissionCount,
				"published":       isPublished,
				"lastUpdated":     form.UpdatedAt,
				"createdAt":       form.CreatedAt,
			},
			Path: fmt.Sprintf("Workspace / Forms / %s", form.Name),
		})
	}

	return results
}

// searchTableRows searches within table row data (JSONB search)
func searchTableRows(workspaceID uuid.UUID, workspaceSlug, query string) []SearchResult {
	var results []SearchResult

	// Get all tables in workspace
	var tables []models.Table
	database.DB.Where("workspace_id = ? AND icon != 'form'", workspaceID).Limit(10).Find(&tables)

	for _, table := range tables {
		// Search rows in this table
		var rows []models.Row
		searchPattern := "%" + strings.ToLower(query) + "%"

		// Search in JSONB data column using PostgreSQL operators
		database.DB.Where("table_id = ? AND LOWER(data::text) LIKE ?", table.ID, searchPattern).
			Limit(5).
			Find(&rows)

		for _, row := range rows {
			// Extract first few values for subtitle
			subtitle := extractRowPreview(row.Data)

			results = append(results, SearchResult{
				ID:          row.ID.String(),
				Title:       fmt.Sprintf("Row in %s", table.Name),
				Subtitle:    subtitle,
				Type:        "row",
				URL:         fmt.Sprintf("/workspace/%s/table/%s?row=%s", workspaceSlug, table.ID, row.ID),
				WorkspaceID: workspaceID.String(),
				Score:       0.5, // Lower score for row matches
				Metadata: map[string]interface{}{
					"tableName":   table.Name,
					"tableId":     table.ID,
					"position":    row.Position,
					"lastUpdated": row.UpdatedAt,
				},
				Path: fmt.Sprintf("Workspace / %s / Row %d", table.Name, row.Position),
			})
		}
	}

	return results
}

// extractRowPreview creates a preview string from row data
func extractRowPreview(data datatypes.JSON) string {
	var dataMap map[string]interface{}
	if err := json.Unmarshal([]byte(data), &dataMap); err != nil {
		return ""
	}

	var preview []string
	count := 0

	for key, value := range dataMap {
		if count >= 3 {
			break
		}
		if value != nil {
			valueStr := fmt.Sprintf("%v", value)
			if len(valueStr) > 50 {
				valueStr = valueStr[:50] + "..."
			}
			preview = append(preview, fmt.Sprintf("%s: %s", key, valueStr))
			count++
		}
	}

	return strings.Join(preview, " | ")
}

// calculateScore calculates a relevance score for a match
func calculateScore(text, query string) float64 {
	if text == "" {
		return 0.0
	}

	lowerText := strings.ToLower(text)
	lowerQuery := strings.ToLower(query)

	// Exact match
	if lowerText == lowerQuery {
		return 1.0
	}

	// Starts with query
	if strings.HasPrefix(lowerText, lowerQuery) {
		return 0.9
	}

	// Contains whole query
	if strings.Contains(lowerText, lowerQuery) {
		return 0.7
	}

	// Word-by-word match
	queryWords := strings.Fields(lowerQuery)
	textWords := strings.Fields(lowerText)

	matchCount := 0
	for _, qWord := range queryWords {
		for _, tWord := range textWords {
			if strings.Contains(tWord, qWord) {
				matchCount++
				break
			}
		}
	}

	if len(queryWords) == 0 {
		return 0.0
	}

	return float64(matchCount) / float64(len(queryWords)) * 0.6
}

// sortByScore sorts results by score in descending order
func sortByScore(results []SearchResult) {
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].Score > results[i].Score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}
}

// SearchTableRows searches within a specific table's rows
func SearchTableRows(c *gin.Context) {
	startTime := time.Now()

	tableID := c.Param("id")
	query := c.Query("q")

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'q' is required"})
		return
	}

	tableUUID, err := uuid.Parse(tableID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID"})
		return
	}

	// Get table info
	var table models.Table
	if err := database.DB.Where("id = ?", tableUUID).First(&table).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table not found"})
		return
	}

	// Get workspace for URL generation
	var workspace models.Workspace
	if err := database.DB.Where("id = ?", table.WorkspaceID).First(&workspace).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	// Search rows
	var rows []models.Row
	searchPattern := "%" + strings.ToLower(query) + "%"

	// Get columns to filter (if specified)
	columnsParam := c.Query("columns")
	var columnFilter []string
	if columnsParam != "" {
		columnFilter = strings.Split(columnsParam, ",")
	}

	// Build query
	dbQuery := database.DB.Where("table_id = ?", tableUUID)

	if len(columnFilter) > 0 {
		// Search only in specific columns
		var conditions []string
		var args []interface{}
		for _, col := range columnFilter {
			conditions = append(conditions, fmt.Sprintf("LOWER(data->>'%s') LIKE ?", col))
			args = append(args, searchPattern)
		}
		dbQuery = dbQuery.Where(strings.Join(conditions, " OR "), args...)
	} else {
		// Search in all data
		dbQuery = dbQuery.Where("LOWER(data::text) LIKE ?", searchPattern)
	}

	limit := 20
	if limitParam := c.Query("limit"); limitParam != "" {
		fmt.Sscanf(limitParam, "%d", &limit)
	}

	dbQuery.Limit(limit).Find(&rows)

	// Convert to search results
	var results []SearchResult
	for _, row := range rows {
		subtitle := extractRowPreview(row.Data)

		results = append(results, SearchResult{
			ID:          row.ID.String(),
			Title:       fmt.Sprintf("Row %d", row.Position),
			Subtitle:    subtitle,
			Type:        "row",
			URL:         fmt.Sprintf("/workspace/%s/table/%s?row=%s", workspace.Slug, table.ID, row.ID),
			WorkspaceID: table.WorkspaceID.String(),
			Score:       0.8,
			Metadata: map[string]interface{}{
				"tableName": table.Name,
				"tableId":   table.ID,
				"position":  row.Position,
				"rowData":   row.Data,
			},
			Path: fmt.Sprintf("%s / Row %d", table.Name, row.Position),
		})
	}

	took := int(time.Since(startTime).Milliseconds())

	c.JSON(http.StatusOK, SearchResponse{
		Results: results,
		Total:   len(results),
		Query:   query,
		Took:    took,
	})
}

// SearchFormSubmissions searches within form submissions
func SearchFormSubmissions(c *gin.Context) {
	startTime := time.Now()

	formID := c.Param("id")
	query := c.Query("q")

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'q' is required"})
		return
	}

	formUUID, err := uuid.Parse(formID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form ID"})
		return
	}

	// Get form info
	var form models.Table
	if err := database.DB.Where("id = ?", formUUID).First(&form).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	// Get workspace for URL generation
	var workspace models.Workspace
	if err := database.DB.Where("id = ?", form.WorkspaceID).First(&workspace).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	// Search submissions
	var submissions []models.Row
	searchPattern := "%" + strings.ToLower(query) + "%"

	// Get fields to filter (if specified)
	fieldsParam := c.Query("fields")
	var fieldFilter []string
	if fieldsParam != "" {
		fieldFilter = strings.Split(fieldsParam, ",")
	}

	// Build query
	dbQuery := database.DB.Where("table_id = ?", formUUID)

	if len(fieldFilter) > 0 {
		// Search only in specific fields
		var conditions []string
		var args []interface{}
		for _, field := range fieldFilter {
			conditions = append(conditions, fmt.Sprintf("LOWER(data->>'%s') LIKE ?", field))
			args = append(args, searchPattern)
		}
		dbQuery = dbQuery.Where(strings.Join(conditions, " OR "), args...)
	} else {
		// Search in all data
		dbQuery = dbQuery.Where("LOWER(data::text) LIKE ?", searchPattern)
	}

	limit := 20
	if limitParam := c.Query("limit"); limitParam != "" {
		fmt.Sscanf(limitParam, "%d", &limit)
	}

	dbQuery.Order("created_at DESC").Limit(limit).Find(&submissions)

	// Convert to search results
	var results []SearchResult
	for _, submission := range submissions {
		subtitle := extractRowPreview(submission.Data)

		// Extract IP and UserAgent from data if available
		var dataMap map[string]interface{}
		json.Unmarshal(submission.Data, &dataMap)
		ipAddress := ""
		userAgent := ""
		if val, ok := dataMap["_ip_address"].(string); ok {
			ipAddress = val
		}
		if val, ok := dataMap["_user_agent"].(string); ok {
			userAgent = val
		}

		results = append(results, SearchResult{
			ID:          submission.ID.String(),
			Title:       fmt.Sprintf("Submission from %s", ipAddress),
			Subtitle:    subtitle,
			Type:        "submission",
			URL:         fmt.Sprintf("/workspace/%s/form/%s/submission/%s", workspace.Slug, form.ID, submission.ID),
			WorkspaceID: form.WorkspaceID.String(),
			Score:       0.8,
			Metadata: map[string]interface{}{
				"formName":  form.Name,
				"formId":    form.ID,
				"ipAddress": ipAddress,
				"userAgent": userAgent,
				"createdAt": submission.CreatedAt,
				"data":      submission.Data,
			},
			Path: fmt.Sprintf("%s / Submissions", form.Name),
		})
	}

	took := int(time.Since(startTime).Milliseconds())

	c.JSON(http.StatusOK, SearchResponse{
		Results: results,
		Total:   len(results),
		Query:   query,
		Took:    took,
	})
}
