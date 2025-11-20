package handlers

import (
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

	icon := input.Icon
	if icon == "" {
		icon = "table"
	}

	table := models.DataTable{
		WorkspaceID: input.WorkspaceID,
		Name:        input.Name,
		Description: input.Description,
		Icon:        icon,
		Settings:    mapToJSON(input.Settings),
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
	TableID      uuid.UUID              `json:"table_id" binding:"required"`
	Name         string                 `json:"name" binding:"required"`
	Type         string                 `json:"type" binding:"required"`
	Position     int                    `json:"position"`
	Width        int                    `json:"width"`
	IsRequired   bool                   `json:"is_required"`
	IsPrimaryKey bool                   `json:"is_primary_key"`
	Options      map[string]interface{} `json:"options"`
	Validation   map[string]interface{} `json:"validation"`
}

func CreateTableColumn(c *gin.Context) {
	tableID := c.Param("id")

	var input CreateTableColumnInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify table exists
	var table models.DataTable
	if err := database.DB.First(&table, "id = ?", tableID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table not found"})
		return
	}

	// Set defaults
	if input.Width == 0 {
		input.Width = 200
	}
	if input.Options == nil {
		input.Options = make(map[string]interface{})
	}
	if input.Validation == nil {
		input.Validation = make(map[string]interface{})
	}

	column := models.TableColumn{
		TableID:      input.TableID,
		Name:         input.Name,
		Type:         input.Type,
		Position:     input.Position,
		Width:        input.Width,
		IsRequired:   input.IsRequired,
		IsPrimaryKey: input.IsPrimaryKey,
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
	Type         *string                 `json:"type"`
	Position     *int                    `json:"position"`
	Width        *int                    `json:"width"`
	IsRequired   *bool                   `json:"is_required"`
	IsPrimaryKey *bool                   `json:"is_primary_key"`
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
	if input.Type != nil {
		column.Type = *input.Type
	}
	if input.Position != nil {
		column.Position = *input.Position
	}
	if input.Width != nil {
		column.Width = *input.Width
	}
	if input.IsRequired != nil {
		column.IsRequired = *input.IsRequired
	}
	if input.IsPrimaryKey != nil {
		column.IsPrimaryKey = *input.IsPrimaryKey
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
