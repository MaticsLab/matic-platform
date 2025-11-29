-- Granular field-level change tracking
CREATE TABLE field_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  row_version_id UUID NOT NULL REFERENCES row_versions(id) ON DELETE CASCADE,
  row_id UUID NOT NULL REFERENCES table_rows(id) ON DELETE CASCADE,
  field_id UUID REFERENCES table_fields(id) ON DELETE SET NULL,  -- NULL if field was deleted
  
  -- Field identification (in case field is deleted later)
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  field_label TEXT,
  
  -- Change data
  old_value JSONB,  -- NULL for new fields
  new_value JSONB,  -- NULL for deleted values
  
  -- Change classification
  change_action TEXT NOT NULL CHECK (change_action IN ('add', 'update', 'remove', 'reorder')),
  
  -- For container types (group/repeater), track nested changes
  nested_path TEXT[],  -- e.g., ['activities', '0', 'role'] for repeater item
  
  -- AI analysis
  similarity_score FLOAT,        -- How different is new from old (0-1)?
  semantic_change_type TEXT,     -- 'correction', 'addition', 'major_revision'
  
  -- PII tracking
  contains_pii BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient field history queries
CREATE INDEX idx_field_changes_row_id ON field_changes(row_id, created_at DESC);
CREATE INDEX idx_field_changes_version_id ON field_changes(row_version_id);
CREATE INDEX idx_field_changes_field_id ON field_changes(field_id, created_at DESC);
CREATE INDEX idx_field_changes_field_name ON field_changes(field_name, created_at DESC);
