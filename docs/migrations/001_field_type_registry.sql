-- Master registry of all field types with AI metadata
CREATE TABLE field_type_registry (
  id TEXT PRIMARY KEY,  -- 'text', 'email', 'repeater', etc.
  category TEXT NOT NULL CHECK (category IN ('primitive', 'container', 'layout', 'special')),
  
  -- Display metadata
  label TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  
  -- Schema definitions (JSON Schema format)
  input_schema JSONB NOT NULL DEFAULT '{}',    -- What form inputs accept
  storage_schema JSONB NOT NULL DEFAULT '{}',  -- How data is stored in table_rows.data
  config_schema JSONB NOT NULL DEFAULT '{}',   -- What can be configured on field instances
  
  -- Behavior flags
  is_container BOOLEAN DEFAULT false,   -- Can contain child fields
  is_searchable BOOLEAN DEFAULT true,   -- Include in search index
  is_sortable BOOLEAN DEFAULT true,     -- Can sort by this field
  is_filterable BOOLEAN DEFAULT true,   -- Can filter by this field
  is_editable BOOLEAN DEFAULT true,     -- Can be edited after creation
  supports_pii BOOLEAN DEFAULT false,   -- Can contain PII data
  
  -- Rendering hints
  table_renderer TEXT,  -- Component for table cells
  form_renderer TEXT,   -- Component for form inputs
  review_renderer TEXT, -- Component for review mode (read-only)
  
  -- AI Integration
  ai_schema JSONB DEFAULT '{}',  -- AI-specific metadata
  -- Example:
  -- {
  --   "embedding_strategy": "value_only" | "with_label" | "skip",
  --   "semantic_hint": "This field contains email addresses",
  --   "extraction_patterns": ["email", "contact"],
  --   "privacy_level": "pii" | "sensitive" | "public",
  --   "summarization_weight": 1.5
  -- }
  
  default_semantic_type TEXT,
  
  -- Edit tracking settings
  track_changes BOOLEAN DEFAULT true,  -- Should edits be tracked?
  require_reason BOOLEAN DEFAULT false, -- Require edit reason?
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comprehensive field type definitions
INSERT INTO field_type_registry (id, category, label, is_container, storage_schema, ai_schema) VALUES
-- Primitive types with AI metadata
('text', 'primitive', 'Short Text', false, 
  '{"type": "string", "maxLength": 500}',
  '{"embedding_strategy": "value_only", "privacy_level": "public"}'
),
('textarea', 'primitive', 'Long Text', false,
  '{"type": "string"}',
  '{"embedding_strategy": "with_label", "summarization_weight": 1.5, "privacy_level": "public"}'
),
('email', 'primitive', 'Email', false,
  '{"type": "string", "format": "email"}',
  '{"embedding_strategy": "skip", "privacy_level": "pii", "semantic_hint": "Contact email address"}'
),
('phone', 'primitive', 'Phone', false,
  '{"type": "string", "pattern": "^[+]?[0-9\\-\\s()]+$"}',
  '{"embedding_strategy": "skip", "privacy_level": "pii"}'
),
('number', 'primitive', 'Number', false,
  '{"type": "number"}',
  '{"embedding_strategy": "with_label", "privacy_level": "public"}'
),
('date', 'primitive', 'Date', false,
  '{"type": "string", "format": "date"}',
  '{"embedding_strategy": "with_label", "privacy_level": "public"}'
),
('select', 'primitive', 'Dropdown', false,
  '{"type": "string"}',
  '{"embedding_strategy": "value_only", "privacy_level": "public"}'
),
('multiselect', 'primitive', 'Multi-Select', false,
  '{"type": "array", "items": {"type": "string"}}',
  '{"embedding_strategy": "value_only", "privacy_level": "public"}'
),

-- Container types with child structure definitions
('group', 'container', 'Field Group', true,
  '{
    "type": "object",
    "additionalProperties": true,
    "$comment": "Children defined in field config, stored as flat object"
  }',
  '{"embedding_strategy": "children_only", "privacy_level": "inherit"}'
),
('repeater', 'container', 'Repeater', true,
  '{
    "type": "array",
    "items": {
      "type": "object",
      "additionalProperties": true
    },
    "$comment": "Each item is an object with child field values"
  }',
  '{"embedding_strategy": "summarize_count", "summarization_template": "{count} items", "privacy_level": "inherit"}'
),

-- Layout types (no data storage)
('divider', 'layout', 'Divider', false, '{"type": "null"}', '{"embedding_strategy": "skip"}'),
('heading', 'layout', 'Heading', false, '{"type": "null"}', '{"embedding_strategy": "skip"}'),
('section', 'layout', 'Section', true, '{"type": "null"}', '{"embedding_strategy": "skip"}'),

-- Special types
('file', 'special', 'File Upload', false,
  '{
    "type": "object",
    "properties": {
      "url": {"type": "string"},
      "name": {"type": "string"},
      "size": {"type": "number"},
      "mime_type": {"type": "string"}
    }
  }',
  '{"embedding_strategy": "filename_only", "privacy_level": "sensitive"}'
),
('signature', 'special', 'Signature', false,
  '{"type": "string", "contentEncoding": "base64"}',
  '{"embedding_strategy": "skip", "privacy_level": "pii"}'
),
('rating', 'special', 'Rating', false,
  '{"type": "number", "minimum": 0, "maximum": 5}',
  '{"embedding_strategy": "with_label", "privacy_level": "public"}'
);

-- Indexes
CREATE INDEX idx_field_type_registry_category ON field_type_registry(category);
