package models

import (
	"time"

	"github.com/google/uuid"
)

// StarredItem marks a form or table as starred by a specific user.
// Existence of a row = starred; unstarring deletes the row.
type StarredItem struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	WorkspaceID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_starred_item;index" json:"workspace_id"`
	BAUserID    string    `gorm:"type:text;not null;uniqueIndex:idx_starred_item;index" json:"ba_user_id"`
	EntityID    uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_starred_item" json:"entity_id"`
	EntityType  string    `gorm:"type:varchar(20);not null;uniqueIndex:idx_starred_item" json:"entity_type"` // "form" | "table"
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (StarredItem) TableName() string {
	return "starred_items"
}
