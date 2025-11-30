package services

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/Jsanchez767/matic-platform/database"
	"github.com/Jsanchez767/matic-platform/models"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// FieldService handles field operations with registry integration
type FieldService struct {
	registry map[string]models.FieldTypeRegistry
	mu       sync.RWMutex
}

var (
	fieldServiceInstance *FieldService
	fieldServiceOnce     sync.Once
)

// GetFieldService returns the singleton FieldService instance
func GetFieldService() *FieldService {
	fieldServiceOnce.Do(func() {
		fieldServiceInstance = &FieldService{
			registry: make(map[string]models.FieldTypeRegistry),
		}
		fieldServiceInstance.LoadRegistry()
	})
	return fieldServiceInstance
}

// LoadRegistry loads the field type registry from database
func (s *FieldService) LoadRegistry() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var types []models.FieldTypeRegistry
	if err := database.DB.Find(&types).Error; err != nil {
		return fmt.Errorf("failed to load field registry: %w", err)
	}

	s.registry = make(map[string]models.FieldTypeRegistry)
	for _, t := range types {
		s.registry[t.ID] = t
	}

	return nil
}

// GetFieldType returns a field type from the registry
func (s *FieldService) GetFieldType(typeID string) (*models.FieldTypeRegistry, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ft, ok := s.registry[typeID]
	if !ok {
		return nil, false
	}
	return &ft, true
}

// GetAllFieldTypes returns all field types from the registry
func (s *FieldService) GetAllFieldTypes() []models.FieldTypeRegistry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	types := make([]models.FieldTypeRegistry, 0, len(s.registry))
	for _, t := range s.registry {
		types = append(types, t)
	}
	return types
}

// EffectiveConfig represents the merged configuration for a field
type EffectiveConfig struct {
	// From registry
	StorageSchema map[string]interface{} `json:"storage_schema"`
	InputSchema   map[string]interface{} `json:"input_schema"`
	ConfigSchema  map[string]interface{} `json:"config_schema"`
	AISchema      map[string]interface{} `json:"ai_schema"`

	// Behavior flags from registry
	IsContainer  bool `json:"is_container"`
	IsSearchable bool `json:"is_searchable"`
	IsSortable   bool `json:"is_sortable"`
	IsFilterable bool `json:"is_filterable"`
	IsEditable   bool `json:"is_editable"`
	SupportsPII  bool `json:"supports_pii"`

	// Merged config (registry defaults + instance overrides)
	Config map[string]interface{} `json:"config"`
}

// GetEffectiveConfig merges registry default_config with field instance config
func (s *FieldService) GetEffectiveConfig(field models.Field) (*EffectiveConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Determine field type ID
	fieldTypeID := field.Type
	if field.FieldTypeID != "" {
		fieldTypeID = field.FieldTypeID
	}

	regType, ok := s.registry[fieldTypeID]
	if !ok {
		// Return basic config if type not found
		var instanceConfig map[string]interface{}
		if field.Config != nil {
			json.Unmarshal(field.Config, &instanceConfig)
		}
		return &EffectiveConfig{
			Config: instanceConfig,
		}, nil
	}

	// Parse registry schemas
	var storageSchema, inputSchema, configSchema, aiSchema map[string]interface{}
	json.Unmarshal(regType.StorageSchema, &storageSchema)
	json.Unmarshal(regType.InputSchema, &inputSchema)
	json.Unmarshal(regType.ConfigSchema, &configSchema)
	json.Unmarshal(regType.AISchema, &aiSchema)

	// Parse default config from registry
	var defaultConfig map[string]interface{}
	if regType.DefaultConfig != nil {
		json.Unmarshal(regType.DefaultConfig, &defaultConfig)
	}
	if defaultConfig == nil {
		defaultConfig = make(map[string]interface{})
	}

	// Parse instance config
	var instanceConfig map[string]interface{}
	if field.Config != nil {
		json.Unmarshal(field.Config, &instanceConfig)
	}
	if instanceConfig == nil {
		instanceConfig = make(map[string]interface{})
	}

	// Merge: start with defaults, overlay instance config
	mergedConfig := make(map[string]interface{})
	for k, v := range defaultConfig {
		mergedConfig[k] = v
	}
	for k, v := range instanceConfig {
		mergedConfig[k] = v
	}

	return &EffectiveConfig{
		StorageSchema: storageSchema,
		InputSchema:   inputSchema,
		ConfigSchema:  configSchema,
		AISchema:      aiSchema,
		IsContainer:   regType.IsContainer,
		IsSearchable:  regType.IsSearchable,
		IsSortable:    regType.IsSortable,
		IsFilterable:  regType.IsFilterable,
		IsEditable:    regType.IsEditable,
		SupportsPII:   regType.SupportsPII,
		Config:        mergedConfig,
	}, nil
}

// CreateFieldInput represents input for creating a field
type CreateFieldInput struct {
	TableID       uuid.UUID              `json:"table_id"`
	FieldTypeID   string                 `json:"field_type_id"`
	Name          string                 `json:"name"`
	Label         string                 `json:"label"`
	Description   string                 `json:"description,omitempty"`
	Config        map[string]interface{} `json:"config,omitempty"`
	Position      int                    `json:"position"`
	Width         int                    `json:"width,omitempty"`
	IsVisible     bool                   `json:"is_visible"`
	IsPrimary     bool                   `json:"is_primary"`
	ParentFieldID *uuid.UUID             `json:"parent_field_id,omitempty"`
	LinkedTableID *uuid.UUID             `json:"linked_table_id,omitempty"`
}

