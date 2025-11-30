# Field Architecture Improvement Plan

## Current Issues

### 1. Loose Coupling Between `table_fields` and `field_type_registry`
- `table_fields.type` is a string, not a proper FK
- `field_type_id` is optional and rarely populated
- Registry settings are not automatically inherited

### 2. Scattered Configuration
- `settings`, `validation`, `config` columns with overlapping purposes
- No clear separation between type-level defaults and instance overrides

### 3. No Schema Validation
- `config_schema` in registry is defined but never enforced
- Frontend doesn't validate field configs against the registry

---

## Proposed Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      IMPROVED ARCHITECTURE                                  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐                                               │
│  │ field_type_registry     │ ◄── Master definition of each field type     │
│  ├─────────────────────────┤                                               │
│  │ id TEXT PRIMARY KEY     │ (text, email, select, repeater, etc.)        │
│  │ category                │ (primitive, container, layout, special)       │
│  │ label, description      │                                               │
│  │ icon, color             │                                               │
│  │                         │                                               │
│  │ ── SCHEMAS ──           │                                               │
│  │ storage_schema JSONB    │ How values are stored in table_rows.data     │
│  │ input_schema JSONB      │ JSON Schema for form input validation        │
│  │ config_schema JSONB     │ JSON Schema for field instance config        │
│  │ default_config JSONB    │ ◄── NEW: Default settings for new fields    │
│  │                         │                                               │
│  │ ── BEHAVIORS ──         │                                               │
│  │ is_container            │ Can contain child fields (repeater, group)   │
│  │ is_searchable           │ Include in search index                      │
│  │ is_sortable             │ Can sort by this field                       │
│  │ is_filterable           │ Can filter by this field                     │
│  │ is_editable             │ Can be edited after creation                 │
│  │ supports_pii            │ May contain sensitive data                   │
│  │                         │                                               │
│  │ ── RENDERERS ──         │                                               │
│  │ table_renderer          │ Component name for table cells               │
│  │ form_renderer           │ Component name for form inputs               │
│  │ review_renderer         │ Component name for review mode               │
│  │                         │                                               │
│  │ ── AI ──                │                                               │
│  │ ai_schema JSONB         │ Embedding strategy, privacy, hints           │
│  └────────────┬────────────┘                                               │
│               │                                                             │
│               │ PROPER FOREIGN KEY                                          │
│               ▼                                                             │
│  ┌─────────────────────────┐                                               │
│  │ table_fields            │ ◄── Instance of a field type in a table      │
│  ├─────────────────────────┤                                               │
│  │ id UUID PRIMARY KEY     │                                               │
│  │ table_id UUID FK        │ Which table owns this field                  │
│  │ field_type_id TEXT FK   │ ◄── REQUIRED, references field_type_registry │
│  │                         │                                               │
│  │ ── IDENTITY ──          │                                               │
│  │ name TEXT NOT NULL      │ Internal key (snake_case, unique per table)  │
│  │ label TEXT NOT NULL     │ Display name                                 │
│  │ description TEXT        │ Help text                                     │
│  │                         │                                               │
│  │ ── INSTANCE CONFIG ──   │                                               │
│  │ config JSONB            │ ◄── MERGED with default_config from registry │
│  │                         │     Contains: options, placeholder, width,   │
│  │                         │     validation overrides, children (for      │
│  │                         │     containers), etc.                        │
│  │                         │                                               │
│  │ ── POSITIONING ──       │                                               │
│  │ position INT            │ Display order in table/form                  │
│  │ width INT               │ Column width in pixels                       │
│  │ is_visible BOOL         │ Show in table view                           │
│  │ is_primary BOOL         │ Primary display field                        │
│  │                         │                                               │
│  │ ── RELATIONS ──         │                                               │
│  │ parent_field_id UUID    │ ◄── NEW: For nested fields (group children) │
│  │ linked_table_id UUID    │ For link/lookup fields                       │
│  │ linked_field_id UUID    │ Display field for links                      │
│  │                         │                                               │
│  │ ── SEARCH/AI ──         │                                               │
│  │ semantic_type TEXT      │ Detected type (name, email, status, etc.)    │
│  │ is_searchable BOOL      │ Override from registry                       │
│  │ search_weight FLOAT     │ Override from registry                       │
│  └────────────┬────────────┘                                               │
│               │                                                             │
│               ▼                                                             │
│  ┌─────────────────────────┐                                               │
│  │ table_rows              │                                               │
│  ├─────────────────────────┤                                               │
│  │ id UUID PRIMARY KEY     │                                               │
│  │ table_id UUID FK        │                                               │
│  │ data JSONB              │ ◄── Values keyed by field.name               │
│  │                         │     Validated against storage_schema          │
│  └─────────────────────────┘                                               │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Migration Steps

