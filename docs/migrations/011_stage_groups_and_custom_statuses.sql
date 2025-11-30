-- Migration: Stage Groups and Custom Statuses System
-- This creates a comprehensive workflow action system with:
-- 1. Stage Groups (groups within a stage, visible only in that stage)
-- 2. Custom Statuses (action buttons that trigger actions)
-- 3. Tag Automations (automated actions based on tags)
-- 4. Custom Tags (reusable tags for workflow)

-- Stage Groups: Groups within a stage (e.g., "Needs More Info", "Under Committee Review")
-- Applications stay in the stage but are organized into sub-groups
CREATE TABLE IF NOT EXISTS stage_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES application_stages(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(50) DEFAULT 'blue',
    icon VARCHAR(50) DEFAULT 'folder',
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_groups_stage ON stage_groups(stage_id);
CREATE INDEX IF NOT EXISTS idx_stage_groups_workspace ON stage_groups(workspace_id);

-- Custom Statuses: Action buttons that appear in the review interface
-- Each status can trigger multiple actions when applied
CREATE TABLE IF NOT EXISTS custom_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES application_stages(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(50) DEFAULT 'blue',
    icon VARCHAR(50) DEFAULT 'circle',
    is_primary BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0,
    requires_comment BOOLEAN DEFAULT false,
    requires_score BOOLEAN DEFAULT false,
    actions JSONB DEFAULT '[]'::jsonb, -- Array of StatusActionConfig
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_statuses_stage ON custom_statuses(stage_id);
CREATE INDEX IF NOT EXISTS idx_custom_statuses_workspace ON custom_statuses(workspace_id);

-- Custom Tags: Tags that can be applied to applications
CREATE TABLE IF NOT EXISTS custom_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    review_workflow_id UUID NOT NULL REFERENCES review_workflows(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES application_stages(id) ON DELETE SET NULL, -- NULL means available in all stages
    name VARCHAR(255) NOT NULL,
    color VARCHAR(50) DEFAULT 'gray',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_tags_workspace ON custom_tags(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_tags_workflow ON custom_tags(review_workflow_id);
CREATE INDEX IF NOT EXISTS idx_custom_tags_stage ON custom_tags(stage_id);

-- Tag Automations: Automated actions triggered by tags
CREATE TABLE IF NOT EXISTS tag_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    review_workflow_id UUID NOT NULL REFERENCES review_workflows(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES application_stages(id) ON DELETE SET NULL, -- NULL means trigger in any stage
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL, -- tag_added, tag_removed, tag_present
    trigger_tag VARCHAR(255) NOT NULL,
    conditions JSONB DEFAULT '{}'::jsonb,
    actions JSONB DEFAULT '[]'::jsonb, -- Array of StatusActionConfig
    is_active BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tag_automations_workspace ON tag_automations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tag_automations_workflow ON tag_automations(review_workflow_id);
CREATE INDEX IF NOT EXISTS idx_tag_automations_stage ON tag_automations(stage_id);
CREATE INDEX IF NOT EXISTS idx_tag_automations_trigger_tag ON tag_automations(trigger_tag);

-- Add stage_group_id to form_submissions to track which stage group an application is in
ALTER TABLE form_submissions 
ADD COLUMN IF NOT EXISTS stage_group_id UUID REFERENCES stage_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_form_submissions_stage_group ON form_submissions(stage_group_id);

-- Add tags column to form_submissions if not exists
ALTER TABLE form_submissions 
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Create GIN index for faster tag queries
CREATE INDEX IF NOT EXISTS idx_form_submissions_tags ON form_submissions USING GIN (tags);

-- Comment on tables
COMMENT ON TABLE stage_groups IS 'Groups within a stage - applications stay in stage but organized into sub-groups';
COMMENT ON TABLE custom_statuses IS 'Action buttons in review interface that trigger configurable actions';
COMMENT ON TABLE custom_tags IS 'Tags that can be applied to applications for organization and automation';
COMMENT ON TABLE tag_automations IS 'Automated actions triggered when tags are added/removed';
COMMENT ON COLUMN form_submissions.stage_group_id IS 'Current stage group the application is in (within its current stage)';
COMMENT ON COLUMN form_submissions.tags IS 'Array of tag names applied to this application';
