package handlers

import (
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/Jsanchez767/matic-platform/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GenerateReportRequest represents the request body for report generation
type GenerateReportRequest struct {
	Query string `json:"query" binding:"required"`
}

// ReportStats holds workspace statistics
type ReportStats struct {
	Tables         int `json:"tables"`
	Forms          int `json:"forms"`
	Rows           int `json:"rows"`
	Submissions    int `json:"submissions"`
	ActivitiesHubs int `json:"activities_hubs"`
	Workflows      int `json:"workflows"`
	PendingReviews int `json:"pending_reviews"`
}

// GenerateReport handles AI-powered report generation
func GenerateReport(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	var req GenerateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	wsUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workspace_id"})
		return
	}

	// Gather workspace statistics for context
	stats := gatherWorkspaceStats(wsUUID)

	// Check if AI reports service is available
	if services.AIReports == nil {
		// Return mock report with real stats
		mockService := &services.AIReportService{}
		report := mockService.GenerateMockReport(services.ReportRequest{
			Query:       req.Query,
			WorkspaceID: workspaceID,
		}, map[string]int{
			"tables":      stats.Tables,
			"forms":       stats.Forms,
			"rows":        stats.Rows,
			"submissions": stats.Submissions,
		})

		c.JSON(http.StatusOK, gin.H{
			"report":     report,
			"stats":      stats,
			"ai_enabled": false,
			"generated":  time.Now(),
		})
		return
	}

	// Build context for AI
	dataContext := map[string]interface{}{
		"workspace_id": workspaceID,
		"stats":        stats,
		"tables":       getTableNames(wsUUID),
		"forms":        getFormNames(wsUUID),
	}

	// Generate AI report
	report, err := services.AIReports.GenerateReport(services.ReportRequest{
		Query:       req.Query,
		WorkspaceID: workspaceID,
	}, dataContext)

	if err != nil {
		// Fallback to mock report on error
		mockService := &services.AIReportService{}
		report = mockService.GenerateMockReport(services.ReportRequest{
			Query:       req.Query,
			WorkspaceID: workspaceID,
		}, map[string]int{
			"tables":      stats.Tables,
			"forms":       stats.Forms,
			"rows":        stats.Rows,
			"submissions": stats.Submissions,
		})

		c.JSON(http.StatusOK, gin.H{
			"report":     report,
			"stats":      stats,
			"ai_enabled": false,
			"error":      err.Error(),
			"generated":  time.Now(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"report":     report,
		"stats":      stats,
		"ai_enabled": true,
		"generated":  time.Now(),
	})
}

// GetWorkspaceStats returns quick statistics for a workspace
func GetWorkspaceStats(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	wsUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workspace_id"})
		return
	}

	stats := gatherWorkspaceStats(wsUUID)

	c.JSON(http.StatusOK, gin.H{
		"stats":     stats,
		"generated": time.Now(),
	})
}

// IsReportQuery checks if a query should trigger AI report generation
func IsReportQuery(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "q parameter is required"})
		return
	}

	isReport := services.IsReportQuery(query)
	queryType := ""
	if isReport && services.AIReports != nil {
		queryType = services.AIReports.ClassifyReportIntent(query)
	}

	c.JSON(http.StatusOK, gin.H{
		"is_report":  isReport,
		"query_type": queryType,
	})
}

// Helper functions

func gatherWorkspaceStats(workspaceID uuid.UUID) ReportStats {
	stats := ReportStats{}

	// Count tables (excluding form-only tables)
	var tableCount int64
	database.DB.Model(&models.Table{}).
		Where("workspace_id = ?", workspaceID).
		Count(&tableCount)
	stats.Tables = int(tableCount)

	// Count forms (views with type="form")
	var formCount int64
	database.DB.Model(&models.View{}).
		Joins("JOIN data_tables ON data_tables.id = table_views.table_id").
		Where("data_tables.workspace_id = ? AND table_views.type = ?", workspaceID, "form").
		Count(&formCount)
	stats.Forms = int(formCount)

	// Count rows
	var tables []models.Table
	database.DB.Where("workspace_id = ?", workspaceID).Find(&tables)
	for _, table := range tables {
		var rowCount int64
		database.DB.Model(&models.Row{}).
			Where("table_id = ?", table.ID).
			Count(&rowCount)
		stats.Rows += int(rowCount)
	}

	// Count submissions (rows in tables that have form views)
	var formViews []models.View
	database.DB.Model(&models.View{}).
		Joins("JOIN data_tables ON data_tables.id = table_views.table_id").
		Where("data_tables.workspace_id = ? AND table_views.type = ?", workspaceID, "form").
		Find(&formViews)
	for _, view := range formViews {
		var submissionCount int64
		database.DB.Model(&models.Row{}).
			Where("table_id = ?", view.TableID).
			Count(&submissionCount)
		stats.Submissions += int(submissionCount)
	}

	// Count activities hubs (tables with hub_type = 'activities')
	var activitiesCount int64
	database.DB.Model(&models.Table{}).
		Where("workspace_id = ? AND hub_type = ?", workspaceID, "activities").
		Count(&activitiesCount)
	stats.ActivitiesHubs = int(activitiesCount)

	// Count workflows
	var workflowCount int64
	database.DB.Model(&models.ReviewWorkflow{}).
		Where("workspace_id = ?", workspaceID).
		Count(&workflowCount)
	stats.Workflows = int(workflowCount)

	// Count pending reviews (if workflow model supports it)
	// This would require a WorkflowSubmission model with status field
	// For now, set to 0
	stats.PendingReviews = 0

	return stats
}

func getTableNames(workspaceID uuid.UUID) []string {
	var tables []models.Table
	database.DB.Select("name").Where("workspace_id = ?", workspaceID).Find(&tables)

	names := make([]string, len(tables))
	for i, t := range tables {
		names[i] = t.Name
	}
	return names
}

func getFormNames(workspaceID uuid.UUID) []string {
	// Forms are views with type="form"
	var views []models.View
	database.DB.Model(&models.View{}).
		Joins("JOIN data_tables ON data_tables.id = table_views.table_id").
		Where("data_tables.workspace_id = ? AND table_views.type = ?", workspaceID, "form").
		Select("table_views.name").
		Find(&views)

	names := make([]string, len(views))
	for i, v := range views {
		names[i] = v.Name
	}
	return names
}
