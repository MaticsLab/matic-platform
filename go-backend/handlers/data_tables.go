package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/Jsanchez767/matic-platform/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Data Table Handlers

func ListDataTables(c *gin.Context) {
	workspaceID := c.Query("workspace_id")

	var tables []models.Table
	query := database.DB

	if workspaceID != "" {
		query = query.Where("workspace_id = ?", workspaceID)
	}

	if err := query.Preload("Fields").Order("created_at DESC").Find(&tables).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Calculate row_count for each table if not already set
	for i := range tables {
		if tables[i].RowCount == 0 {
			var count int64
			database.DB.Model(&models.Row{}).Where("table_id = ?", tables[i].ID).Count(&count)
			tables[i].RowCount = int(count)
		}
	}

	c.JSON(http.StatusOK, tables)
}

func GetDataTable(c *gin.Context) {
	id := c.Param("id")

	var table models.Table
	if err := database.DB.Preload("Fields").
		Preload("Fields.FieldType"). // Preload field type registry for each field
		Preload("Views").
		First(&table, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data table not found"})
		return
	}

	// Calculate row_count if not already set
	if table.RowCount == 0 {
		var count int64
		database.DB.Model(&models.Row{}).Where("table_id = ?", table.ID).Count(&count)
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
	var existing models.Table
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

	table := models.Table{
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

	var table models.Table
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

	var table models.Table
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

	var rows []models.Row
	if err := database.DB.Where("table_id = ?", tableID).Order("position ASC").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rows)
}

type CreateTableRowInput struct {
	Data     map[string]interface{} `json:"data" binding:"required"`
	Position int64                  `json:"position"`
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
	var table models.Table
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

	row := models.Row{
		TableID:   parsedTableID,
		Data:      mapToJSON(input.Data),
		Position:  input.Position,
		CreatedBy: &parsedUserID,
	}

	if err := database.DB.Create(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
		return
	}

	// Create initial version for version history
	go func() {
		versionService := services.NewVersionService()
		versionService.CreateVersion(services.CreateVersionInput{
			RowID:        row.ID,
			TableID:      parsedTableID,
			Data:         input.Data,
			ChangeType:   models.ChangeTypeCreate,
			ChangeReason: "Row created",
			ChangedBy:    &parsedUserID,
		})
	}()

	// Queue row for semantic embedding (async, don't fail if this fails)
	go func() {
		database.DB.Exec(`
			INSERT INTO embedding_queue (entity_id, entity_type, priority, status)
			VALUES ($1, 'row', 5, 'pending')
			ON CONFLICT (entity_id, entity_type) 
			DO UPDATE SET priority = 5, status = 'pending', created_at = NOW()
		`, row.ID)
	}()

	c.JSON(http.StatusCreated, row)
}

type UpdateTableRowInput struct {
	Data         *map[string]interface{} `json:"data"`
	Position     *int64                  `json:"position"`
	ChangeReason string                  `json:"change_reason"` // Optional reason for the change
}

// UpdateTableRow updates a row with full version history tracking
// Follows the row-edit-flow spec: transaction-wrapped update with diff computation
func UpdateTableRow(c *gin.Context) {
	tableID := c.Param("id")
	rowID := c.Param("row_id")

	var input UpdateTableRowInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID for version tracking
	userIDStr, _ := middleware.GetUserID(c)
	var userID *uuid.UUID
	if parsedUserID, err := uuid.Parse(userIDStr); err == nil {
		userID = &parsedUserID
	}

	// Parse IDs
	parsedTableID, err := uuid.Parse(tableID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table ID"})
		return
	}
	parsedRowID, err := uuid.Parse(rowID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid row ID"})
		return
	}

	// BEGIN TRANSACTION - all updates must be atomic
	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 1. Load current row within transaction (FOR UPDATE to prevent race conditions)
	var row models.Row
	if err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("id = ? AND table_id = ?", parsedRowID, parsedTableID).
		First(&row).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Row not found"})
		return
	}

	// Store old data for diff calculation
	var oldData map[string]interface{}
	if row.Data != nil {
		json.Unmarshal(row.Data, &oldData)
	}

	var versionResult *services.CreateVersionResult
	hasDataChange := false

	if input.Data != nil {
		hasDataChange = true

		// Merge new data with existing data (partial update support)
		mergedData := make(map[string]interface{})
		for k, v := range oldData {
			mergedData[k] = v
		}
		for k, v := range *input.Data {
			mergedData[k] = v
		}

		// 5. Update the row data
		row.Data = mapToJSON(mergedData)

		// Determine change reason
		changeReason := input.ChangeReason
		if changeReason == "" {
			changeReason = "Row updated"
		}

		// 6-7. Create version and field_changes within transaction
		versionService := services.NewVersionService()
		var versionErr error
		versionResult, versionErr = versionService.CreateVersionTx(tx, services.CreateVersionInput{
			RowID:        row.ID,
			TableID:      parsedTableID,
			Data:         mergedData,
			ChangeType:   models.ChangeTypeUpdate,
			ChangeReason: changeReason,
			ChangedBy:    userID,
		})
		if versionErr != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create version: " + versionErr.Error()})
			return
		}
	}

	if input.Position != nil {
		row.Position = *input.Position
	}

	// Save the updated row
	if err := tx.Save(&row).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// COMMIT TRANSACTION
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction: " + err.Error()})
		return
	}

	// RE-INDEX IF SEARCHABLE FIELD CHANGED (async, after commit)
	if hasDataChange {
		go func() {
			// Check if any changed field is searchable
			shouldReindex := false
			if versionResult != nil && len(versionResult.FieldChanges) > 0 {
				var searchableFields []string
				database.DB.Raw(`
					SELECT field_name FROM table_fields 
					WHERE table_id = ? AND is_searchable = true
				`, parsedTableID).Scan(&searchableFields)

				for _, fc := range versionResult.FieldChanges {
					for _, sf := range searchableFields {
						if fc.FieldName == sf {
							shouldReindex = true
							break
						}
					}
					if shouldReindex {
						break
					}
				}
			} else {
				// If no version result, always reindex to be safe
				shouldReindex = true
			}

			if shouldReindex {
				database.DB.Exec(`
					INSERT INTO embedding_queue (entity_id, entity_type, priority, status)
					VALUES ($1, 'row', 3, 'pending')
					ON CONFLICT (entity_id, entity_type) 
					DO UPDATE SET priority = 3, status = 'pending', created_at = NOW()
				`, row.ID)
			}
		}()
	}

	c.JSON(http.StatusOK, row)
}

