package models

import (
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// PortalTheme is a workspace-level, reusable visual theme for public form
// portals — saved independently of any single form so it can be applied
// across many forms in the same workspace.
type PortalTheme struct {
	BaseModel
	WorkspaceID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	Name         string         `gorm:"type:text;not null" json:"name"`
	Colors       datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"colors"`
	Font         string         `gorm:"type:varchar(50);default:'open_sans'" json:"font"`
	Logo         datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"logo"`
	Image        datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"image"`
	QuestionSize string         `gorm:"type:varchar(20);default:'normal'" json:"question_size"`
	IsDefault    bool           `gorm:"default:false" json:"is_default"`
}

func (PortalTheme) TableName() string {
	return "portal_themes"
}
