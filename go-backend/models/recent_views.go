package models

import (
	"time"

	"github.com/google/uuid"
)

// RecentlyViewed tracks the last time a user opened a form or table in a workspace.
// One row per (workspace, user, entity) — re-viewing updates ViewedAt instead of
// inserting a duplicate, enforced by the composite unique index below.
type RecentlyViewed struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	WorkspaceID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_recent_view;index" json:"workspace_id"`
	BAUserID    string    `gorm:"type:text;not null;uniqueIndex:idx_recent_view;index" json:"ba_user_id"`
	EntityID    uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_recent_view" json:"entity_id"`
	EntityType  string    `gorm:"type:varchar(20);not null;uniqueIndex:idx_recent_view" json:"entity_type"` // "form" | "table"
	ViewedAt    time.Time `gorm:"not null;index" json:"viewed_at"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (RecentlyViewed) TableName() string {
	return "recently_viewed"
}