### Phase 1: Database Schema Updates

```sql
-- 1. Add default_config to field_type_registry
ALTER TABLE field_type_registry 
ADD COLUMN IF NOT EXISTS default_config JSONB DEFAULT '{}';

-- 2. Make field_type_id required and add FK constraint
-- First, populate missing field_type_id values
UPDATE table_fields 
SET field_type_id = type 
WHERE field_type_id IS NULL OR field_type_id = '';

-- 3. Add FK constraint (after data is populated)
ALTER TABLE table_fields 
ADD CONSTRAINT fk_field_type 
FOREIGN KEY (field_type_id) 
REFERENCES field_type_registry(id) 
ON UPDATE CASCADE 
ON DELETE RESTRICT;

-- 4. Add parent_field_id for nested fields
ALTER TABLE table_fields 
ADD COLUMN IF NOT EXISTS parent_field_id UUID REFERENCES table_fields(id) ON DELETE CASCADE;

-- 5. Create index for nested field queries
CREATE INDEX IF NOT EXISTS idx_table_fields_parent ON table_fields(parent_field_id);

-- 6. Remove the redundant 'type' column (after migration)
-- ALTER TABLE table_fields DROP COLUMN type;
```

### Phase 2: Update Default Configs in Registry

```sql
-- Add default configurations for each field type
UPDATE field_type_registry SET default_config = '{
  "placeholder": "",
  "maxLength": 500,
  "minLength": 0
}' WHERE id = 'text';

UPDATE field_type_registry SET default_config = '{
  "placeholder": "",
  "rows": 3
}' WHERE id = 'textarea';

UPDATE field_type_registry SET default_config = '{
  "placeholder": "email@example.com"
}' WHERE id = 'email';

UPDATE field_type_registry SET default_config = '{
  "options": [],
  "allowCustom": false,
  "placeholder": "Select..."
}' WHERE id = 'select';

UPDATE field_type_registry SET default_config = '{
  "options": [],
  "maxSelections": null
}' WHERE id = 'multiselect';

UPDATE field_type_registry SET default_config = '{
  "minItems": 0,
  "maxItems": null,
  "children": []
}' WHERE id = 'repeater';

-- ... etc for all field types
```

---

## Go Backend Changes

### 1. Update Field Model

```go
// models/models.go

type Field struct {
    BaseModel
    TableID       uuid.UUID      `gorm:"type:uuid;not null;index" json:"table_id"`
    FieldTypeID   string         `gorm:"not null" json:"field_type_id"`  // Required FK
    Name          string         `gorm:"not null" json:"name"`
    Label         string         `gorm:"not null" json:"label"`
    Description   string         `json:"description,omitempty"`
    Config        datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"config"`
    Position      int            `gorm:"default:0" json:"position"`
    Width         int            `gorm:"default:150" json:"width"`
    IsVisible     bool           `gorm:"default:true" json:"is_visible"`
    IsPrimary     bool           `gorm:"default:false" json:"is_primary"`
    ParentFieldID *uuid.UUID     `gorm:"type:uuid" json:"parent_field_id,omitempty"`
    LinkedTableID *uuid.UUID     `gorm:"type:uuid" json:"linked_table_id,omitempty"`
    SemanticType  string         `json:"semantic_type,omitempty"`
    IsSearchable  *bool          `json:"is_searchable,omitempty"`  // Override registry
    SearchWeight  *float64       `json:"search_weight,omitempty"`  // Override registry
    
    // Computed/joined fields (not stored)
    FieldType     *FieldTypeRegistry `gorm:"foreignKey:FieldTypeID;references:ID" json:"field_type,omitempty"`
    Children      []Field            `gorm:"foreignKey:ParentFieldID" json:"children,omitempty"`
}
```

### 2. Add Field Helper Service

```go
// services/field_service.go

