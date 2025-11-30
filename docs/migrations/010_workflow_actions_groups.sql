-- Migration: Create workflow actions, application groups, and stage actions tables
-- These tables support custom workflow actions and application grouping

-- Application Groups (for organizing applications outside the main pipeline)
CREATE TABLE IF NOT EXISTS application_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    review_workflow_id UUID NOT NULL REFERENCES review_workflows(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(50) DEFAULT 'gray',
    icon VARCHAR(50) DEFAULT 'folder',
    order_index INTEGER DEFAULT 0,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_application_groups_workspace_id ON application_groups(workspace_id);
CREATE INDEX IF NOT EXISTS idx_application_groups_review_workflow_id ON application_groups(review_workflow_id);

-- Workflow Actions (global actions available across all stages in a workflow)
CREATE TABLE IF NOT EXISTS workflow_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    review_workflow_id UUID NOT NULL REFERENCES review_workflows(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(50) DEFAULT 'gray',
    icon VARCHAR(50) DEFAULT 'circle',
    action_type VARCHAR(50) NOT NULL DEFAULT 'move_to_group',
    target_group_id UUID REFERENCES application_groups(id) ON DELETE SET NULL,
    target_stage_id UUID REFERENCES application_stages(id) ON DELETE SET NULL,
    requires_comment BOOLEAN DEFAULT FALSE,
    is_system BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_workflow_actions_workspace_id ON workflow_actions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflow_actions_review_workflow_id ON workflow_actions(review_workflow_id);

-- Stage Actions (actions specific to a particular stage)
CREATE TABLE IF NOT EXISTS stage_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES application_stages(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(50) DEFAULT 'blue',
    icon VARCHAR(50) DEFAULT 'check',
    action_type VARCHAR(50) NOT NULL DEFAULT 'set_status',
    target_group_id UUID REFERENCES application_groups(id) ON DELETE SET NULL,
    target_stage_id UUID REFERENCES application_stages(id) ON DELETE SET NULL,
    status_value VARCHAR(100),
    requires_comment BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by stage
CREATE INDEX IF NOT EXISTS idx_stage_actions_stage_id ON stage_actions(stage_id);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_application_groups_updated_at ON application_groups;
CREATE TRIGGER update_application_groups_updated_at
    BEFORE UPDATE ON application_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_actions_updated_at ON workflow_actions;
CREATE TRIGGER update_workflow_actions_updated_at
    BEFORE UPDATE ON workflow_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stage_actions_updated_at ON stage_actions;
CREATE TRIGGER update_stage_actions_updated_at
    BEFORE UPDATE ON stage_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
