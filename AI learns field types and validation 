-- AI learns field types and validation from existing data
CREATE TABLE ai_field_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
  field_id UUID REFERENCES table_fields(id) ON DELETE CASCADE,
  
  -- Suggestion type
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN (
    'semantic_type',      -- Suggest semantic type based on data
    'validation_rule',    -- Suggest validation based on patterns
    'field_type_change',  -- Suggest different field type
    'merge_fields',       -- Suggest merging similar fields
    'split_field',        -- Suggest splitting compound field
    'normalize_values'    -- Suggest normalizing inconsistent values
  )),
  
  -- Current state
  current_value JSONB,  -- Current semantic_type, validation, etc.
  
  -- Suggestion
  suggested_value JSONB NOT NULL,
  confidence FLOAT NOT NULL,  -- 0-1
  reasoning TEXT,             -- "95% of values match email pattern"
  
  -- Evidence
  sample_data JSONB,  -- Examples that led to suggestion
  pattern_matches INT, -- How many values matched
  total_values INT,    -- Total non-null values
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_suggestions_table ON ai_field_suggestions(table_id, status);
CREATE INDEX idx_ai_suggestions_field ON ai_field_suggestions(field_id, status);