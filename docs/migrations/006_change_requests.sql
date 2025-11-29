-- Change requests for approval workflow
CREATE TABLE change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
  row_id UUID NOT NULL REFERENCES table_rows(id) ON DELETE CASCADE,
  
  -- The proposed change
  current_data JSONB NOT NULL,      -- Data before proposed change
  proposed_data JSONB NOT NULL,     -- Proposed new data
  changed_fields TEXT[] NOT NULL,   -- List of field names being changed
  
  -- Request context
  change_reason TEXT,               -- Why the change is being made
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Awaiting review
    'approved',   -- Change approved and applied
    'rejected',   -- Change rejected
    'cancelled'   -- Requester cancelled
  )),
  
  -- Requester
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Reviewer
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- If approved, which version it created
  applied_version_id UUID REFERENCES row_versions(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_change_requests_workspace ON change_requests(workspace_id, status);
CREATE INDEX idx_change_requests_table ON change_requests(table_id, status);
CREATE INDEX idx_change_requests_row ON change_requests(row_id, status);
CREATE INDEX idx_change_requests_requester ON change_requests(requested_by, status);
CREATE INDEX idx_change_requests_pending ON change_requests(table_id) WHERE status = 'pending';
