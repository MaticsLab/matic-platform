package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Table Links Handlers - for managing relationships between tables

// ListTableLinks - Get all links for a table
func ListTableLinks(c *gin.Context) {
	tableID := c.Query("table_id")
	if tableID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "table_id is required"})
		return
	}

	var links []models.TableLink
	if err := database.DB.Where("source_table_id = ? OR target_table_id = ?", tableID, tableID).
		Find(&links).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, links)
}

// GetTableLink - Get a specific link by ID
func GetTableLink(c *gin.Context) {
	linkID := c.Param("id")

	var link models.TableLink
	if err := database.DB.First(&link, "id = ?", linkID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table link not found"})
		return
	}

	c.JSON(http.StatusOK, link)
}

type CreateTableLinkInput struct {
	SourceTableID  uuid.UUID              `json:"source_table_id" binding:"required"`
	SourceColumnID uuid.UUID              `json:"source_column_id" binding:"required"`
	TargetTableID  uuid.UUID              `json:"target_table_id" binding:"required"`
	TargetColumnID *uuid.UUID             `json:"target_column_id,omitempty"`
	LinkType       string                 `json:"link_type" binding:"required"`
	Settings       map[string]interface{} `json:"settings"`
}

// CreateTableLink - Create a relationship between two tables
func CreateTableLink(c *gin.Context) {
	var input CreateTableLinkInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Debug logging
	fmt.Printf("🔗 Creating table link: source_table=%s, source_column=%s, target_table=%s, link_type=%s\n",
		input.SourceTableID, input.SourceColumnID, input.TargetTableID, input.LinkType)

	// Validate link type
	if input.LinkType != "one_to_many" && input.LinkType != "many_to_many" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "link_type must be 'one_to_many' or 'many_to_many'"})
		return
	}

	// Check if tables exist
	var sourceTable, targetTable models.Table
	if err := database.DB.First(&sourceTable, "id = ?", input.SourceTableID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Source table not found"})
		return
	}
	if err := database.DB.First(&targetTable, "id = ?", input.TargetTableID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Target table not found"})
		return
	}

	// Check if source column exists and belongs to source table
	var sourceColumn models.Field
	if err := database.DB.Where("id = ? AND table_id = ?", input.SourceColumnID, input.SourceTableID).First(&sourceColumn).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Source column not found or does not belong to source table"})
		return
	}

	// Check for existing link (considering source_column_id)
	var existing models.TableLink
	if err := database.DB.Where("source_table_id = ? AND source_column_id = ? AND target_table_id = ?",
		input.SourceTableID, input.SourceColumnID, input.TargetTableID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Link already exists between these tables and column"})
		return
	}

	// Generate UUID and prepare settings JSON
	linkID := uuid.New()
	settingsJSON, err := json.Marshal(input.Settings)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid settings JSON"})
		return
	}

	// Use raw SQL to insert without updated_at column (PostgreSQL uses $1, $2, etc.)
	link := models.TableLink{}
	query := `
		INSERT INTO table_links (id, created_at, source_table_id, source_column_id, target_table_id, target_column_id, link_type, settings)
		VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7::jsonb)
		RETURNING id, created_at, source_table_id, source_column_id, target_table_id, target_column_id, link_type, settings
	`
	args := []interface{}{linkID, input.SourceTableID, input.SourceColumnID, input.TargetTableID, input.TargetColumnID, input.LinkType, string(settingsJSON)}
	if err := database.DB.Raw(query, args...).Scan(&link).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, link)
}

type UpdateTableLinkInput struct {
	LinkType *string                 `json:"link_type"`
	Settings *map[string]interface{} `json:"settings"`
}

// UpdateTableLink - Update a table link
func UpdateTableLink(c *gin.Context) {
	linkID := c.Param("id")

	var link models.TableLink
	if err := database.DB.First(&link, "id = ?", linkID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table link not found"})
		return
	}

	var input UpdateTableLinkInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.LinkType != nil {
		if *input.LinkType != "one_to_many" && *input.LinkType != "many_to_many" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "link_type must be 'one_to_many' or 'many_to_many'"})
			return
		}
		link.LinkType = *input.LinkType
	}

	if input.Settings != nil {
		link.Settings = mapToJSON(*input.Settings)
	}

	if err := database.DB.Save(&link).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, link)
}

