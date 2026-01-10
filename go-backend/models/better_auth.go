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
	UserType             string    `json:"userType" gorm:"column:user_type;default:'staff'"` // staff, applicant, reviewer
	Metadata             []byte    `json:"metadata,omitempty" gorm:"column:metadata;type:jsonb;default:'{}'"` // JSONB metadata
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

// BetterAuthAccount represents an authentication account in the Better Auth system
// This table stores accounts for both credential (email/password) and OAuth providers
//
// For CREDENTIAL (email/password) accounts:
//   - provider_id = "credential"
//   - password: Contains scrypt-hashed password (format: "salt:hash")
//   - access_token, refresh_token, id_token: NULL (not used for credential auth)
//   - account_id: Links to Supabase user ID for migration tracking
//
// For OAUTH providers (Google, GitHub, etc.):
//   - provider_id = "google", "github", etc.
//   - password: NULL (not used for OAuth)
//   - access_token, refresh_token, id_token: OAuth tokens from provider
//   - account_id: Provider's user ID
type BetterAuthAccount struct {
	ID                    string     `json:"id" gorm:"primaryKey;column:id"`
	AccountID            string     `json:"accountId" gorm:"column:account_id"` // Provider's account ID or Supabase user ID for migrated users
	ProviderID            string     `json:"providerId" gorm:"column:provider_id"` // "credential", "google", "github", etc.
	UserID                string     `json:"userId" gorm:"column:user_id"`
	Password              *string    `json:"password,omitempty" gorm:"column:password"` // Scrypt-hashed password for credential auth
	AccessToken           *string    `json:"accessToken,omitempty" gorm:"column:access_token"` // OAuth access token (NULL for credential)
	RefreshToken          *string    `json:"refreshToken,omitempty" gorm:"column:refresh_token"` // OAuth refresh token (NULL for credential)
	IDToken               *string    `json:"idToken,omitempty" gorm:"column:id_token"` // OAuth ID token (NULL for credential)
	AccessTokenExpiresAt  *time.Time `json:"accessTokenExpiresAt,omitempty" gorm:"column:access_token_expires_at"`
	RefreshTokenExpiresAt *time.Time `json:"refreshTokenExpiresAt,omitempty" gorm:"column:refresh_token_expires_at"`
	Scope                 *string    `json:"scope,omitempty" gorm:"column:scope"` // OAuth scope (NULL for credential)
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
