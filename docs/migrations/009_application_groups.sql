-- Add application groups and workflow actions tables
-- Application groups are custom storage areas outside the pipeline (Rejected, Waitlist, etc.)

-- Create application_groups table
CREATE TABLE IF NOT EXISTS application_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    review_workflow_id UUID NOT NULL REFERENCES review_workflows(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(50) DEFAULT 'gray',
    icon VARCHAR(50) DEFAULT 'folder',
    order_index INT DEFAULT 0,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflow_actions table (global actions that apply to all stages)
CREATE TABLE IF NOT EXISTS workflow_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    review_workflow_id UUID NOT NULL REFERENCES review_workflows(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(50) DEFAULT 'gray',
    icon VARCHAR(50) DEFAULT 'circle',
    action_type VARCHAR(50) DEFAULT 'move_to_group', -- move_to_group, move_to_stage, send_email, custom
    target_group_id UUID REFERENCES application_groups(id) ON DELETE SET NULL,
    target_stage_id UUID REFERENCES application_stages(id) ON DELETE SET NULL,
    requires_comment BOOLEAN DEFAULT false,
    is_system BOOLEAN DEFAULT false,
    order_index INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stage_actions table (actions specific to a stage)
CREATE TABLE IF NOT EXISTS stage_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES application_stages(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(50) DEFAULT 'blue',
    icon VARCHAR(50) DEFAULT 'check',
    action_type VARCHAR(50) DEFAULT 'set_status', -- set_status, advance_stage, move_to_group
    target_group_id UUID REFERENCES application_groups(id) ON DELETE SET NULL,
    target_stage_id UUID REFERENCES application_stages(id) ON DELETE SET NULL,
    status_value VARCHAR(100),
    requires_comment BOOLEAN DEFAULT false,
    order_index INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_application_groups_workflow ON application_groups(review_workflow_id);
CREATE INDEX IF NOT EXISTS idx_application_groups_workspace ON application_groups(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflow_actions_workflow ON workflow_actions(review_workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_actions_workspace ON workflow_actions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_stage_actions_stage ON stage_actions(stage_id);

-- Add group_id column to table_rows metadata tracking
-- (Applications in groups are stored via metadata->>'group_id' in the row)
COMMENT ON TABLE application_groups IS 'Custom groups for applications outside the pipeline (e.g., Rejected, Waitlist)';
COMMENT ON TABLE workflow_actions IS 'Global workflow actions that appear in all stages (e.g., Reject action)';
COMMENT ON TABLE stage_actions IS 'Stage-specific action buttons for setting status or moving applications';