func DeleteTableRow(c *gin.Context) {
	tableID := c.Param("id")
	rowID := c.Param("row_id")

	var row models.Row
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
	Name          string                 `json:"name" binding:"required"`
	Label         string                 `json:"label"` // Display label (defaults to name if not provided)
	Type          string                 `json:"type" binding:"required"`
	Position      int                    `json:"position"`
	Width         int                    `json:"width"`
	IsVisible     bool                   `json:"is_visible"`
	IsPrimary     bool                   `json:"is_primary"`      // Maps to is_primary in DB
	LinkedTableID *uuid.UUID             `json:"linked_table_id"` // For link columns
	Options       map[string]interface{} `json:"options"`
	Validation    map[string]interface{} `json:"validation"`
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
	var table models.Table
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

	// Construct Config map
	config := make(map[string]interface{})
	for k, v := range input.Options {
		config[k] = v
	}
	if len(input.Validation) > 0 {
		config["validation"] = input.Validation
	}
	config["width"] = input.Width
	config["is_visible"] = input.IsVisible
	config["is_primary"] = input.IsPrimary
	if input.LinkedTableID != nil {
		config["linked_table_id"] = input.LinkedTableID
	}

	// Use FieldService to validate field type and get defaults
	fieldService := services.GetFieldService()
	fieldType, exists := fieldService.GetFieldType(input.Type)
	if !exists {
		// Log warning but don't fail - allows for unknown types during transition
		fmt.Printf("Warning: Unknown field type '%s', proceeding without registry defaults\n", input.Type)
	}

	// Build field with field_type_id properly set
	field := models.Field{
		TableID:     parsedTableID,
		Name:        input.Name,
		Label:       input.Label,
		Type:        input.Type, // Keep for backwards compatibility
		FieldTypeID: input.Type, // New: proper FK to field_type_registry
		Position:    input.Position,
		Width:       input.Width,
		IsVisible:   input.IsVisible,
		IsPrimary:   input.IsPrimary,
		Config:      mapToJSON(config),
	}

	// Inherit properties from registry if available
	if fieldType != nil {
		field.IsSearchable = fieldType.IsSearchable
		if input.LinkedTableID != nil {
			field.LinkedTableID = input.LinkedTableID
		}
	}

	if err := database.DB.Create(&field).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Preload the FieldType relationship for the response
	database.DB.Preload("FieldType").First(&field, "id = ?", field.ID)

	c.JSON(http.StatusCreated, field)
}

type UpdateTableColumnInput struct {
	Name          *string                 `json:"name"`
	Label         *string                 `json:"label"`
	Type          *string                 `json:"type"`
	Position      *int                    `json:"position"`
	Width         *int                    `json:"width"`
	IsVisible     *bool                   `json:"is_visible"`
	IsPrimary     *bool                   `json:"is_primary"`
	LinkedTableID *uuid.UUID              `json:"linked_table_id"`
	Options       *map[string]interface{} `json:"options"`
	Validation    *map[string]interface{} `json:"validation"`
}

func UpdateTableColumn(c *gin.Context) {
	tableID := c.Param("id")
	columnID := c.Param("column_id")

	var field models.Field
	if err := database.DB.Where("id = ? AND table_id = ?", columnID, tableID).First(&field).Error; err != nil {
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
		field.Name = *input.Name
	}
	if input.Label != nil {
		field.Label = *input.Label
	}
	if input.Type != nil {
		field.Type = *input.Type
	}
	if input.Position != nil {
		field.Position = *input.Position
	}

	// Update Config
	config := make(map[string]interface{})
	if len(field.Config) > 0 {
		json.Unmarshal(field.Config, &config)
	}

	if input.Width != nil {
		config["width"] = *input.Width
	}
	if input.IsVisible != nil {
		config["is_visible"] = *input.IsVisible
	}
	if input.IsPrimary != nil {
		config["is_primary"] = *input.IsPrimary
	}
	if input.LinkedTableID != nil {
		config["linked_table_id"] = input.LinkedTableID
	}
	if input.Options != nil {
		for k, v := range *input.Options {
			config[k] = v
		}
	}
	if input.Validation != nil {
		config["validation"] = *input.Validation
	}

	field.Config = mapToJSON(config)

	if err := database.DB.Save(&field).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, field)
}

func DeleteTableColumn(c *gin.Context) {
	tableID := c.Param("id")
	columnID := c.Param("column_id")

	var field models.Field
	if err := database.DB.Where("id = ? AND table_id = ?", columnID, tableID).First(&field).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Column not found"})
		return
	}

	if err := database.DB.Delete(&field).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
