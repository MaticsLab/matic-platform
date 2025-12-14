package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Ending page models for API

type EndingBlockProps struct {
	Text      string                 `json:"text,omitempty"`
	Name      string                 `json:"name,omitempty"`
	Color     string                 `json:"color,omitempty"`
	Size      string                 `json:"size,omitempty"`
	Level     int                    `json:"level,omitempty"`
	Align     string                 `json:"align,omitempty"`
	Action    string                 `json:"action,omitempty"`
	URL       string                 `json:"url,omitempty"`
	Variant   string                 `json:"variant,omitempty"`
	FullWidth bool                   `json:"full_width,omitempty"`
	Other     map[string]interface{} `json:"-"` // Catch all for other props
}

type EndingBlockMetadata struct {
	Order  int  `json:"order"`
	Hidden bool `json:"hidden,omitempty"`
	Locked bool `json:"locked,omitempty"`
}

type EndingBlockStyles struct {
	MarginTop     int    `json:"margin_top,omitempty"`
	MarginBottom  int    `json:"margin_bottom,omitempty"`
	MarginLeft    int    `json:"margin_left,omitempty"`
	MarginRight   int    `json:"margin_right,omitempty"`
	PaddingTop    int    `json:"padding_top,omitempty"`
	PaddingBottom int    `json:"padding_bottom,omitempty"`
	CustomClass   string `json:"custom_class,omitempty"`
}

type EndingBlock struct {
	ID         uuid.UUID                `json:"id"`
	BlockType  string                   `json:"block_type"`
	Props      map[string]interface{}   `json:"props"`
	Conditions []map[string]interface{} `json:"conditions,omitempty"`
	Metadata   EndingBlockMetadata      `json:"metadata"`
	Styles     *EndingBlockStyles       `json:"styles,omitempty"`
}

type EndingPageSettings struct {
	Layout          string         `json:"layout"`
	MaxWidth        int            `json:"max_width"`
	Padding         map[string]int `json:"padding"`
	BackgroundColor string         `json:"background_color"`
	MinHeight       *int           `json:"min_height,omitempty"`
}

type EndingPageTheme struct {
	ColorPrimary   string `json:"color_primary"`
	ColorSecondary string `json:"color_secondary"`
	ColorText      string `json:"color_text"`
	ColorSubtext   string `json:"color_subtext"`
	FontFamily     string `json:"font_family"`
	BorderRadius   int    `json:"border_radius"`
}

type EndingPageDTO struct {
	ID          uuid.UUID                `json:"id"`
	FormID      uuid.UUID                `json:"form_id"`
	Name        string                   `json:"name"`
	Description *string                  `json:"description,omitempty"`
	Blocks      []EndingBlock            `json:"blocks"`
	Settings    EndingPageSettings       `json:"settings"`
	Theme       EndingPageTheme          `json:"theme"`
	Conditions  []map[string]interface{} `json:"conditions,omitempty"`
	IsDefault   bool                     `json:"is_default"`
	Priority    int                      `json:"priority"`
	Version     int                      `json:"version"`
	Status      string                   `json:"status"` // draft or published
	CreatedAt   time.Time                `json:"created_at"`
	UpdatedAt   time.Time                `json:"updated_at"`
	PublishedAt *time.Time               `json:"published_at,omitempty"`
}

// ListEndingPages - GET /api/v1/ending-pages
func ListEndingPages(c *gin.Context) {
	formID := c.Query("form_id")

	var endingPages []models.EndingPage
	query := database.DB

	if formID != "" {
		query = query.Where("form_id = ?", formID)
	}

	// Order by priority (lower = higher priority), then by created_at for tiebreaking
	if err := query.Order("priority ASC, created_at ASC").Find(&endingPages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch ending pages"})
		return
	}

	result := make([]EndingPageDTO, len(endingPages))
	for i, ep := range endingPages {
		result[i] = endingPageToDTO(ep)
	}

	c.JSON(http.StatusOK, result)
}

// GetEndingPage - GET /api/v1/ending-pages/:id
func GetEndingPage(c *gin.Context) {
	id := c.Param("id")

	var endingPage models.EndingPage
	if err := database.DB.First(&endingPage, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ending page not found"})
		return
	}

	c.JSON(http.StatusOK, endingPageToDTO(endingPage))
}

