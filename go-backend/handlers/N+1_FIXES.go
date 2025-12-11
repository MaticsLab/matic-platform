// N+1 Query Fixes for Go Backend Handlers
// ============================================
// This document identifies and fixes N+1 query patterns across all handlers

package handlers

/*
CRITICAL N+1 QUERY PATTERNS IDENTIFIED:
=====================================

1. data_tables.go - GetRows() handler
   Problem: Loads rows without preloading related data
   Fix: Add Preload for linked columns, files, stage groups

2. workflows.go - GetWorkflowStages() handler
   Problem: Loads stages without reviewer configs, rubrics
   Fix: Add Preload for reviewer_types, rubrics, stage_reviewer_configs

3. forms.go - GetFormSubmissions() handler
   Problem: Loops through submissions without batch loading related data
   Fix: Use IN query for related rows, batch load table metadata

4. search.go - SearchRows() handler
   Problem: Loads rows then individually fetches table metadata
   Fix: Join tables in single query or use Preload

5. table_links.go - GetLinkedRows() handler
   Problem: Fetches linked rows one by one
   Fix: Use WHERE IN query to batch load

IMPLEMENTATION PATTERNS:
=======================

Pattern 1: Preload Related Data
```go
database.DB.Preload("Fields").
  Preload("Fields.FieldType").
  Preload("Views").
  First(&table, "id = ?", id)
```

Pattern 2: Batch Load with IN
```go
var rowIDs []uuid.UUID
// ... collect IDs
database.DB.Where("id IN ?", rowIDs).Find(&rows)
```

Pattern 3: Join Tables
```go
database.DB.Select("rows.*, tables.name as table_name").
  Joins("LEFT JOIN data_tables tables ON rows.table_id = tables.id").
  Where("rows.table_id = ?", tableID).
  Find(&rows)
```

Pattern 4: Use Views
```go
// Use v_table_rows_with_fields view instead of manual joins
database.DB.Table("v_table_rows_with_fields").
  Where("table_id = ?", tableID).
  Find(&results)
```
*/

// FIXES TO IMPLEMENT:
// ===================

// Fix 1: data_tables.go - GetRows()
// BEFORE:
/*
func GetRows(c *gin.Context) {
	tableID := c.Param("table_id")
	var rows []models.Row
	if err := database.DB.Where("table_id = ?", tableID).Find(&rows).Error; err != nil {
		// ...
	}
	// N+1: For each row, separately queries linked data, files, etc.
}
*/

// AFTER:
/*
func GetRows(c *gin.Context) {
	tableID := c.Param("table_id")
	var rows []models.Row
	if err := database.DB.Where("table_id = ?", tableID).
		Preload("StageGroup").                           // Preload workflow stage
		Preload("StageGroup.Stage").                     // Preload stage details
		Preload("Table").                                 // Preload table metadata
		Preload("Table.Fields").                          // Preload field definitions
		Order("created_at DESC").
		Find(&rows).Error; err != nil {
		// ...
	}

	// Batch load files for all rows
	var rowIDs []uuid.UUID
	for _, row := range rows {
		rowIDs = append(rowIDs, row.ID)
	}

	var files []models.TableFile
	if len(rowIDs) > 0 {
		database.DB.Where("row_id IN ?", rowIDs).Find(&files)
		// Map files to rows
		filesByRow := make(map[uuid.UUID][]models.TableFile)
		for _, file := range files {
			filesByRow[file.RowID] = append(filesByRow[file.RowID], file)
		}
		for i := range rows {
			rows[i].Files = filesByRow[rows[i].ID]
		}
	}
}
*/

// Fix 2: workflows.go - GetWorkflowStages()
// BEFORE:
/*
func GetWorkflowStages(c *gin.Context) {
	workflowID := c.Param("workflow_id")
	var stages []models.ApplicationStage
	database.DB.Where("review_workflow_id = ?", workflowID).Find(&stages)
	// N+1: For each stage, queries reviewer configs, rubrics separately
}
*/

