package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// GmailConnection stores OAuth tokens for Gmail API
type GmailConnection struct {
	ID              uuid.UUID      `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	WorkspaceID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	UserID          string         `gorm:"not null" json:"user_id"` // Supabase user ID who connected
	Email           string         `gorm:"not null" json:"email"`
	DisplayName     string         `json:"display_name,omitempty"`
	AccessToken     string         `gorm:"not null" json:"-"` // Don't expose in JSON
	RefreshToken    string         `gorm:"not null" json:"-"` // Don't expose in JSON
	TokenExpiry     time.Time      `json:"token_expiry"`
	Scopes          datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"scopes"`
	SendPermission  string         `gorm:"default:'myself'" json:"send_permission"` // myself, admins, members, everyone, specific
	AllowedUserIDs  datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"allowed_user_ids,omitempty"`
	IsDefault       bool           `gorm:"default:false" json:"is_default"`
	CreatedAt       time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
}

func (g *GmailConnection) TableName() string {
	return "gmail_connections"
}

// EmailCampaign represents a batch email send
type EmailCampaign struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	FormID      *uuid.UUID     `gorm:"type:uuid;index" json:"form_id,omitempty"`
	Subject     string         `gorm:"not null" json:"subject"`
	Body        string         `gorm:"type:text;not null" json:"body"`
	BodyHTML    string         `gorm:"type:text" json:"body_html,omitempty"`
	SenderEmail string         `gorm:"not null" json:"sender_email"`
	SenderName  string         `json:"sender_name,omitempty"`
	Status      string         `gorm:"default:'draft'" json:"status"` // draft, sending, sent, failed
	Metadata    datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"metadata,omitempty"`
	SentAt      *time.Time     `json:"sent_at,omitempty"`
	CreatedAt   time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"autoUpdateTime" json:"updated_at"`

	// Aggregated stats
	TotalRecipients int `gorm:"-" json:"total_recipients"`
	OpenedCount     int `gorm:"-" json:"opened_count"`
	ClickedCount    int `gorm:"-" json:"clicked_count"`
}

func (e *EmailCampaign) TableName() string {
	return "email_campaigns"
}

// SentEmail represents an individual sent email
type SentEmail struct {
	ID           uuid.UUID  `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	CampaignID   *uuid.UUID `gorm:"type:uuid;index" json:"campaign_id,omitempty"`
	WorkspaceID  uuid.UUID  `gorm:"type:uuid;not null;index" json:"workspace_id"`
	FormID       *uuid.UUID `gorm:"type:uuid;index" json:"form_id,omitempty"`
	SubmissionID *uuid.UUID `gorm:"type:uuid;index" json:"submission_id,omitempty"`
	RecipientEmail string   `gorm:"not null;index" json:"recipient_email"`
	RecipientName  string   `json:"recipient_name,omitempty"`
	Subject        string   `gorm:"not null" json:"subject"`
	Body           string   `gorm:"type:text;not null" json:"body"`
	BodyHTML       string   `gorm:"type:text" json:"body_html,omitempty"`
	SenderEmail    string   `gorm:"not null" json:"sender_email"`
	SenderName     string   `json:"sender_name,omitempty"`
	GmailMessageID string   `json:"gmail_message_id,omitempty"`
	GmailThreadID  string   `json:"gmail_thread_id,omitempty"`
	TrackingID     string   `gorm:"uniqueIndex" json:"tracking_id"`
	Status         string   `gorm:"default:'sent'" json:"status"` // sent, delivered, opened, clicked, bounced, failed
	OpenedAt       *time.Time `json:"opened_at,omitempty"`
	OpenCount      int        `gorm:"default:0" json:"open_count"`
	ClickedAt      *time.Time `json:"clicked_at,omitempty"`
	ClickCount     int        `gorm:"default:0" json:"click_count"`
	BouncedAt      *time.Time `json:"bounced_at,omitempty"`
	BounceReason   string     `json:"bounce_reason,omitempty"`
	SentAt         time.Time  `gorm:"autoCreateTime" json:"sent_at"`
	CreatedAt      time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
}

func (s *SentEmail) TableName() string {
	return "sent_emails"
}

// EmailTemplate stores reusable email templates
type EmailTemplate struct {
	ID             uuid.UUID      `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	WorkspaceID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"workspace_id"`
	FormID         *uuid.UUID     `gorm:"type:uuid;index" json:"form_id,omitempty"`
	CreatedByID    string         `json:"created_by_id,omitempty"` // User who created
	Name           string         `gorm:"not null" json:"name"`
	Subject        string         `json:"subject,omitempty"` // Optional - can use different subjects
	Body           string         `gorm:"type:text;not null" json:"body"`
	BodyHTML       string         `gorm:"type:text" json:"body_html,omitempty"`
	Type           string         `gorm:"default:'manual'" json:"type"` // manual, automated
	TriggerOn      string         `json:"trigger_on,omitempty"`         // For automated: submission, approval, rejection
	IsActive       bool           `gorm:"default:true" json:"is_active"`
	ShareWith      string         `gorm:"default:'everyone'" json:"share_with"` // only_me, everyone, admins, specific
	SharedUserIDs  datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"shared_user_ids,omitempty"`
	Metadata       datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"metadata,omitempty"`
	CreatedAt      time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
}

func (t *EmailTemplate) TableName() string {
	return "email_templates"
}

// EmailSignature stores email signatures per user
type EmailSignature struct {
	ID            uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	WorkspaceID   uuid.UUID `gorm:"type:uuid;not null;index" json:"workspace_id"`
	UserID        string    `gorm:"not null;index" json:"user_id"` // Supabase user ID
	Name          string    `gorm:"not null" json:"name"`
	Content       string    `gorm:"type:text;not null" json:"content"`      // Plain text or rich text
	ContentHTML   string    `gorm:"type:text" json:"content_html,omitempty"` // HTML version
	IsHTML        bool      `gorm:"default:false" json:"is_html"`
	IsDefault     bool      `gorm:"default:false" json:"is_default"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (s *EmailSignature) TableName() string {
	return "email_signatures"
}
