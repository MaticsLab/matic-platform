-- Add applicant dashboard support
-- Dashboard layout stores the builder-defined configuration for the applicant-facing dashboard

-- Add dashboard_layout to data_tables (forms)
ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS dashboard_layout JSONB DEFAULT '{}';

-- Add dashboard_enabled flag to easily toggle dashboard visibility
ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS dashboard_enabled BOOLEAN DEFAULT false;

-- Comment explaining the dashboard_layout schema
COMMENT ON COLUMN data_tables.dashboard_layout IS 'Applicant dashboard configuration: { sections: [{id, title, type, fields?, widgets?}], settings: {showStatus, showTimeline, showChat, theme} }';

-- Create portal_activities table for chat messages between applicants and reviewers
CREATE TABLE IF NOT EXISTS portal_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    row_id UUID NOT NULL REFERENCES rows(id) ON DELETE CASCADE,
    applicant_id UUID REFERENCES portal_applicants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Activity type: message, status_update, file_request, note
    activity_type VARCHAR(50) NOT NULL DEFAULT 'message',
    
    -- Content
    content TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Visibility: 'applicant' (visible to applicant), 'internal' (staff only), 'both'
    visibility VARCHAR(20) DEFAULT 'both',
    
    -- Read tracking
    read_by_applicant BOOLEAN DEFAULT false,
    read_by_staff BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_portal_activities_form_id ON portal_activities(form_id);
CREATE INDEX IF NOT EXISTS idx_portal_activities_row_id ON portal_activities(row_id);
CREATE INDEX IF NOT EXISTS idx_portal_activities_applicant ON portal_activities(applicant_id);
CREATE INDEX IF NOT EXISTS idx_portal_activities_type ON portal_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_portal_activities_created ON portal_activities(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_portal_activities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_portal_activities_updated_at ON portal_activities;
CREATE TRIGGER trigger_portal_activities_updated_at
    BEFORE UPDATE ON portal_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_portal_activities_updated_at();
