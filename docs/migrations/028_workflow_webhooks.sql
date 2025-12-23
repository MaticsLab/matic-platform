-- Migration: Create workflow_webhook_configs table
-- This table stores webhook configurations for workflow automations

CREATE TABLE IF NOT EXISTS workflow_webhook_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    workflow_id TEXT NOT NULL,  -- ID in the external workflow builder system
    webhook_url TEXT NOT NULL,  -- URL to call when trigger fires
    api_key TEXT,               -- API key for authentication
    trigger_type TEXT NOT NULL, -- new_submission, stage_changed, score_submitted, tag_changed, status_changed
    config JSONB DEFAULT '{}',  -- Additional configuration (e.g., specific stage ID, tag name, etc.)
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_workflow_webhooks_form_id ON workflow_webhook_configs(form_id);
CREATE INDEX IF NOT EXISTS idx_workflow_webhooks_trigger_type ON workflow_webhook_configs(form_id, trigger_type) WHERE enabled = true;

-- Comments
COMMENT ON TABLE workflow_webhook_configs IS 'Stores webhook configurations for workflow automations triggered by application events';
COMMENT ON COLUMN workflow_webhook_configs.trigger_type IS 'Event type: new_submission, stage_changed, score_submitted, tag_changed, status_changed';
COMMENT ON COLUMN workflow_webhook_configs.workflow_id IS 'Reference to the workflow in the external workflow builder system';
