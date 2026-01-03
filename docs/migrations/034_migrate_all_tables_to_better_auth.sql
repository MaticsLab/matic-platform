-- Migration: Migrate all tables to use Better Auth (ba_users, ba_organizations)
-- This is a comprehensive migration that:
-- 1. Adds ba_user_id columns to all tables with user references
-- 2. Migrates data from Supabase UUIDs to Better Auth TEXT IDs
-- 3. Maps workspaces to ba_organizations
-- 4. Maps workspace_members to ba_members

-- ============================================
-- STEP 1: Add ba_user_id columns to all tables
-- ============================================

-- ai_field_suggestions
ALTER TABLE ai_field_suggestions 
ADD COLUMN IF NOT EXISTS ba_reviewed_by TEXT;

-- automation_workflow_executions
ALTER TABLE automation_workflow_executions 
ADD COLUMN IF NOT EXISTS ba_user_id TEXT;

-- automation_workflows
ALTER TABLE automation_workflows 
ADD COLUMN IF NOT EXISTS ba_user_id TEXT;

-- change_approvals
ALTER TABLE change_approvals 
ADD COLUMN IF NOT EXISTS ba_reviewed_by TEXT;

-- change_requests
ALTER TABLE change_requests 
ADD COLUMN IF NOT EXISTS ba_reviewed_by TEXT;

-- data_tables
ALTER TABLE data_tables 
ADD COLUMN IF NOT EXISTS ba_created_by TEXT;

-- sub_modules
ALTER TABLE sub_modules 
ADD COLUMN IF NOT EXISTS ba_created_by TEXT;

-- table_rows
ALTER TABLE table_rows 
ADD COLUMN IF NOT EXISTS ba_created_by TEXT,
ADD COLUMN IF NOT EXISTS ba_updated_by TEXT;

-- table_views
ALTER TABLE table_views 
ADD COLUMN IF NOT EXISTS ba_created_by TEXT;

-- workspaces
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS ba_created_by TEXT;

-- workspace_members (already has ba_user_id, but need ba_invited_by)
ALTER TABLE workspace_members 
ADD COLUMN IF NOT EXISTS ba_invited_by TEXT;

-- search_analytics
ALTER TABLE search_analytics 
ADD COLUMN IF NOT EXISTS ba_user_id TEXT;

-- organization_members
ALTER TABLE organization_members 
ADD COLUMN IF NOT EXISTS ba_user_id TEXT;

-- ============================================
-- STEP 2: Populate ba_user_id columns from ba_users mapping
-- ============================================

-- ai_field_suggestions.reviewed_by
UPDATE ai_field_suggestions afs
SET ba_reviewed_by = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = afs.reviewed_by::text
  AND ba.supabase_user_id IS NOT NULL
  AND afs.reviewed_by IS NOT NULL;

-- automation_workflow_executions.user_id
UPDATE automation_workflow_executions awe
SET ba_user_id = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = awe.user_id::text
  AND ba.supabase_user_id IS NOT NULL
  AND awe.user_id IS NOT NULL;

-- automation_workflows.user_id
UPDATE automation_workflows aw
SET ba_user_id = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = aw.user_id::text
  AND ba.supabase_user_id IS NOT NULL
  AND aw.user_id IS NOT NULL;

-- change_approvals.reviewed_by
UPDATE change_approvals ca
SET ba_reviewed_by = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = ca.reviewed_by::text
  AND ba.supabase_user_id IS NOT NULL
  AND ca.reviewed_by IS NOT NULL;

-- change_requests.reviewed_by
UPDATE change_requests cr
SET ba_reviewed_by = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = cr.reviewed_by::text
  AND ba.supabase_user_id IS NOT NULL
  AND cr.reviewed_by IS NOT NULL;

-- data_tables.created_by
UPDATE data_tables dt
SET ba_created_by = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = dt.created_by::text
  AND ba.supabase_user_id IS NOT NULL
  AND dt.created_by IS NOT NULL;

