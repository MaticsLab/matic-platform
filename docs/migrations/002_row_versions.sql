-- Complete row snapshots for full history reconstruction
CREATE TABLE row_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  row_id UUID NOT NULL REFERENCES table_rows(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
  
  -- Version info
  version_number INT NOT NULL,
  
  -- Complete data snapshot
  data JSONB NOT NULL,           -- Full row data at this version
  metadata JSONB DEFAULT '{}',   -- Full metadata at this version
  
  -- Change context
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'restore', 'import', 'ai_edit')),
  change_reason TEXT,            -- Optional: "Corrected typo", "Updated after call"
  change_summary TEXT,           -- Auto-generated: "Changed email, name"
  
  -- Batch operations
  batch_operation_id UUID,       -- Links multiple changes in same operation
  
  -- Authorship
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- AI context
  ai_assisted BOOLEAN DEFAULT false,  -- Was this edit suggested by AI?
  ai_confidence FLOAT,                -- AI confidence if ai_assisted
  ai_suggestion_id UUID,              -- Reference to ai_field_suggestions if applied
  
  -- Archive support
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  archived_by UUID,
  archive_reason TEXT,
  
  -- Indexing
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient history queries
CREATE INDEX idx_row_versions_row_id ON row_versions(row_id, version_number DESC);
CREATE INDEX idx_row_versions_table_id ON row_versions(table_id, changed_at DESC);
CREATE INDEX idx_row_versions_changed_by ON row_versions(changed_by, changed_at DESC);
CREATE INDEX idx_row_versions_batch ON row_versions(batch_operation_id) WHERE batch_operation_id IS NOT NULL;

-- Constraint: version numbers are sequential per row
CREATE UNIQUE INDEX idx_row_versions_unique ON row_versions(row_id, version_number);
