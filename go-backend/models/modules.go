package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// HubType enum values
const (
	HubTypeActivities   = "activities"
	HubTypeApplications = "applications"
	HubTypeData         = "data"
)

// ModuleCategory enum values
const (
	ModuleCategoryCore          = "core"
	ModuleCategoryProductivity  = "productivity"
	ModuleCategoryCommunication = "communication"
	ModuleCategoryIntegration   = "integration"
)

// StringArray is a custom type for PostgreSQL text[] arrays
type StringArray []string

// Value implements the driver.Valuer interface for StringArray
func (s StringArray) Value() (driver.Value, error) {
	if s == nil {
		return nil, nil
	}
	return json.Marshal(s)
}

// Scan implements the sql.Scanner interface for StringArray
func (s *StringArray) Scan(value interface{}) error {
	if value == nil {
		*s = nil
		return nil
	}
	
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("failed to scan StringArray: invalid type")
	}
	
	// Try parsing as JSON array first (from GORM)
	if err := json.Unmarshal(bytes, s); err == nil {
		return nil
	}
	
	// Try parsing as PostgreSQL array format: {value1,value2}
	str := string(bytes)
	if len(str) >= 2 && str[0] == '{' && str[len(str)-1] == '}' {
		str = str[1 : len(str)-1]
		if str == "" {
			*s = []string{}
			return nil
		}
		// Simple split - doesn't handle escaped commas, but works for basic cases
		result := []string{}
		for _, item := range splitPgArray(str) {
			result = append(result, item)
		}
		*s = result
		return nil
	}
	
	return errors.New("failed to scan StringArray: unknown format")
}

// splitPgArray splits a PostgreSQL array string (without outer braces)
func splitPgArray(s string) []string {
	if s == "" {
		return []string{}
	}
	result := []string{}
	current := ""
	inQuotes := false
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c == '"' && (i == 0 || s[i-1] != '\\') {
			inQuotes = !inQuotes
		} else if c == ',' && !inQuotes {
			result = append(result, current)
			current = ""
		} else {
			current += string(c)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

// ModuleDefinition - Central registry of all available modules
// This is a reference table, typically seeded via migration
type ModuleDefinition struct {
	ID                   string         `gorm:"primaryKey" json:"id"` // e.g., 'pulse', 'review_workflow'
	Name                 string         `gorm:"not null" json:"name"`
	Description          string         `json:"description"`
	Icon                 string         `json:"icon"`
	Category             string         `gorm:"default:'core'" json:"category"`
	IsPremium            bool           `gorm:"default:false" json:"is_premium"`
	IsBeta               bool           `gorm:"default:false" json:"is_beta"`
	IsDeprecated         bool           `gorm:"default:false" json:"is_deprecated"`
	AvailableForHubTypes StringArray    `gorm:"type:text[]" json:"available_for_hub_types"`
	Dependencies         StringArray    `gorm:"type:text[]" json:"dependencies"`
	SettingsSchema       datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"settings_schema"`
	DisplayOrder         int            `gorm:"default:0" json:"display_order"`
	CreatedAt            time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt            time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName specifies the table name for ModuleDefinition
func (ModuleDefinition) TableName() string {
	return "module_definitions"
}

// HubModuleConfig - Per-table (hub) module enablement and configuration
type HubModuleConfig struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	TableID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"table_id"`
	ModuleID  string         `gorm:"not null;index" json:"module_id"`
	IsEnabled bool           `gorm:"default:true" json:"is_enabled"`
	Settings  datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"settings"`
	EnabledBy *uuid.UUID     `gorm:"type:uuid" json:"enabled_by,omitempty"`
	EnabledAt time.Time      `gorm:"autoCreateTime" json:"enabled_at"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updated_at"`

	// Relationships
	Table  *Table            `gorm:"foreignKey:TableID" json:"table,omitempty"`
	Module *ModuleDefinition `gorm:"foreignKey:ModuleID" json:"module,omitempty"`
}

// TableName specifies the table name for HubModuleConfig
func (HubModuleConfig) TableName() string {
	return "hub_module_configs"
}

// BeforeCreate hook to generate UUID
func (h *HubModuleConfig) BeforeCreate(tx *gorm.DB) error {
	if h.ID == uuid.Nil {
		h.ID = uuid.New()
	}
	return nil
}

// TableWithModules extends Table with hub type and module configs
type TableWithModules struct {
	Table
	HubType       string            `gorm:"column:hub_type;default:'data'" json:"hub_type"`
	ModuleConfigs []HubModuleConfig `gorm:"foreignKey:TableID" json:"module_configs,omitempty"`
}

// TableName specifies the table name for TableWithModules
func (TableWithModules) TableName() string {
	return "data_tables"
}

// ============================================================
// DTO types for API responses
// ============================================================

// ModuleWithStatus combines module definition with its enabled status for a specific hub
type ModuleWithStatus struct {
	ModuleDefinition
	IsEnabled bool           `json:"is_enabled"`
	Settings  datatypes.JSON `json:"settings,omitempty"`
}

// HubModulesResponse is the API response for listing hub modules
type HubModulesResponse struct {
	TableID        uuid.UUID          `json:"table_id"`
	HubType        string             `json:"hub_type"`
	EnabledModules []ModuleWithStatus `json:"enabled_modules"`
	AvailableModules []ModuleWithStatus `json:"available_modules"`
}

// EnableModuleRequest is the request body for enabling a module on a hub
type EnableModuleRequest struct {
	ModuleID string         `json:"module_id" binding:"required"`
	Settings datatypes.JSON `json:"settings,omitempty"`
}

// UpdateHubTypeRequest is the request body for changing a table's hub type
type UpdateHubTypeRequest struct {
	HubType string `json:"hub_type" binding:"required,oneof=activities applications data"`
}

// ============================================================
// Helper methods
// ============================================================

// IsModuleAvailable checks if a module is available for this hub type
func (m *ModuleDefinition) IsModuleAvailable(hubType string) bool {
	for _, ht := range m.AvailableForHubTypes {
		if ht == hubType {
			return true
		}
	}
	return false
}

// HasDependency checks if a module has a specific dependency
func (m *ModuleDefinition) HasDependency(moduleID string) bool {
	for _, dep := range m.Dependencies {
		if dep == moduleID {
			return true
		}
	}
	return false
}

// GetEnabledModuleIDs returns a list of enabled module IDs for a hub
func GetEnabledModuleIDs(configs []HubModuleConfig) []string {
	var ids []string
	for _, config := range configs {
		if config.IsEnabled {
			ids = append(ids, config.ModuleID)
		}
	}
	return ids
}

// CanEnableModule checks if a module can be enabled (dependencies satisfied)
func CanEnableModule(module *ModuleDefinition, enabledModuleIDs []string) bool {
	// Check all dependencies are in the enabled list
	for _, dep := range module.Dependencies {
		found := false
		for _, enabled := range enabledModuleIDs {
			if enabled == dep {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}