-- sub_modules.created_by
UPDATE sub_modules sm
SET ba_created_by = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = sm.created_by::text
  AND ba.supabase_user_id IS NOT NULL
  AND sm.created_by IS NOT NULL;

-- table_rows.created_by
UPDATE table_rows tr
SET ba_created_by = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = tr.created_by::text
  AND ba.supabase_user_id IS NOT NULL
  AND tr.created_by IS NOT NULL;

-- table_rows.updated_by
UPDATE table_rows tr
SET ba_updated_by = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = tr.updated_by::text
  AND ba.supabase_user_id IS NOT NULL
  AND tr.updated_by IS NOT NULL;

-- table_views.created_by
UPDATE table_views tv
SET ba_created_by = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = tv.created_by::text
  AND ba.supabase_user_id IS NOT NULL
  AND tv.created_by IS NOT NULL;

-- workspaces.created_by
UPDATE workspaces w
SET ba_created_by = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = w.created_by::text
  AND ba.supabase_user_id IS NOT NULL
  AND w.created_by IS NOT NULL;

-- workspace_members.invited_by
UPDATE workspace_members wm
SET ba_invited_by = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = wm.invited_by::text
  AND ba.supabase_user_id IS NOT NULL
  AND wm.invited_by IS NOT NULL;

-- search_analytics.user_id
UPDATE search_analytics sa
SET ba_user_id = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = sa.user_id::text
  AND ba.supabase_user_id IS NOT NULL
  AND sa.user_id IS NOT NULL;

-- organization_members.user_id
UPDATE organization_members om
SET ba_user_id = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = om.user_id::text
  AND ba.supabase_user_id IS NOT NULL
  AND om.user_id IS NOT NULL;

-- ============================================
-- STEP 3: Create ba_organizations from workspaces
-- ============================================

-- Ensure all workspaces have a ba_organization_id
-- This uses the function from 029_better_auth.sql if it exists
DO $$
DECLARE
    v_workspace RECORD;
    v_org_id TEXT;
    v_owner_ba_user_id TEXT;
BEGIN
    FOR v_workspace IN 
        SELECT w.id, w.name, w.slug, w.created_by, w.ba_organization_id
        FROM workspaces w
        WHERE w.ba_organization_id IS NULL
    LOOP
        -- Get the Better Auth user ID for the workspace owner
        SELECT ba.id INTO v_owner_ba_user_id
        FROM ba_users ba
        WHERE ba.supabase_user_id::text = v_workspace.created_by::text
        LIMIT 1;
        
        IF v_owner_ba_user_id IS NULL THEN
            RAISE NOTICE 'Skipping workspace % - owner not found in ba_users', v_workspace.id;
            CONTINUE;
        END IF;
        
        -- Generate organization ID
        v_org_id := gen_random_uuid()::TEXT;
        
        -- Create organization
        INSERT INTO ba_organizations (
            id,
            name,
            slug,
            metadata,
            created_at,
            updated_at
        ) VALUES (
            v_org_id,
            v_workspace.name,
            v_workspace.slug,
            jsonb_build_object('workspace_id', v_workspace.id::TEXT, 'legacy_workspace', true),
            NOW(),
            NOW()
        ) ON CONFLICT (slug) DO UPDATE SET
            metadata = EXCLUDED.metadata;
        
        -- Link workspace to organization
        UPDATE workspaces 
        SET ba_organization_id = v_org_id 
        WHERE id = v_workspace.id;
        
        -- Add workspace owner as organization owner
        INSERT INTO ba_members (
            id,
            organization_id,
            user_id,
            role,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid()::TEXT,
            v_org_id,
            v_owner_ba_user_id,
            'owner',
            NOW(),
            NOW()
        ) ON CONFLICT (organization_id, user_id) DO NOTHING;
        
        RAISE NOTICE 'Created organization % for workspace %', v_org_id, v_workspace.id;
    END LOOP;
END $$;

-- ============================================
-- STEP 4: Migrate workspace_members to ba_members
-- ============================================

