package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/middleware"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Portal theme DTO shapes for the API

type PortalThemeColors struct {
	QuestionsBackgroundColor string `json:"questions_background_color"`
	PrimaryColor             string `json:"primary_color"`
	QuestionsColor           string `json:"questions_color"`
	AnswersColor             string `json:"answers_color"`
}

type PortalThemeLogo struct {
	Enabled bool     `json:"enabled"`
	Urls    []string `json:"urls"`
}

type PortalThemeImage struct {
	Position   string `json:"position"`
	AssetURL   string `json:"asset_url,omitempty"`
	Brightness int    `json:"brightness"`
}

type PortalThemeDTO struct {
	ID           uuid.UUID         `json:"id"`
	WorkspaceID  uuid.UUID         `json:"workspace_id"`
	Name         string            `json:"name"`
	Colors       PortalThemeColors `json:"colors"`
	Font         string            `json:"font"`
	Logo         PortalThemeLogo   `json:"logo"`
	Image        PortalThemeImage  `json:"image"`
	QuestionSize string            `json:"question_size"`
	IsDefault    bool              `json:"is_default"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

// ListPortalThemes - GET /api/v1/portal-themes?workspace_id=xxx
func ListPortalThemes(c *gin.Context) {
	workspaceID := c.Query("workspace_id")
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}

	wsID, err := uuid.Parse(workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	if _, isMember := checkWorkspaceMembership(wsID, userID); !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this workspace"})
		return
	}

	var themes []models.PortalTheme
	if err := database.DB.
		Where("workspace_id = ?", wsID).
		Order("is_default DESC, name ASC").
		Find(&themes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch portal themes"})
		return
	}

	result := make([]PortalThemeDTO, len(themes))
	for i, t := range themes {
		result[i] = portalThemeToDTO(t)
	}
	c.JSON(http.StatusOK, result)
}

// GetPortalTheme - GET /api/v1/portal-themes/:id
func GetPortalTheme(c *gin.Context) {
	id := c.Param("id")

	var theme models.PortalTheme
	if err := database.DB.First(&theme, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Portal theme not found"})
		return
	}

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	if _, isMember := checkWorkspaceMembership(theme.WorkspaceID, userID); !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this workspace"})
		return
	}

	c.JSON(http.StatusOK, portalThemeToDTO(theme))
}

// CreatePortalTheme - POST /api/v1/portal-themes
func CreatePortalTheme(c *gin.Context) {
	var dto PortalThemeDTO
	if err := c.BindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	if dto.WorkspaceID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id is required"})
		return
	}
	if dto.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	if _, isMember := checkWorkspaceMembership(dto.WorkspaceID, userID); !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this workspace"})
		return
	}

	theme := models.PortalTheme{
		WorkspaceID:  dto.WorkspaceID,
		Name:         dto.Name,
		Font:         dto.Font,
		QuestionSize: dto.QuestionSize,
	}
	if colorsJSON, err := json.Marshal(dto.Colors); err == nil {
		theme.Colors = colorsJSON
	}
	if logoJSON, err := json.Marshal(dto.Logo); err == nil {
		theme.Logo = logoJSON
	}
	if imageJSON, err := json.Marshal(dto.Image); err == nil {
		theme.Image = imageJSON
	}

	if err := database.DB.Create(&theme).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create portal theme"})
		return
	}

	c.JSON(http.StatusCreated, portalThemeToDTO(theme))
}

// UpdatePortalTheme - PATCH /api/v1/portal-themes/:id
// Full-replace on the editable fields (name, colors, font, logo, image, question size),
// matching this codebase's existing ending-pages update convention.
func UpdatePortalTheme(c *gin.Context) {
	id := c.Param("id")
	var dto PortalThemeDTO
	if err := c.BindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	var theme models.PortalTheme
	if err := database.DB.First(&theme, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Portal theme not found"})
		return
	}

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	if _, isMember := checkWorkspaceMembership(theme.WorkspaceID, userID); !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this workspace"})
		return
	}

	theme.Name = dto.Name
	theme.Font = dto.Font
	theme.QuestionSize = dto.QuestionSize
	if colorsJSON, err := json.Marshal(dto.Colors); err == nil {
		theme.Colors = colorsJSON
	}
	if logoJSON, err := json.Marshal(dto.Logo); err == nil {
		theme.Logo = logoJSON
	}
	if imageJSON, err := json.Marshal(dto.Image); err == nil {
		theme.Image = imageJSON
	}

	if err := database.DB.Save(&theme).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update portal theme"})
		return
	}

	c.JSON(http.StatusOK, portalThemeToDTO(theme))
}

// DeletePortalTheme - DELETE /api/v1/portal-themes/:id
func DeletePortalTheme(c *gin.Context) {
	id := c.Param("id")

	var theme models.PortalTheme
	if err := database.DB.First(&theme, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Portal theme not found"})
		return
	}

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	if _, isMember := checkWorkspaceMembership(theme.WorkspaceID, userID); !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this workspace"})
		return
	}

	if err := database.DB.Delete(&models.PortalTheme{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete portal theme"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Portal theme deleted"})
}

// DuplicatePortalTheme - POST /api/v1/portal-themes/:id/duplicate
func DuplicatePortalTheme(c *gin.Context) {
	id := c.Param("id")

	var original models.PortalTheme
	if err := database.DB.First(&original, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Portal theme not found"})
		return
	}

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	if _, isMember := checkWorkspaceMembership(original.WorkspaceID, userID); !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this workspace"})
		return
	}

	duplicate := models.PortalTheme{
		WorkspaceID:  original.WorkspaceID,
		Name:         original.Name + " (copy)",
		Colors:       original.Colors,
		Font:         original.Font,
		Logo:         original.Logo,
		Image:        original.Image,
		QuestionSize: original.QuestionSize,
		IsDefault:    false,
	}

	if err := database.DB.Create(&duplicate).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to duplicate portal theme"})
		return
	}

	c.JSON(http.StatusCreated, portalThemeToDTO(duplicate))
}

// SetDefaultPortalTheme - POST /api/v1/portal-themes/:id/default
func SetDefaultPortalTheme(c *gin.Context) {
	id := c.Param("id")

	var theme models.PortalTheme
	if err := database.DB.First(&theme, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Portal theme not found"})
		return
	}

	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	if _, isMember := checkWorkspaceMembership(theme.WorkspaceID, userID); !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this workspace"})
		return
	}

	// Unset all other defaults for this workspace
	database.DB.Model(&models.PortalTheme{}).
		Where("workspace_id = ? AND id != ?", theme.WorkspaceID, id).
		Update("is_default", false)

	theme.IsDefault = true
	theme.UpdatedAt = time.Now()
	if err := database.DB.Save(&theme).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set default portal theme"})
		return
	}

	c.JSON(http.StatusOK, portalThemeToDTO(theme))
}

func portalThemeToDTO(t models.PortalTheme) PortalThemeDTO {
	var colors PortalThemeColors
	json.Unmarshal(t.Colors, &colors)

	var logo PortalThemeLogo
	json.Unmarshal(t.Logo, &logo)

	var image PortalThemeImage
	json.Unmarshal(t.Image, &image)

	return PortalThemeDTO{
		ID:           t.ID,
		WorkspaceID:  t.WorkspaceID,
		Name:         t.Name,
		Colors:       colors,
		Font:         t.Font,
		Logo:         logo,
		Image:        image,
		QuestionSize: t.QuestionSize,
		IsDefault:    t.IsDefault,
		CreatedAt:    t.CreatedAt,
		UpdatedAt:    t.UpdatedAt,
	}
}
