package handlers

import (
	"encoding/json"
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
	SourceTableID uuid.UUID              `json:"source_table_id" binding:"required"`
	TargetTableID uuid.UUID              `json:"target_table_id" binding:"required"`
	LinkType      string                 `json:"link_type" binding:"required"`
	Settings      map[string]interface{} `json:"settings"`
}

// CreateTableLink - Create a relationship between two tables
func CreateTableLink(c *gin.Context) {
	var input CreateTableLinkInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate link type
	if input.LinkType != "one_to_many" && input.LinkType != "many_to_many" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "link_type must be 'one_to_many' or 'many_to_many'"})
		return
	}

	// Check if tables exist
	var sourceTable, targetTable models.DataTable
	if err := database.DB.First(&sourceTable, "id = ?", input.SourceTableID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Source table not found"})
		return
	}
	if err := database.DB.First(&targetTable, "id = ?", input.TargetTableID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Target table not found"})
		return
	}

	// Check for existing link
	var existing models.TableLink
	if err := database.DB.Where("source_table_id = ? AND target_table_id = ?",
		input.SourceTableID, input.TargetTableID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Link already exists between these tables"})
		return
	}

	link := models.TableLink{
		SourceTableID: input.SourceTableID,
		TargetTableID: input.TargetTableID,
		LinkType:      input.LinkType,
		Settings:      mapToJSON(input.Settings),
	}

	if err := database.DB.Create(&link).Error; err != nil {
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

	// Get the linked row IDs
	linkedRowIDs := make([]uuid.UUID, 0)
	for _, rl := range rowLinks {
		if rl.SourceRowID.String() == rowID {
			linkedRowIDs = append(linkedRowIDs, rl.TargetRowID)
		} else {
			linkedRowIDs = append(linkedRowIDs, rl.SourceRowID)
		}
	}

	// Fetch the actual row data
	var rows []models.TableRow
	if len(linkedRowIDs) > 0 {
		if err := database.DB.Where("id IN ?", linkedRowIDs).Find(&rows).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	// Return rows with their link metadata
	type LinkedRowResponse struct {
		Row      models.TableRow        `json:"row"`
		LinkData map[string]interface{} `json:"link_data"`
		LinkID   uuid.UUID              `json:"row_link_id"`
	}

	response := make([]LinkedRowResponse, 0)
	for i, row := range rows {
		// Parse LinkData from JSON
		var linkData map[string]interface{}
		if err := json.Unmarshal([]byte(rowLinks[i].LinkData), &linkData); err != nil {
			linkData = make(map[string]interface{})
		}
		
		response = append(response, LinkedRowResponse{
			Row:      row,
			LinkData: linkData,
			LinkID:   rowLinks[i].ID,
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
	var sourceRow, targetRow models.TableRow
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

	rowLink := models.TableRowLink{
		LinkID:      input.LinkID,
		SourceRowID: input.SourceRowID,
		TargetRowID: input.TargetRowID,
		LinkData:    mapToJSON(input.LinkData),
	}

	if err := database.DB.Create(&rowLink).Error; err != nil {
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
		rowLink.LinkData = mapToJSON(*input.LinkData)
	}

	if err := database.DB.Save(&rowLink).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
