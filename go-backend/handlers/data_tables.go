package handlers

import (
	"fmt"
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Data Table Handlers

func ListDataTables(c *gin.Context) {
	workspaceID := c.Query("workspace_id")

	var tables []models.DataTable
	query := database.DB

	if workspaceID != "" {
		query = query.Where("workspace_id = ?", workspaceID)
	}

	if err := query.Preload("Columns").Order("created_at DESC").Find(&tables).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Calculate row_count for each table if not already set
	for i := range tables {
		if tables[i].RowCount == 0 {
			var count int64
			database.DB.Model(&models.TableRow{}).Where("table_id = ?", tables[i].ID).Count(&count)
			tables[i].RowCount = int(count)
		}
	}

	c.JSON(http.StatusOK, tables)
}

func GetDataTable(c *gin.Context) {
	id := c.Param("id")

	var table models.DataTable
	if err := database.DB.Preload("Columns").
		Preload("Views").
		First(&table, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data table not found"})
		return
	}

	// Calculate row_count if not already set
	if table.RowCount == 0 {
		var count int64
		database.DB.Model(&models.TableRow{}).Where("table_id = ?", table.ID).Count(&count)
		table.RowCount = int(count)
	}

	c.JSON(http.StatusOK, table)
}

type CreateDataTableInput struct {
	WorkspaceID uuid.UUID              `json:"workspace_id" binding:"required"`
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	Icon        string                 `json:"icon"`
	Settings    map[string]interface{} `json:"settings"`
}

func CreateDataTable(c *gin.Context) {
	var input CreateDataTableInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get authenticated user ID from JWT token
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user ID not found"})
		return
	}

	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	icon := input.Icon
	if icon == "" {
		icon = "table"
	}

	// Generate slug from name
	slug := generateSlug(input.Name)
	
	// Check for duplicate slug in workspace
	var existing models.DataTable
	if err := database.DB.Where("workspace_id = ? AND slug = ?", input.WorkspaceID, slug).First(&existing).Error; err == nil {
		// Slug exists, append a number
		counter := 1
		for {
			newSlug := slug + "-" + fmt.Sprintf("%d", counter)
			if err := database.DB.Where("workspace_id = ? AND slug = ?", input.WorkspaceID, newSlug).First(&existing).Error; err != nil {
				slug = newSlug
				break
			}
			counter++
			if counter > 100 {
				// Fallback to UUID-based slug
				slug = slug + "-" + uuid.New().String()[:8]
				break
			}
		}
	}

	table := models.DataTable{
		WorkspaceID: input.WorkspaceID,
		Name:        input.Name,
		Slug:        slug,
		Description: input.Description,
		Icon:        icon,
		Color:       "#10B981", // Default green color
		Settings:    mapToJSON(input.Settings),
		RowCount:    0,
		CreatedBy:   parsedUserID,
	}

	if err := database.DB.Create(&table).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, table)
}

type UpdateDataTableInput struct {
	Name        *string                 `json:"name"`
	Description *string                 `json:"description"`
	Icon        *string                 `json:"icon"`
	Settings    *map[string]interface{} `json:"settings"`
}

func UpdateDataTable(c *gin.Context) {
	id := c.Param("id")

	var table models.DataTable
	if err := database.DB.First(&table, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data table not found"})
		return
	}

	var input UpdateDataTableInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Name != nil {
		table.Name = *input.Name
	}
	if input.Description != nil {
		table.Description = *input.Description
	}
	if input.Icon != nil {
		table.Icon = *input.Icon
	}
	if input.Settings != nil {
		table.Settings = mapToJSON(*input.Settings)
	}

	if err := database.DB.Save(&table).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, table)
}

func DeleteDataTable(c *gin.Context) {
	id := c.Param("id")

	var table models.DataTable
	if err := database.DB.First(&table, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data table not found"})
		return
	}

	if err := database.DB.Delete(&table).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// Table Row Handlers

func ListTableRows(c *gin.Context) {
	tableID := c.Param("id")

	var rows []models.TableRow
	if err := database.DB.Where("table_id = ?", tableID).Order("position ASC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rows)
}

type CreateTableRowInput struct {
	Data     map[string]interface{} `json:"data" binding:"required"`
	Position int                    `json:"position"`
}

func CreateTableRow(c *gin.Context) {
	tableID := c.Param("id")

	var input CreateTableRowInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// Parse table ID
	parsedTableID, err := uuid.Parse(tableID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID"})
		return
	}

	// Verify table exists
	var table models.DataTable
	if err := database.DB.Where("id = ?", parsedTableID).First(&table).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table not found"})
		return
	}

	// Get authenticated user ID from JWT token
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user ID not found"})
		return
	}

	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	row := models.TableRow{
		TableID:   parsedTableID,
		Data:      mapToJSON(input.Data),
		Position:  input.Position,
		CreatedBy: &parsedUserID,
	}

	if err := database.DB.Create(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, row)
}

