-- Migration: 018_automation_workflows.sql
-- Description: Create automation workflow tables for visual workflow builder
-- Created: 2024-12-25

-- =====================================================
-- AUTOMATION WORKFLOWS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS automation_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    nodes JSONB NOT NULL DEFAULT '[]',
    edges JSONB NOT NULL DEFAULT '[]',
    visibility VARCHAR(20) NOT NULL DEFAULT 'private',
    trigger_type VARCHAR(50) DEFAULT 'manual',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for automation_workflows
CREATE INDEX IF NOT EXISTS idx_automation_workflows_workspace_id ON automation_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_user_id ON automation_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_trigger_type ON automation_workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_is_active ON automation_workflows(is_active);

-- =====================================================
-- AUTOMATION WORKFLOW EXECUTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS automation_workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
    user_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    trigger_type VARCHAR(50),
    trigger_data JSONB,
    output JSONB,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for automation_workflow_executions
CREATE INDEX IF NOT EXISTS idx_automation_workflow_executions_workflow_id ON automation_workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_automation_workflow_executions_user_id ON automation_workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_workflow_executions_status ON automation_workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_automation_workflow_executions_created_at ON automation_workflow_executions(created_at DESC);

-- =====================================================
-- AUTOMATION WORKFLOW EXECUTION LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS automation_workflow_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES automation_workflow_executions(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    node_type VARCHAR(50),
    node_label VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    input JSONB,
    output JSONB,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for automation_workflow_execution_logs
CREATE INDEX IF NOT EXISTS idx_automation_workflow_execution_logs_execution_id ON automation_workflow_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_automation_workflow_execution_logs_node_id ON automation_workflow_execution_logs(node_id);
CREATE INDEX IF NOT EXISTS idx_automation_workflow_execution_logs_status ON automation_workflow_execution_logs(status);

-- =====================================================
-- INTEGRATION CREDENTIALS TABLE (for storing OAuth tokens, API keys, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS integration_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    integration_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    credentials JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for integration_credentials
CREATE INDEX IF NOT EXISTS idx_integration_credentials_workspace_id ON integration_credentials(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integration_credentials_user_id ON integration_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_credentials_integration_type ON integration_credentials(integration_type);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE automation_workflows IS 'Visual automation workflows (like Zapier/Make) for the workflow builder';
COMMENT ON TABLE automation_workflow_executions IS 'Execution history for automation workflows';
COMMENT ON TABLE automation_workflow_execution_logs IS 'Step-by-step logs for workflow executions';
COMMENT ON TABLE integration_credentials IS 'Stored credentials for third-party integrations';

COMMENT ON COLUMN automation_workflows.nodes IS 'React Flow nodes configuration (JSON array)';
COMMENT ON COLUMN automation_workflows.edges IS 'React Flow edges configuration (JSON array)';
COMMENT ON COLUMN automation_workflows.visibility IS 'private, public, or workspace';
COMMENT ON COLUMN automation_workflows.trigger_type IS 'manual, webhook, schedule, form_submission, row_created, row_updated';
COMMENT ON COLUMN automation_workflow_executions.status IS 'pending, running, completed, failed, cancelled';
COMMENT ON COLUMN automation_workflow_execution_logs.status IS 'pending, running, completed, failed, skipped';