// CreateEndingPage - POST /api/v1/ending-pages
func CreateEndingPage(c *gin.Context) {
	var dto EndingPageDTO

	if err := c.BindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Validate form exists
	var form models.Table
	if err := database.DB.First(&form, "id = ?", dto.FormID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form not found"})
		return
	}

	// Create ending page
	endingPage := models.EndingPage{
		FormID:      dto.FormID,
		Name:        dto.Name,
		Description: dto.Description,
		IsDefault:   dto.IsDefault,
		Version:     1,
		Status:      "draft",
	}

	// Marshal settings
	if settingsJSON, err := json.Marshal(dto.Settings); err == nil {
		endingPage.Settings = settingsJSON
	}

	// Marshal theme
	if themeJSON, err := json.Marshal(dto.Theme); err == nil {
		endingPage.Theme = themeJSON
	}

	// Marshal blocks
	if blocksJSON, err := json.Marshal(dto.Blocks); err == nil {
		endingPage.Blocks = blocksJSON
	}

	// Marshal conditions if provided
	if len(dto.Conditions) > 0 {
		if condJSON, err := json.Marshal(dto.Conditions); err == nil {
			endingPage.Conditions = condJSON
		}
	}

	if err := database.DB.Create(&endingPage).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ending page"})
		return
	}

	c.JSON(http.StatusCreated, endingPageToDTO(endingPage))
}

// UpdateEndingPage - PUT /api/v1/ending-pages/:id
func UpdateEndingPage(c *gin.Context) {
	id := c.Param("id")
	var dto EndingPageDTO

	if err := c.BindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	var endingPage models.EndingPage
	if err := database.DB.First(&endingPage, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ending page not found"})
		return
	}

	// Update fields
	endingPage.Name = dto.Name
	endingPage.Description = dto.Description
	endingPage.IsDefault = dto.IsDefault
	endingPage.Status = dto.Status
	endingPage.UpdatedAt = time.Now()

	if dto.Status == "published" {
		now := time.Now()
		endingPage.PublishedAt = &now
		endingPage.Version++
	}

	// Marshal updated JSON fields
	if settingsJSON, err := json.Marshal(dto.Settings); err == nil {
		endingPage.Settings = settingsJSON
	}

	if themeJSON, err := json.Marshal(dto.Theme); err == nil {
		endingPage.Theme = themeJSON
	}

	if blocksJSON, err := json.Marshal(dto.Blocks); err == nil {
		endingPage.Blocks = blocksJSON
	}

	if len(dto.Conditions) > 0 {
		if condJSON, err := json.Marshal(dto.Conditions); err == nil {
			endingPage.Conditions = condJSON
		}
	}

	if err := database.DB.Save(&endingPage).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update ending page"})
		return
	}

	c.JSON(http.StatusOK, endingPageToDTO(endingPage))
}

// DeleteEndingPage - DELETE /api/v1/ending-pages/:id
func DeleteEndingPage(c *gin.Context) {
	id := c.Param("id")

	if err := database.DB.Delete(&models.EndingPage{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete ending page"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Ending page deleted"})
}

// FindMatchingEnding - POST /api/v1/ending-pages/match
// Rule-based ending selection: evaluates conditions by priority, falls back to is_default
func FindMatchingEnding(c *gin.Context) {
	var req struct {
		FormID         uuid.UUID              `json:"form_id"`
		SubmissionData map[string]interface{} `json:"submission_data"`
	}

	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	var endingPages []models.EndingPage
	if err := database.DB.
		Where("form_id = ? AND status = ?", req.FormID, "published").
		Order("priority ASC, created_at ASC").
		Find(&endingPages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch ending pages"})
		return
	}

	// Find first matching ending based on priority order
	var matchingEnding *models.EndingPage
	var defaultEnding *models.EndingPage
	var noConditionEnding *models.EndingPage

	for i := range endingPages {
		ep := &endingPages[i]

		// Track the default ending
		if ep.IsDefault {
			defaultEnding = ep
		}

		// Parse conditions from JSON
		var conditions []map[string]interface{}
		json.Unmarshal(ep.Conditions, &conditions)

		// If no conditions, this is a catch-all (track for fallback)
		if len(conditions) == 0 {
			if noConditionEnding == nil {
				noConditionEnding = ep
			}
			continue
		}

		// Check if all conditions match
		if evaluateConditions(conditions, req.SubmissionData) {
			matchingEnding = ep
			break
		}
	}

	// Fallback chain: matched -> default -> no-condition -> first
	if matchingEnding == nil {
		if defaultEnding != nil {
			matchingEnding = defaultEnding
		} else if noConditionEnding != nil {
			matchingEnding = noConditionEnding
		} else if len(endingPages) > 0 {
			matchingEnding = &endingPages[0]
		}
	}

	if matchingEnding == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No ending page found"})
		return
	}

	c.JSON(http.StatusOK, endingPageToDTO(*matchingEnding))
}