-- Add all active workspace members to ba_members
INSERT INTO ba_members (
    id,
    organization_id,
    user_id,
    role,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid()::TEXT,
    w.ba_organization_id,
    wm.ba_user_id,
    CASE 
        WHEN wm.role = 'owner' THEN 'owner'
        WHEN wm.role = 'admin' THEN 'admin'
        WHEN wm.role = 'editor' THEN 'member'
        ELSE 'viewer'
    END,
    wm.added_at,
    wm.updated_at
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.ba_user_id IS NOT NULL
  AND wm.status = 'active'
  AND w.ba_organization_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    updated_at = EXCLUDED.updated_at;

-- ============================================
-- STEP 5: Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ai_field_suggestions_ba_reviewed_by 
ON ai_field_suggestions(ba_reviewed_by) 
WHERE ba_reviewed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_workflow_executions_ba_user_id 
ON automation_workflow_executions(ba_user_id) 
WHERE ba_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_workflows_ba_user_id 
ON automation_workflows(ba_user_id) 
WHERE ba_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_change_approvals_ba_reviewed_by 
ON change_approvals(ba_reviewed_by) 
WHERE ba_reviewed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_change_requests_ba_reviewed_by 
ON change_requests(ba_reviewed_by) 
WHERE ba_reviewed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_tables_ba_created_by 
ON data_tables(ba_created_by) 
WHERE ba_created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sub_modules_ba_created_by 
ON sub_modules(ba_created_by) 
WHERE ba_created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_table_rows_ba_created_by 
ON table_rows(ba_created_by) 
WHERE ba_created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_table_rows_ba_updated_by 
ON table_rows(ba_updated_by) 
WHERE ba_updated_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_table_views_ba_created_by 
ON table_views(ba_created_by) 
WHERE ba_created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_ba_created_by 
ON workspaces(ba_created_by) 
WHERE ba_created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_members_ba_invited_by 
ON workspace_members(ba_invited_by) 
WHERE ba_invited_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_search_analytics_ba_user_id 
ON search_analytics(ba_user_id) 
WHERE ba_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organization_members_ba_user_id 
ON organization_members(ba_user_id) 
WHERE ba_user_id IS NOT NULL;

-- ============================================
-- STEP 6: Add comments
-- ============================================

COMMENT ON COLUMN ai_field_suggestions.ba_reviewed_by IS 'Better Auth user ID (TEXT) - replaces reviewed_by UUID';
COMMENT ON COLUMN automation_workflow_executions.ba_user_id IS 'Better Auth user ID (TEXT) - replaces user_id UUID';
COMMENT ON COLUMN automation_workflows.ba_user_id IS 'Better Auth user ID (TEXT) - replaces user_id UUID';
COMMENT ON COLUMN change_approvals.ba_reviewed_by IS 'Better Auth user ID (TEXT) - replaces reviewed_by UUID';
COMMENT ON COLUMN change_requests.ba_reviewed_by IS 'Better Auth user ID (TEXT) - replaces reviewed_by UUID';
COMMENT ON COLUMN data_tables.ba_created_by IS 'Better Auth user ID (TEXT) - replaces created_by UUID';
COMMENT ON COLUMN sub_modules.ba_created_by IS 'Better Auth user ID (TEXT) - replaces created_by UUID';
COMMENT ON COLUMN table_rows.ba_created_by IS 'Better Auth user ID (TEXT) - replaces created_by UUID';
COMMENT ON COLUMN table_rows.ba_updated_by IS 'Better Auth user ID (TEXT) - replaces updated_by UUID';
COMMENT ON COLUMN table_views.ba_created_by IS 'Better Auth user ID (TEXT) - replaces created_by UUID';
COMMENT ON COLUMN workspaces.ba_created_by IS 'Better Auth user ID (TEXT) - replaces created_by UUID';
COMMENT ON COLUMN workspace_members.ba_invited_by IS 'Better Auth user ID (TEXT) - replaces invited_by UUID';
COMMENT ON COLUMN search_analytics.ba_user_id IS 'Better Auth user ID (TEXT) - replaces user_id UUID';
COMMENT ON COLUMN organization_members.ba_user_id IS 'Better Auth user ID (TEXT) - replaces user_id UUID';