type FieldService struct {
    registry map[string]models.FieldTypeRegistry
}

// GetEffectiveConfig merges registry default_config with field instance config
func (s *FieldService) GetEffectiveConfig(field models.Field) map[string]interface{} {
    result := make(map[string]interface{})
    
    // Start with registry defaults
    if regType, ok := s.registry[field.FieldTypeID]; ok {
        var defaults map[string]interface{}
        json.Unmarshal(regType.DefaultConfig, &defaults)
        for k, v := range defaults {
            result[k] = v
        }
    }
    
    // Override with instance config
    var instanceConfig map[string]interface{}
    json.Unmarshal(field.Config, &instanceConfig)
    for k, v := range instanceConfig {
        result[k] = v
    }
    
    return result
}

// ValidateConfig validates field config against registry config_schema
func (s *FieldService) ValidateConfig(fieldTypeID string, config map[string]interface{}) error {
    if regType, ok := s.registry[fieldTypeID]; ok {
        // Use JSON Schema validator
        return validateJSONSchema(regType.ConfigSchema, config)
    }
    return fmt.Errorf("unknown field type: %s", fieldTypeID)
}

// CreateField creates a field with proper defaults from registry
func (s *FieldService) CreateField(input CreateFieldInput) (*models.Field, error) {
    regType, ok := s.registry[input.FieldTypeID]
    if !ok {
        return nil, fmt.Errorf("unknown field type: %s", input.FieldTypeID)
    }
    
    // Validate config against schema
    if err := s.ValidateConfig(input.FieldTypeID, input.Config); err != nil {
        return nil, fmt.Errorf("invalid config: %w", err)
    }
    
    field := &models.Field{
        TableID:      input.TableID,
        FieldTypeID:  input.FieldTypeID,
        Name:         input.Name,
        Label:        input.Label,
        Description:  input.Description,
        Config:       mapToJSON(input.Config),
        Position:     input.Position,
        IsSearchable: &regType.IsSearchable,  // Inherit from registry
    }
    
    return field, database.DB.Create(field).Error
}
```

---

## Frontend Changes

### 1. Update Field Types

```typescript
// src/types/field-registry.ts

export interface TableField {
  id: string
  table_id: string
  field_type_id: FieldTypeId  // Required, references registry
  name: string
  label: string
  description?: string
  config: FieldConfig  // Instance-specific config
  position: number
  width: number
  is_visible: boolean
  is_primary: boolean
  parent_field_id?: string  // For nested fields
  linked_table_id?: string
  semantic_type?: string
  is_searchable?: boolean
  search_weight?: number
  
  // Joined from registry
  field_type?: FieldTypeRegistry
  children?: TableField[]
}

// Effective config = registry.default_config + field.config
export interface EffectiveFieldConfig {
  // From registry
  storage_schema: Record<string, any>
  input_schema: Record<string, any>
  is_container: boolean
  is_searchable: boolean
  is_sortable: boolean
  is_filterable: boolean
  ai_schema: AISchema
  
  // Merged config
  placeholder?: string
  options?: string[]
  validation?: ValidationRules
  children?: TableField[]  // For containers
  // ... other type-specific settings
}
```

### 2. Add Field Registry Hook

```typescript
// src/hooks/useFieldRegistry.ts

import { useQuery } from '@tanstack/react-query'
import { fieldTypesClient } from '@/lib/api/field-types-client'