// AFTER:
/*
func GetWorkflowStages(c *gin.Context) {
	workflowID := c.Param("workflow_id")
	var stages []models.ApplicationStage
	database.DB.Where("review_workflow_id = ?", workflowID).
		Preload("ReviewerConfigs").                       // Preload all reviewer configs
		Preload("ReviewerConfigs.ReviewerType").          // Preload reviewer type details
		Preload("ReviewerConfigs.Rubric").                // Preload rubric details
		Preload("ReviewerConfigs.Rubric.Categories").     // Preload rubric categories (if nested)
		Preload("CustomStatuses").                        // Preload custom status options
		Preload("CustomTags").                            // Preload custom tags
		Order("position ASC").
		Find(&stages)
}
*/

// Fix 3: forms.go - GetFormSubmissions()
// BEFORE:
/*
func GetFormSubmissions(c *gin.Context) {
	formID := c.Param("form_id")
	var submissions []models.PortalApplicant
	database.DB.Where("form_id = ?", formID).Find(&submissions)
	// N+1: For each submission, queries related table row if exists
}
*/

// AFTER:
/*
func GetFormSubmissions(c *gin.Context) {
	formID := c.Param("form_id")

	// Use view that joins form metadata
	var submissions []struct {
		models.PortalApplicant
		FormName    string `json:"form_name"`
		TableID     uuid.UUID `json:"table_id"`
		TableName   string `json:"table_name"`
		WorkspaceID uuid.UUID `json:"workspace_id"`
	}

	database.DB.Table("v_portal_applicants_with_form").
		Where("form_id = ?", formID).
		Order("created_at DESC").
		Find(&submissions)

	c.JSON(http.StatusOK, submissions)
}
*/

// Fix 4: search.go - SearchRows()
// BEFORE:
/*
func SearchRows(c *gin.Context) {
	query := c.Query("q")
	var rows []models.Row
	database.DB.Where("data::text ILIKE ?", "%"+query+"%").Limit(50).Find(&rows)
	// N+1: For each row, queries table metadata separately
}
*/

// AFTER:
/*
func SearchRows(c *gin.Context) {
	query := c.Query("q")
	workspaceID := c.Query("workspace_id")

	var results []struct {
		models.Row
		TableName   string `json:"table_name"`
		TableIcon   string `json:"table_icon"`
		WorkspaceID uuid.UUID `json:"workspace_id"`
	}

	database.DB.Table("table_rows").
		Select("table_rows.*, data_tables.name as table_name, data_tables.icon as table_icon, data_tables.workspace_id").
		Joins("INNER JOIN data_tables ON table_rows.table_id = data_tables.id").
		Where("data_tables.workspace_id = ?", workspaceID).
		Where("table_rows.data::text ILIKE ?", "%"+query+"%").
		Order("table_rows.updated_at DESC").
		Limit(50).
		Find(&results)

	c.JSON(http.StatusOK, results)
}
*/

// Fix 5: table_links.go - GetLinkedRows()
// ALREADY FIXED with batching:
/*
func GetLinkedRows(c *gin.Context) {
	// ...existing code collects linkedRowIDs...

	// Good: Uses WHERE IN for batch loading
	if len(linkedRowIDs) > 0 {
		if err := database.DB.Where("id IN ?", linkedRowIDs).Find(&rows).Error; err != nil {
			// handle error
		}
	}
}
*/

// GENERAL BEST PRACTICES:
// =======================

/*
1. Always use Preload for FK relationships displayed in response
2. Use WHERE IN for batch loading related records
3. Consider using database views for complex joins
4. Use SELECT to limit columns fetched
5. Add indexes on FK columns (see migration 019)
6. Use EXPLAIN ANALYZE to verify query plans
7. Cache frequently-accessed reference data (field_type_registry)
8. Use pagination for large result sets
9. Avoid loading unused relationships
10. Use COUNT queries for row counts, not len()

PERFORMANCE MONITORING:
======================

Add query logging to identify slow queries:
```go
import "gorm.io/gorm/logger"

database.DB.Logger = logger.Default.LogMode(logger.Info)
```

Use middleware to track query counts per request:
```go
func QueryCountMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Start query counter
		c.Next()
		// Log query count
	}
}
```
*/