// SetDefaultEnding - PUT /api/v1/ending-pages/:id/default
// Sets an ending as the primary default for its form
func SetDefaultEnding(c *gin.Context) {
	id := c.Param("id")

	var endingPage models.EndingPage
	if err := database.DB.First(&endingPage, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ending page not found"})
		return
	}

	// Unset all other defaults for this form
	database.DB.Model(&models.EndingPage{}).
		Where("form_id = ? AND id != ?", endingPage.FormID, id).
		Update("is_default", false)

	// Set this one as default
	endingPage.IsDefault = true
	endingPage.UpdatedAt = time.Now()

	if err := database.DB.Save(&endingPage).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set default ending"})
		return
	}

	c.JSON(http.StatusOK, endingPageToDTO(endingPage))
}

// ReorderEndings - PUT /api/v1/ending-pages/reorder
// Updates the priority order of endings for a form
func ReorderEndings(c *gin.Context) {
	var req struct {
		FormID uuid.UUID `json:"form_id"`
		Order  []struct {
			EndingID string `json:"ending_id"`
			Priority int    `json:"priority"`
		} `json:"order"`
	}

	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Update priorities in a transaction
	tx := database.DB.Begin()
	for _, item := range req.Order {
		if err := tx.Model(&models.EndingPage{}).
			Where("id = ? AND form_id = ?", item.EndingID, req.FormID).
			Updates(map[string]interface{}{
				"priority":   item.Priority,
				"updated_at": time.Now(),
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update priorities"})
			return
		}
	}
	tx.Commit()

	// Return updated list
	var endingPages []models.EndingPage
	database.DB.Where("form_id = ?", req.FormID).Order("priority ASC").Find(&endingPages)

	result := make([]EndingPageDTO, len(endingPages))
	for i, ep := range endingPages {
		result[i] = endingPageToDTO(ep)
	}

	c.JSON(http.StatusOK, result)
}

// Helper functions

func endingPageToDTO(ep models.EndingPage) EndingPageDTO {
	var settings EndingPageSettings
	json.Unmarshal(ep.Settings, &settings)

	var theme EndingPageTheme
	json.Unmarshal(ep.Theme, &theme)

	var blocks []EndingBlock
	json.Unmarshal(ep.Blocks, &blocks)

	var conditions []map[string]interface{}
	json.Unmarshal(ep.Conditions, &conditions)

	return EndingPageDTO{
		ID:          ep.ID,
		FormID:      ep.FormID,
		Name:        ep.Name,
		Description: ep.Description,
		Blocks:      blocks,
		Settings:    settings,
		Theme:       theme,
		Conditions:  conditions,
		IsDefault:   ep.IsDefault,
		Priority:    ep.Priority,
		Version:     ep.Version,
		Status:      ep.Status,
		CreatedAt:   ep.CreatedAt,
		UpdatedAt:   ep.UpdatedAt,
		PublishedAt: ep.PublishedAt,
	}
}

func evaluateConditions(conditions []map[string]interface{}, data map[string]interface{}) bool {
	for _, cond := range conditions {
		fieldID, ok := cond["fieldId"].(string)
		if !ok {
			return false
		}

		operator, ok := cond["operator"].(string)
		if !ok {
			return false
		}

		value := cond["value"]
		fieldValue := data[fieldID]

		if !evaluateSingleCondition(operator, fieldValue, value) {
			return false
		}
	}
	return true
}

func evaluateSingleCondition(operator string, fieldValue, conditionValue interface{}) bool {
	switch operator {
	case "equals":
		return fieldValue == conditionValue
	case "notEquals":
		return fieldValue != conditionValue
	case "contains":
		if fv, ok := fieldValue.(string); ok {
			if cv, ok := conditionValue.(string); ok {
				return strings.Contains(fv, cv)
			}
		}
		return false
	case "isEmpty":
		return fieldValue == nil || fieldValue == ""
	case "isNotEmpty":
		return fieldValue != nil && fieldValue != ""
	default:
		return true
	}
}
