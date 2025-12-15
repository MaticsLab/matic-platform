-- Migration: Portal Activities for Applicant Dashboard
-- Created: 2025-12-15
-- Description: Unified activity feed for applicant portal (messages, status changes, documents, etc.)

-- Portal Activities Table
CREATE TABLE IF NOT EXISTS portal_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Link to applicant (required)
    applicant_id UUID NOT NULL REFERENCES portal_applicants(id) ON DELETE CASCADE,
    
    -- Link to form for querying all activities for a form
    form_id UUID NOT NULL REFERENCES table_views(id) ON DELETE CASCADE,
    
    -- Activity type: 'message', 'status_change', 'document', 'field_update', 'system'
    activity_type VARCHAR(50) NOT NULL,
    
    -- Direction: 'inbound' (from applicant), 'outbound' (from staff), 'system' (automated)
    direction VARCHAR(20) NOT NULL DEFAULT 'system',
    
    -- Content varies by type:
    -- message: { "text": "...", "attachments": [...] }
    -- status_change: { "from": "submitted", "to": "under_review", "note": "..." }
    -- document: { "file_name": "...", "file_url": "...", "file_type": "..." }
    -- field_update: { "field_id": "...", "field_label": "...", "old_value": "...", "new_value": "..." }
    -- system: { "event": "...", "details": "..." }
    content JSONB NOT NULL DEFAULT '{}',
    
    -- Who created this activity (null for system/applicant activities)
    created_by UUID,
    created_by_name VARCHAR(255),
    
    -- Read status for applicant
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_portal_activities_applicant_id ON portal_activities(applicant_id);
CREATE INDEX idx_portal_activities_form_id ON portal_activities(form_id);
CREATE INDEX idx_portal_activities_type ON portal_activities(activity_type);
CREATE INDEX idx_portal_activities_created_at ON portal_activities(created_at DESC);
CREATE INDEX idx_portal_activities_unread ON portal_activities(applicant_id, is_read) WHERE is_read = false;

-- Composite index for common query pattern
CREATE INDEX idx_portal_activities_applicant_created ON portal_activities(applicant_id, created_at DESC);

-- Comments
COMMENT ON TABLE portal_activities IS 'Unified activity feed for applicant portal - messages, status changes, documents, etc.';
COMMENT ON COLUMN portal_activities.activity_type IS 'Type of activity: message, status_change, document, field_update, system';
COMMENT ON COLUMN portal_activities.direction IS 'Direction: inbound (from applicant), outbound (from staff), system (automated)';
COMMENT ON COLUMN portal_activities.content IS 'JSONB content that varies by activity_type';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_portal_activities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_portal_activities_updated_at
    BEFORE UPDATE ON portal_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_portal_activities_updated_at();

-- Function to create activity on status change (can be called from application)
CREATE OR REPLACE FUNCTION create_status_change_activity(
    p_applicant_id UUID,
    p_form_id UUID,
    p_from_status VARCHAR,
    p_to_status VARCHAR,
    p_note TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL,
    p_created_by_name VARCHAR DEFAULT 'System'
) RETURNS UUID AS $$
DECLARE
    v_activity_id UUID;
BEGIN
    INSERT INTO portal_activities (
        applicant_id, form_id, activity_type, direction, content, created_by, created_by_name
    ) VALUES (
        p_applicant_id,
        p_form_id,
        'status_change',
        CASE WHEN p_created_by IS NULL THEN 'system' ELSE 'outbound' END,
        jsonb_build_object(
            'from', p_from_status,
            'to', p_to_status,
            'note', p_note
        ),
        p_created_by,
        p_created_by_name
    ) RETURNING id INTO v_activity_id;
    
    RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql;
