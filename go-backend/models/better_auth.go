package models

import (
	"time"
)

// BetterAuthUser represents a user in the Better Auth system
type BetterAuthUser struct {
	ID                   string    `json:"id" gorm:"primaryKey;column:id"`
	Name                 string    `json:"name" gorm:"column:name"`
	Email                string    `json:"email" gorm:"column:email;uniqueIndex"`
	EmailVerified        bool      `json:"emailVerified" gorm:"column:email_verified;default:false"`
	Image                *string   `json:"image" gorm:"column:image"`
	CreatedAt            time.Time `json:"createdAt" gorm:"column:created_at"`
	UpdatedAt            time.Time `json:"updatedAt" gorm:"column:updated_at"`
	SupabaseUserID       *string   `json:"supabaseUserId" gorm:"column:supabase_user_id"`
	MigratedFromSupabase bool      `json:"migratedFromSupabase" gorm:"column:migrated_from_supabase;default:false"`
	FullName             *string   `json:"fullName" gorm:"column:full_name"`
	AvatarURL            *string   `json:"avatarUrl" gorm:"column:avatar_url"`
}

// TableName returns the table name for BetterAuthUser
func (BetterAuthUser) TableName() string {
	return "ba_users"
}

// BetterAuthSession represents a session in the Better Auth system
type BetterAuthSession struct {
	ID                   string    `json:"id" gorm:"primaryKey;column:id"`
	ExpiresAt            time.Time `json:"expiresAt" gorm:"column:expires_at"`
	Token                string    `json:"token" gorm:"column:token;uniqueIndex"`
	CreatedAt            time.Time `json:"createdAt" gorm:"column:created_at"`
	UpdatedAt            time.Time `json:"updatedAt" gorm:"column:updated_at"`
	IPAddress            *string   `json:"ipAddress" gorm:"column:ip_address"`
	UserAgent            *string   `json:"userAgent" gorm:"column:user_agent"`
	UserID               string    `json:"userId" gorm:"column:user_id"`
	ActiveOrganizationID *string   `json:"activeOrganizationId" gorm:"column:active_organization_id"`

	// Relationships
	User BetterAuthUser `json:"user" gorm:"foreignKey:UserID;references:ID"`
}

// TableName returns the table name for BetterAuthSession
func (BetterAuthSession) TableName() string {
	return "ba_sessions"
}

// IsExpired checks if the session has expired
func (s *BetterAuthSession) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// BetterAuthAccount represents an OAuth account in the Better Auth system
type BetterAuthAccount struct {
	ID                    string     `json:"id" gorm:"primaryKey;column:id"`
	AccountID             string     `json:"accountId" gorm:"column:account_id"`
	ProviderID            string     `json:"providerId" gorm:"column:provider_id"`
	UserID                string     `json:"userId" gorm:"column:user_id"`
	AccessToken           *string    `json:"accessToken" gorm:"column:access_token"`
	RefreshToken          *string    `json:"refreshToken" gorm:"column:refresh_token"`
	IDToken               *string    `json:"idToken" gorm:"column:id_token"`
	AccessTokenExpiresAt  *time.Time `json:"accessTokenExpiresAt" gorm:"column:access_token_expires_at"`
	RefreshTokenExpiresAt *time.Time `json:"refreshTokenExpiresAt" gorm:"column:refresh_token_expires_at"`
	Scope                 *string    `json:"scope" gorm:"column:scope"`
	CreatedAt             time.Time  `json:"createdAt" gorm:"column:created_at"`
	UpdatedAt             time.Time  `json:"updatedAt" gorm:"column:updated_at"`

	// Relationships
	User BetterAuthUser `json:"user" gorm:"foreignKey:UserID;references:ID"`
}

// TableName returns the table name for BetterAuthAccount
func (BetterAuthAccount) TableName() string {
	return "ba_accounts"
}

// BetterAuthOrganization represents an organization in the Better Auth system
type BetterAuthOrganization struct {
	ID        string    `json:"id" gorm:"primaryKey;column:id"`
	Name      string    `json:"name" gorm:"column:name"`
	Slug      string    `json:"slug" gorm:"column:slug;uniqueIndex"`
	Logo      *string   `json:"logo" gorm:"column:logo"`
	Metadata  *string   `json:"metadata" gorm:"column:metadata;type:text"`
	CreatedAt time.Time `json:"createdAt" gorm:"column:created_at"`
}

// TableName returns the table name for BetterAuthOrganization
func (BetterAuthOrganization) TableName() string {
	return "ba_organizations"
}

// BetterAuthMember represents an organization membership
type BetterAuthMember struct {
	ID             string    `json:"id" gorm:"primaryKey;column:id"`
	OrganizationID string    `json:"organizationId" gorm:"column:organization_id"`
	UserID         string    `json:"userId" gorm:"column:user_id"`
	Role           string    `json:"role" gorm:"column:role;default:'member'"`
	CreatedAt      time.Time `json:"createdAt" gorm:"column:created_at"`

	// Relationships
	Organization BetterAuthOrganization `json:"organization" gorm:"foreignKey:OrganizationID;references:ID"`
	User         BetterAuthUser         `json:"user" gorm:"foreignKey:UserID;references:ID"`
}

// TableName returns the table name for BetterAuthMember
func (BetterAuthMember) TableName() string {
	return "ba_members"
}