// CreateField creates a field with proper defaults from registry
func (s *FieldService) CreateField(input CreateFieldInput) (*models.Field, error) {
	// Validate field type exists
	regType, ok := s.GetFieldType(input.FieldTypeID)
	if !ok {
		return nil, fmt.Errorf("unknown field type: %s", input.FieldTypeID)
	}

	// Set defaults
	if input.Width == 0 {
		input.Width = 150
	}
	if input.Label == "" {
		input.Label = input.Name
	}

	// Convert config to JSON
	var configJSON datatypes.JSON
	if input.Config != nil {
		configBytes, _ := json.Marshal(input.Config)
		configJSON = datatypes.JSON(configBytes)
	} else {
		configJSON = datatypes.JSON("{}")
	}

	field := &models.Field{
		TableID:       input.TableID,
		FieldTypeID:   input.FieldTypeID,
		Type:          input.FieldTypeID, // Keep in sync for backwards compatibility
		Name:          input.Name,
		Label:         input.Label,
		Description:   input.Description,
		Config:        configJSON,
		Position:      input.Position,
		Width:         input.Width,
		IsVisible:     input.IsVisible,
		IsPrimary:     input.IsPrimary,
		ParentFieldID: input.ParentFieldID,
		LinkedTableID: input.LinkedTableID,
		IsSearchable:  regType.IsSearchable, // Inherit from registry
	}

	if err := database.DB.Create(field).Error; err != nil {
		return nil, fmt.Errorf("failed to create field: %w", err)
	}

	return field, nil
}

// UpdateFieldInput represents input for updating a field
type UpdateFieldInput struct {
	Name          *string                 `json:"name,omitempty"`
	Label         *string                 `json:"label,omitempty"`
	Description   *string                 `json:"description,omitempty"`
	Config        *map[string]interface{} `json:"config,omitempty"`
	Position      *int                    `json:"position,omitempty"`
	Width         *int                    `json:"width,omitempty"`
	IsVisible     *bool                   `json:"is_visible,omitempty"`
	IsPrimary     *bool                   `json:"is_primary,omitempty"`
	IsSearchable  *bool                   `json:"is_searchable,omitempty"`
	LinkedTableID *uuid.UUID              `json:"linked_table_id,omitempty"`
}

// UpdateField updates a field
func (s *FieldService) UpdateField(fieldID uuid.UUID, input UpdateFieldInput) (*models.Field, error) {
	var field models.Field
	if err := database.DB.First(&field, "id = ?", fieldID).Error; err != nil {
		return nil, fmt.Errorf("field not found: %w", err)
	}

	if input.Name != nil {
		field.Name = *input.Name
	}
	if input.Label != nil {
		field.Label = *input.Label
	}
	if input.Description != nil {
		field.Description = *input.Description
	}
	if input.Config != nil {
		configBytes, _ := json.Marshal(*input.Config)
		field.Config = datatypes.JSON(configBytes)
	}
	if input.Position != nil {
		field.Position = *input.Position
	}
	if input.Width != nil {
		field.Width = *input.Width
	}
	if input.IsVisible != nil {
		field.IsVisible = *input.IsVisible
	}
	if input.IsPrimary != nil {
		field.IsPrimary = *input.IsPrimary
	}
	if input.IsSearchable != nil {
		field.IsSearchable = *input.IsSearchable
	}
	if input.LinkedTableID != nil {
		field.LinkedTableID = input.LinkedTableID
	}

	if err := database.DB.Save(&field).Error; err != nil {
		return nil, fmt.Errorf("failed to update field: %w", err)
	}

	return &field, nil
}

// GetFieldWithEffectiveConfig returns a field with its effective config
func (s *FieldService) GetFieldWithEffectiveConfig(fieldID uuid.UUID) (*models.Field, *EffectiveConfig, error) {
	var field models.Field
	if err := database.DB.Preload("FieldType").First(&field, "id = ?", fieldID).Error; err != nil {
		return nil, nil, fmt.Errorf("field not found: %w", err)
	}

	effectiveConfig, err := s.GetEffectiveConfig(field)
	if err != nil {
		return nil, nil, err
	}

	return &field, effectiveConfig, nil
}

// GetTableFieldsWithEffectiveConfig returns all fields for a table with effective configs
func (s *FieldService) GetTableFieldsWithEffectiveConfig(tableID uuid.UUID) ([]struct {
	Field           models.Field
	EffectiveConfig *EffectiveConfig
}, error) {
	var fields []models.Field
	if err := database.DB.Preload("FieldType").Where("table_id = ?", tableID).Order("position ASC").Find(&fields).Error; err != nil {
		return nil, fmt.Errorf("failed to load fields: %w", err)
	}

	results := make([]struct {
		Field           models.Field
		EffectiveConfig *EffectiveConfig
	}, len(fields))

	for i, field := range fields {
		effectiveConfig, _ := s.GetEffectiveConfig(field)
		results[i] = struct {
			Field           models.Field
			EffectiveConfig *EffectiveConfig
		}{
			Field:           field,
			EffectiveConfig: effectiveConfig,
		}
	}

	return results, nil
}

// BulkCreateFields creates multiple fields at once
func (s *FieldService) BulkCreateFields(inputs []CreateFieldInput) ([]models.Field, error) {
	fields := make([]models.Field, 0, len(inputs))

	for _, input := range inputs {
		field, err := s.CreateField(input)
		if err != nil {
			return fields, fmt.Errorf("failed to create field %s: %w", input.Name, err)
		}
		fields = append(fields, *field)
	}

	return fields, nil
}