type UpdateTableRowInput struct {
	Data     *map[string]interface{} `json:"data"`
	Position *int                    `json:"position"`
}

func UpdateTableRow(c *gin.Context) {
	tableID := c.Param("id")
	rowID := c.Param("row_id")

	var row models.TableRow
	if err := database.DB.Where("id = ? AND table_id = ?", rowID, tableID).First(&row).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Row not found"})
		return
	}

	var input UpdateTableRowInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Data != nil {
		row.Data = mapToJSON(*input.Data)
	}
	if input.Position != nil {
		row.Position = *input.Position
	}

	if err := database.DB.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, row)
}

func DeleteTableRow(c *gin.Context) {
	tableID := c.Param("id")
	rowID := c.Param("row_id")

	var row models.TableRow
	if err := database.DB.Where("id = ? AND table_id = ?", rowID, tableID).First(&row).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Row not found"})
		return
	}

	if err := database.DB.Delete(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// Table Column Handlers

type CreateTableColumnInput struct {
	// TableID is optional in body - we use URL param instead
	Name         string                 `json:"name" binding:"required"`
	Label        string                 `json:"label"` // Display label (defaults to name if not provided)
	Type         string                 `json:"type" binding:"required"`
	Position     int                    `json:"position"`
	Width        int                    `json:"width"`
	IsVisible    bool                   `json:"is_visible"`
	IsPrimary    bool                   `json:"is_primary"` // Maps to is_primary in DB
	LinkedTableID *uuid.UUID            `json:"linked_table_id"` // For link columns
	Options      map[string]interface{} `json:"options"`
	Validation   map[string]interface{} `json:"validation"`
}

func CreateTableColumn(c *gin.Context) {
	tableID := c.Param("id")

	// Parse table ID from URL
	parsedTableID, err := uuid.Parse(tableID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID format"})
		return
	}

	var input CreateTableColumnInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// Verify table exists
	var table models.DataTable
	if err := database.DB.First(&table, "id = ?", parsedTableID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table not found"})
		return
	}

	// Set defaults
	if input.Label == "" {
		input.Label = input.Name // Use name as label if not provided
	}
	if input.Width == 0 {
		input.Width = 200
	}
	if input.Options == nil {
		input.Options = make(map[string]interface{})
	}
	if input.Validation == nil {
		input.Validation = make(map[string]interface{})
	}

	// Use table ID from URL parameter (more reliable than body)
	column := models.TableColumn{
		TableID:      parsedTableID,
		Name:         input.Name,
		Label:        input.Label,
		Type:         input.Type,
		Position:     input.Position,
		Width:        input.Width,
		IsVisible:    true, // Default to visible
		IsPrimary:    input.IsPrimary,
		LinkedTableID: input.LinkedTableID,
		Options:      mapToJSON(input.Options),
		Validation:   mapToJSON(input.Validation),
	}

	if err := database.DB.Create(&column).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, column)
}

type UpdateTableColumnInput struct {
	Name         *string                 `json:"name"`
	Label        *string                 `json:"label"`
	Type         *string                 `json:"type"`
	Position     *int                    `json:"position"`
	Width        *int                    `json:"width"`
	IsVisible    *bool                   `json:"is_visible"`
	IsPrimary    *bool                   `json:"is_primary"`
	LinkedTableID *uuid.UUID             `json:"linked_table_id"`
	Options      *map[string]interface{} `json:"options"`
	Validation   *map[string]interface{} `json:"validation"`
}

func UpdateTableColumn(c *gin.Context) {
	tableID := c.Param("id")
	columnID := c.Param("column_id")

	var column models.TableColumn
	if err := database.DB.Where("id = ? AND table_id = ?", columnID, tableID).First(&column).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Column not found"})
		return
	}

	var input UpdateTableColumnInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields if provided
	if input.Name != nil {
		column.Name = *input.Name
	}
	if input.Label != nil {
		column.Label = *input.Label
	}
	if input.Type != nil {
		column.Type = *input.Type
	}
	if input.Position != nil {
		column.Position = *input.Position
	}
	if input.Width != nil {
		column.Width = *input.Width
	}
	if input.IsVisible != nil {
		column.IsVisible = *input.IsVisible
	}
	if input.IsPrimary != nil {
		column.IsPrimary = *input.IsPrimary
	}
	if input.LinkedTableID != nil {
		column.LinkedTableID = input.LinkedTableID
	}
	if input.Options != nil {
		column.Options = mapToJSON(*input.Options)
	}
	if input.Validation != nil {
		column.Validation = mapToJSON(*input.Validation)
	}

	if err := database.DB.Save(&column).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, column)
}

func DeleteTableColumn(c *gin.Context) {
	tableID := c.Param("id")
	columnID := c.Param("column_id")

	var column models.TableColumn
	if err := database.DB.Where("id = ? AND table_id = ?", columnID, tableID).First(&column).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Column not found"})
		return
	}

	if err := database.DB.Delete(&column).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
