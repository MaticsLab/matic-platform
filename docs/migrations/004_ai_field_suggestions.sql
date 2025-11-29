-- AI learns field types and validation from existing data
CREATE TABLE ai_field_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
  row_id UUID REFERENCES table_rows(id) ON DELETE CASCADE,  -- NULL for table-level suggestions
  field_id UUID REFERENCES table_fields(id) ON DELETE CASCADE,
  
  -- Suggestion type
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN (
    'semantic_type',      -- Suggest semantic type based on data
    'validation_rule',    -- Suggest validation based on patterns
    'field_type_change',  -- Suggest different field type
    'merge_fields',       -- Suggest merging similar fields
    'split_field',        -- Suggest splitting compound field
    'normalize_values',   -- Suggest normalizing inconsistent values
    'typo_correction',    -- Suggest fixing typos
    'format_correction',  -- Suggest fixing format issues
    'missing_value',      -- Suggest filling missing values
    'duplicate_value'     -- Flag potential duplicates
  )),
  
  -- Current state
  current_value JSONB,  -- Current semantic_type, validation, etc.
  
  -- Suggestion
  suggested_value JSONB NOT NULL,
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reasoning TEXT,             -- "95% of values match email pattern"
  
  -- Evidence
  sample_data JSONB,          -- Examples that led to suggestion
  pattern_matches INT,        -- How many values matched
  total_values INT,           -- Total non-null values
  
  -- Related suggestions
  related_suggestion_ids UUID[],
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Awaiting review
    'accepted',     -- Applied by user
    'rejected',     -- User rejected
    'dismissed',    -- User dismissed without action
    'auto_applied', -- Applied automatically (high confidence)
    'expired'       -- No longer valid
  )),
  
  -- Review tracking
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- If applied, which version it created
  applied_version_id UUID REFERENCES row_versions(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ  -- Suggestions may expire if data changes
);

-- Indexes
CREATE INDEX idx_ai_suggestions_workspace ON ai_field_suggestions(workspace_id, status);
CREATE INDEX idx_ai_suggestions_table ON ai_field_suggestions(table_id, status);
CREATE INDEX idx_ai_suggestions_field ON ai_field_suggestions(field_id, status);
CREATE INDEX idx_ai_suggestions_row ON ai_field_suggestions(row_id, status) WHERE row_id IS NOT NULL;
CREATE INDEX idx_ai_suggestions_pending ON ai_field_suggestions(table_id, confidence DESC) WHERE status = 'pending';