export function useFieldRegistry() {
  const { data: registry = [] } = useQuery({
    queryKey: ['field-registry'],
    queryFn: () => fieldTypesClient.list(),
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  })
  
  const registryMap = useMemo(() => {
    return Object.fromEntries(registry.map(r => [r.id, r]))
  }, [registry])
  
  // Get effective config for a field
  const getEffectiveConfig = useCallback((field: TableField): EffectiveFieldConfig => {
    const regType = registryMap[field.field_type_id]
    if (!regType) return field.config
    
    return {
      ...regType.default_config,
      ...field.config,
      // Always include registry behavior flags
      storage_schema: regType.storage_schema,
      input_schema: regType.input_schema,
      is_container: regType.is_container,
      is_searchable: field.is_searchable ?? regType.is_searchable,
      is_sortable: regType.is_sortable,
      is_filterable: regType.is_filterable,
      ai_schema: regType.ai_schema,
    }
  }, [registryMap])
  
  // Validate config against schema
  const validateConfig = useCallback((fieldTypeId: string, config: any): string[] => {
    const regType = registryMap[fieldTypeId]
    if (!regType?.config_schema) return []
    
    // Use ajv or similar for JSON Schema validation
    return validateJSONSchema(regType.config_schema, config)
  }, [registryMap])
  
  return {
    registry,
    registryMap,
    getEffectiveConfig,
    validateConfig,
    getFieldType: (id: string) => registryMap[id],
  }
}
```

---

## API Improvements

### 1. Field CRUD with Registry Integration

```
POST /api/v1/tables/:id/fields
{
  "field_type_id": "select",  // Required
  "name": "status",
  "label": "Status",
  "config": {
    "options": ["Active", "Inactive", "Pending"],
    "placeholder": "Choose status..."
  }
}

Response:
{
  "id": "...",
  "field_type_id": "select",
  "name": "status",
  "label": "Status",
  "config": {  // Instance config only
    "options": ["Active", "Inactive", "Pending"],
    "placeholder": "Choose status..."
  },
  "field_type": {  // Joined from registry
    "id": "select",
    "category": "primitive",
    "label": "Dropdown",
    "storage_schema": {"type": "string"},
    "default_config": {"allowCustom": false},
    "is_searchable": true,
    ...
  },
  "effective_config": {  // Computed merge
    "options": ["Active", "Inactive", "Pending"],
    "placeholder": "Choose status...",
    "allowCustom": false  // From registry default
  }
}
```

### 2. Bulk Field Operations

```
POST /api/v1/tables/:id/fields/bulk
{
  "fields": [
    {"field_type_id": "text", "name": "first_name", "label": "First Name"},
    {"field_type_id": "text", "name": "last_name", "label": "Last Name"},
    {"field_type_id": "email", "name": "email", "label": "Email"},
    {"field_type_id": "select", "name": "status", "label": "Status", "config": {"options": ["A", "B"]}}
  ]
}
```

---

## Benefits

1. **Single Source of Truth**: Registry defines field behavior, instances only store overrides
2. **Automatic Updates**: When registry changes, all fields inherit new defaults
3. **Config Validation**: `config_schema` is enforced on field creation/update
4. **Nested Fields**: `parent_field_id` properly models repeater/group children
5. **Cleaner API**: One `config` field instead of `settings` + `validation` + `config`
6. **Better DX**: Frontend can use `useFieldRegistry()` for consistent behavior
7. **Reduced Duplication**: No more `type` + `field_type_id` redundancy

---

## Migration Checklist

- [ ] Add `default_config` column to `field_type_registry`
- [ ] Populate `default_config` for all field types
- [ ] Add FK constraint from `table_fields.field_type_id` to `field_type_registry.id`
- [ ] Add `parent_field_id` column for nested fields
- [ ] Update Go `Field` model
- [ ] Create `FieldService` with config merging logic
- [ ] Update field CRUD handlers to use service
- [ ] Add config validation against `config_schema`
- [ ] Update frontend types
- [ ] Create `useFieldRegistry` hook
- [ ] Update form builders to use effective config
- [ ] Migrate existing data (consolidate settings/validation/config)
- [ ] Remove deprecated `type` column (after full migration)