// DeleteTableLink - Delete a table link
func DeleteTableLink(c *gin.Context) {
	linkID := c.Param("id")

	var link models.TableLink
	if err := database.DB.First(&link, "id = ?", linkID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table link not found"})
		return
	}

	if err := database.DB.Delete(&link).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// Table Row Links Handlers - for managing actual row-to-row connections

// GetLinkedRows - Get all rows linked to a specific row
func GetLinkedRows(c *gin.Context) {
	rowID := c.Param("row_id")
	linkID := c.Query("link_id")

	if linkID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "link_id query parameter is required"})
		return
	}

	var rowLinks []models.TableRowLink
	query := database.DB.Where("link_id = ?", linkID)
	query = query.Where("source_row_id = ? OR target_row_id = ?", rowID, rowID)

	if err := query.Find(&rowLinks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("🔗 GetLinkedRows: Found %d row links for row %s with link %s\n", len(rowLinks), rowID, linkID)

	// Get the linked row IDs and create a map for quick lookup
	linkedRowMap := make(map[uuid.UUID]models.TableRowLink)
	linkedRowIDs := make([]uuid.UUID, 0)

	for _, rl := range rowLinks {
		var linkedRowID uuid.UUID
		if rl.SourceRowID.String() == rowID {
			linkedRowID = rl.TargetRowID
		} else {
			linkedRowID = rl.SourceRowID
		}
		linkedRowIDs = append(linkedRowIDs, linkedRowID)
		linkedRowMap[linkedRowID] = rl
	}

	// Fetch the actual row data
	var rows []models.Row
	if len(linkedRowIDs) > 0 {
		if err := database.DB.Where("id IN ?", linkedRowIDs).Find(&rows).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	// Return rows with their link metadata
	type LinkedRowResponse struct {
		Row      models.Row             `json:"row"`
		LinkData map[string]interface{} `json:"link_data"`
		LinkID   uuid.UUID              `json:"row_link_id"`
	}

	response := make([]LinkedRowResponse, 0)
	for _, row := range rows {
		// Find the corresponding row link
		rl, exists := linkedRowMap[row.ID]
		if !exists {
			continue
		}

		// Parse LinkData (stored as metadata in database) from JSON
		var linkData map[string]interface{}
		linkDataBytes := []byte(rl.LinkData)
		if len(linkDataBytes) > 0 && string(linkDataBytes) != "{}" && string(linkDataBytes) != "null" {
			if err := json.Unmarshal(linkDataBytes, &linkData); err != nil {
				linkData = make(map[string]interface{})
			}
		} else {
			linkData = make(map[string]interface{})
		}

		response = append(response, LinkedRowResponse{
			Row:      row,
			LinkData: linkData,
			LinkID:   rl.ID,
		})
	}

	c.JSON(http.StatusOK, response)
}

type CreateTableRowLinkInput struct {
	SourceRowID uuid.UUID              `json:"source_row_id" binding:"required"`
	TargetRowID uuid.UUID              `json:"target_row_id" binding:"required"`
	LinkID      uuid.UUID              `json:"link_id" binding:"required"` // ID of the TableLink
	LinkData    map[string]interface{} `json:"link_data"`                  // Metadata like enrollment_date, status, notes
}

// CreateTableRowLink - Create a link between two rows
func CreateTableRowLink(c *gin.Context) {
	var input CreateTableRowLinkInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify the table link exists
	var tableLink models.TableLink
	if err := database.DB.First(&tableLink, "id = ?", input.LinkID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Table link not found"})
		return
	}

	// Verify rows exist
	var sourceRow, targetRow models.Row
	if err := database.DB.First(&sourceRow, "id = ?", input.SourceRowID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Source row not found"})
		return
	}
	if err := database.DB.First(&targetRow, "id = ?", input.TargetRowID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Target row not found"})
		return
	}

	// Check for existing row link
	var existing models.TableRowLink
	if err := database.DB.Where("link_id = ? AND source_row_id = ? AND target_row_id = ?",
		input.LinkID, input.SourceRowID, input.TargetRowID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Row link already exists"})
		return
	}

	// Use raw SQL to insert without updated_at column
	rowLinkID := uuid.New()
	linkDataJSON, err := json.Marshal(input.LinkData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid link_data JSON"})
		return
	}

	rowLink := models.TableRowLink{}
	query := `
		INSERT INTO table_row_links (id, created_at, link_id, source_row_id, target_row_id, metadata)
		VALUES ($1, NOW(), $2, $3, $4, $5::jsonb)
		RETURNING id, created_at, link_id, source_row_id, target_row_id, metadata
	`
	args := []interface{}{rowLinkID, input.LinkID, input.SourceRowID, input.TargetRowID, string(linkDataJSON)}
	if err := database.DB.Raw(query, args...).Scan(&rowLink).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, rowLink)
}

type UpdateTableRowLinkInput struct {
	LinkData *map[string]interface{} `json:"link_data"`
}

// UpdateTableRowLink - Update row link metadata
func UpdateTableRowLink(c *gin.Context) {
	rowLinkID := c.Param("id")

	var rowLink models.TableRowLink
	if err := database.DB.First(&rowLink, "id = ?", rowLinkID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Row link not found"})
		return
	}

	var input UpdateTableRowLinkInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.LinkData != nil {
		// Use raw SQL to update without updated_at column
		linkDataJSON, err := json.Marshal(*input.LinkData)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid link_data JSON"})
			return
		}

		query := `
			UPDATE table_row_links 
			SET metadata = $1::jsonb
			WHERE id = $2
			RETURNING id, created_at, link_id, source_row_id, target_row_id, metadata
		`
		if err := database.DB.Raw(query, string(linkDataJSON), rowLinkID).Scan(&rowLink).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else {
		// Just return the existing row link
		c.JSON(http.StatusOK, rowLink)
		return
	}

	c.JSON(http.StatusOK, rowLink)
}

// DeleteTableRowLink - Delete a row link
func DeleteTableRowLink(c *gin.Context) {
	rowLinkID := c.Param("id")

	var rowLink models.TableRowLink
	if err := database.DB.First(&rowLink, "id = ?", rowLinkID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Row link not found"})
		return
	}

	if err := database.DB.Delete(&rowLink).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
