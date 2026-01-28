package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// WorkspaceIntegration represents a third-party integration configuration for a workspace
type WorkspaceIntegration struct {
	ID              uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	WorkspaceID     uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	IntegrationType string         `gorm:"type:text;not null" json:"integration_type"`
	IsEnabled       bool           `gorm:"default:false" json:"is_enabled"`
	IsConnected     bool           `gorm:"default:false" json:"is_connected"`
	AccessToken     string         `gorm:"type:text" json:"-"` // Don't expose tokens in JSON
	RefreshToken    string         `gorm:"type:text" json:"-"`
	TokenExpiresAt  *time.Time     `json:"token_expires_at,omitempty"`
	Config          datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"config"`
	ConnectedEmail  string         `gorm:"type:text" json:"connected_email,omitempty"`
	ConnectedAt     *time.Time     `json:"connected_at,omitempty"`
	LastSyncAt      *time.Time     `json:"last_sync_at,omitempty"`
	CreatedAt       time.Time      `gorm:"default:now()" json:"created_at"`
	UpdatedAt       time.Time      `gorm:"default:now()" json:"updated_at"`
	CreatedBy       *string        `gorm:"type:text" json:"created_by,omitempty"` // Better Auth user ID (TEXT)

	// Associations
	Workspace               Workspace                `gorm:"foreignKey:WorkspaceID" json:"-"`
	FormIntegrationSettings []FormIntegrationSetting `gorm:"foreignKey:WorkspaceIntegrationID" json:"form_settings,omitempty"`
}

func (WorkspaceIntegration) TableName() string {
	return "workspace_integrations"
}

// GoogleDriveConfig represents the configuration for Google Drive integration
type GoogleDriveConfig struct {
	RootFolderID    string `json:"root_folder_id,omitempty"`
	RootFolderName  string `json:"root_folder_name,omitempty"`
	RootFolderURL   string `json:"root_folder_url,omitempty"`
	FolderStructure string `json:"folder_structure,omitempty"` // "flat" or "nested"
	SyncSettings    struct {
		SyncOnSubmit           bool `json:"sync_on_submit"`
		SyncOnFileUpload       bool `json:"sync_on_file_upload"`
		CreateApplicantFolders bool `json:"create_applicant_folders"`
	} `json:"sync_settings"`
}

// FormIntegrationSetting represents per-form settings for an integration
type FormIntegrationSetting struct {
	ID                     uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	FormID                 uuid.UUID      `gorm:"type:uuid;not null" json:"form_id"`
	WorkspaceIntegrationID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_integration_id"`
	IsEnabled              bool           `gorm:"default:true" json:"is_enabled"`
	Settings               datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"settings"`
	ExternalFolderID       string         `gorm:"type:text" json:"external_folder_id,omitempty"`
	ExternalFolderURL      string         `gorm:"type:text" json:"external_folder_url,omitempty"`
	CreatedAt              time.Time      `gorm:"default:now()" json:"created_at"`
	UpdatedAt              time.Time      `gorm:"default:now()" json:"updated_at"`

	// Associations
	Form                 Table                `gorm:"foreignKey:FormID" json:"-"`
	WorkspaceIntegration WorkspaceIntegration `gorm:"foreignKey:WorkspaceIntegrationID" json:"-"`
	ApplicantFolders     []ApplicantFolder    `gorm:"foreignKey:FormIntegrationID" json:"applicant_folders,omitempty"`
}

func (FormIntegrationSetting) TableName() string {
	return "form_integration_settings"
}

// FormDriveSettings represents Google Drive settings for a specific form
type FormDriveSettings struct {
	ApplicantFolderTemplate string   `json:"applicant_folder_template,omitempty"` // e.g., "{{name}} - {{email}}"
	SyncOnSubmit            bool     `json:"sync_on_submit"`
	IncludeAllFields        bool     `json:"include_all_fields"` // Sync all form data as a file
	FileNameTemplate        string   `json:"file_name_template,omitempty"`
	UploadFields            []string `json:"upload_fields,omitempty"`
}

// ApplicantFolder represents a folder created for an applicant in external storage
type ApplicantFolder struct {
	ID                  uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	FormIntegrationID   uuid.UUID  `gorm:"type:uuid;not null" json:"form_integration_id"`
	RowID               uuid.UUID  `gorm:"type:uuid;not null" json:"row_id"`
	ApplicantIdentifier string     `gorm:"type:text;not null" json:"applicant_identifier"`
	ExternalFolderID    string     `gorm:"type:text;not null" json:"external_folder_id"`
	ExternalFolderURL   string     `gorm:"type:text" json:"external_folder_url,omitempty"`
	LastSyncAt          *time.Time `json:"last_sync_at,omitempty"`
	SyncStatus          string     `gorm:"type:text;default:'pending'" json:"sync_status"`
	SyncError           string     `gorm:"type:text" json:"sync_error,omitempty"`
	CreatedAt           time.Time  `gorm:"default:now()" json:"created_at"`
	UpdatedAt           time.Time  `gorm:"default:now()" json:"updated_at"`

	// Associations
	FormIntegration FormIntegrationSetting `gorm:"foreignKey:FormIntegrationID" json:"-"`
	Row             Row                    `gorm:"foreignKey:RowID" json:"-"`
	FileSyncLogs    []FileSyncLog          `gorm:"foreignKey:ApplicantFolderID" json:"file_sync_logs,omitempty"`
}

func (ApplicantFolder) TableName() string {
	return "applicant_folders"
}

// FileSyncLog represents a record of a file sync to external storage
type FileSyncLog struct {
	ID                uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ApplicantFolderID uuid.UUID  `gorm:"type:uuid;not null" json:"applicant_folder_id"`
	TableFileID       *uuid.UUID `gorm:"type:uuid" json:"table_file_id,omitempty"`
	ExternalFileID    string     `gorm:"type:text" json:"external_file_id,omitempty"`
	ExternalFileURL   string     `gorm:"type:text" json:"external_file_url,omitempty"`
	OriginalFilename  string     `gorm:"type:text;not null" json:"original_filename"`
	FileSizeBytes     int64      `json:"file_size_bytes,omitempty"`
	MimeType          string     `gorm:"type:text" json:"mime_type,omitempty"`
	SyncStatus        string     `gorm:"type:text;default:'pending'" json:"sync_status"`
	SyncError         string     `gorm:"type:text" json:"sync_error,omitempty"`
	SyncedAt          *time.Time `json:"synced_at,omitempty"`
	CreatedAt         time.Time  `gorm:"default:now()" json:"created_at"`

	// Associations
	ApplicantFolder ApplicantFolder `gorm:"foreignKey:ApplicantFolderID" json:"-"`
	TableFile       *TableFile      `gorm:"foreignKey:TableFileID" json:"-"`
}

func (FileSyncLog) TableName() string {
	return "file_sync_log"
}
