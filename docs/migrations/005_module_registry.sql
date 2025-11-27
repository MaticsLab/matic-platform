-- =====================================================
-- MIGRATION 005: MODULE REGISTRY & HUB TYPE SYSTEM
-- =====================================================
-- This migration introduces a structured module registry pattern
-- to control which features are available per hub type.
-- 
-- Key concepts:
-- - Hub Types: Categories of data tables (activities, applications, data)
-- - Module Definitions: Available features that can be enabled
-- - Hub Module Configs: Per-table module enablement settings
--
-- CLEANUP: Removes legacy/redundant tables:
-- - activities_hubs, activities_hub_tabs (replaced by data_tables with hub_type)
-- - module_configs, module_instances (replaced by hub_module_configs)
-- - request_hub_forms, request_hub_tables (legacy, unused)
-- - forms, form_fields, form_submissions (NOT USED - using data_tables instead)
-- - form_table_connections (NOT USED - forms are data_tables with icon='form')
-- =====================================================

-- =====================================================
-- PHASE 0: DROP LEGACY/REDUNDANT TABLES
-- =====================================================

-- Drop old module system tables from 003_schema_cleanup.sql (replaced by hub_module_configs)
DROP TABLE IF EXISTS module_instances CASCADE;
DROP TABLE IF EXISTS module_configs CASCADE;

-- Drop legacy request hub tables (unused)
DROP TABLE IF EXISTS request_hub_forms CASCADE;
DROP TABLE IF EXISTS request_hub_tables CASCADE;
DROP TABLE IF EXISTS request_templates CASCADE;

-- Drop unused forms tables (we use data_tables with icon='form' instead)
-- The Go backend uses models.Table for forms, not a separate forms table
DROP TABLE IF EXISTS form_table_connections CASCADE;
DROP TABLE IF EXISTS form_submissions CASCADE;
DROP TABLE IF EXISTS form_fields CASCADE;
DROP TABLE IF EXISTS forms CASCADE;

-- Migrate activities_hubs data to data_tables before dropping
-- First, create data_tables entries for any activities_hubs that don't have corresponding tables
DO $$
DECLARE
    hub RECORD;
    new_table_id UUID;
BEGIN
    -- Check if activities_hubs table exists before trying to migrate
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activities_hubs') THEN
        FOR hub IN 
            SELECT ah.* FROM activities_hubs ah
            WHERE NOT EXISTS (
                SELECT 1 FROM data_tables dt 
                WHERE dt.workspace_id = ah.workspace_id 
                AND dt.slug = ah.slug
            )
        LOOP
            -- Insert into data_tables with hub_type = 'activities'
            INSERT INTO data_tables (
                id, workspace_id, name, slug, description, icon, color, 
                settings, hub_type, created_by, created_at, updated_at
            ) VALUES (
                hub.id, -- Use same ID for easier reference
                hub.workspace_id,
                hub.name,
                hub.slug,
                hub.description,
                COALESCE((hub.settings->>'icon')::TEXT, 'calendar'),
                COALESCE((hub.settings->>'color')::TEXT, '#10B981'),
                hub.settings,
                'activities',
                hub.created_by,
                hub.created_at,
                hub.updated_at
            )
            ON CONFLICT (id) DO UPDATE SET hub_type = 'activities';
            
            RAISE NOTICE 'Migrated activities_hub % to data_tables', hub.name;
        END LOOP;
        
        -- Update any existing data_tables that match activities_hubs by slug
        UPDATE data_tables dt
        SET hub_type = 'activities'
        FROM activities_hubs ah
        WHERE dt.workspace_id = ah.workspace_id 
        AND dt.slug = ah.slug
        AND (dt.hub_type IS NULL OR dt.hub_type = 'data');
    END IF;
END $$;

-- Now safe to drop activities_hubs tables
DROP TABLE IF EXISTS activities_hub_tabs CASCADE;
DROP TABLE IF EXISTS activities_hubs CASCADE;

-- =====================================================
-- PHASE 1: ADD HUB_TYPE TO DATA_TABLES
-- =====================================================

-- Add hub_type column to identify what kind of hub this table is
ALTER TABLE data_tables 
ADD COLUMN IF NOT EXISTS hub_type TEXT DEFAULT 'data' 
CHECK (hub_type IN ('activities', 'applications', 'data'));

-- Add comment explaining hub types
COMMENT ON COLUMN data_tables.hub_type IS 
'Hub type determines available modules: activities (events/attendance), applications (review workflows), data (general tables)';

-- Create index for filtering by hub type
CREATE INDEX IF NOT EXISTS idx_data_tables_hub_type ON data_tables(hub_type);

-- =====================================================
-- PHASE 2: CREATE MODULE DEFINITIONS TABLE
-- =====================================================

-- Central registry of all available modules in the system
-- This is a reference table - typically seeded once and rarely modified
CREATE TABLE IF NOT EXISTS module_definitions (
    id TEXT PRIMARY KEY,  -- e.g., 'pulse', 'review_workflow', 'analytics'
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    category TEXT DEFAULT 'core' CHECK (category IN ('core', 'productivity', 'communication', 'integration')),
    
    -- Module availability
    is_premium BOOLEAN DEFAULT FALSE,
    is_beta BOOLEAN DEFAULT FALSE,
    is_deprecated BOOLEAN DEFAULT FALSE,
    
    -- Which hub types can use this module
    available_for_hub_types TEXT[] DEFAULT ARRAY['data']::TEXT[],
    
    -- Module dependencies (e.g., review_workflow requires forms)
    dependencies TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Default settings schema (JSON Schema for validation)
    settings_schema JSONB DEFAULT '{}',
    
    -- Display order in UI
    display_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE module_definitions IS 
'Central registry of all available modules. Defines which hub types can use each module.';

-- =====================================================
-- PHASE 3: CREATE HUB MODULE CONFIGS TABLE
-- =====================================================

-- Per-table (hub) module enablement and configuration
CREATE TABLE IF NOT EXISTS hub_module_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL REFERENCES module_definitions(id) ON DELETE CASCADE,
    
    -- Module state
    is_enabled BOOLEAN DEFAULT TRUE,
    
    -- Module-specific settings
    settings JSONB DEFAULT '{}',
    
    -- Audit
    enabled_by UUID REFERENCES auth.users(id),
    enabled_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(table_id, module_id)
);

COMMENT ON TABLE hub_module_configs IS 
'Per-table module configuration. Controls which modules are enabled for each hub.';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_hub_module_configs_table ON hub_module_configs(table_id);
CREATE INDEX IF NOT EXISTS idx_hub_module_configs_module ON hub_module_configs(module_id);
CREATE INDEX IF NOT EXISTS idx_hub_module_configs_enabled ON hub_module_configs(table_id, is_enabled);

-- =====================================================
-- PHASE 4: SEED MODULE DEFINITIONS
-- =====================================================

INSERT INTO module_definitions (id, name, description, icon, category, is_premium, available_for_hub_types, dependencies, display_order)
VALUES
    -- Core modules (available everywhere)
    ('tables', 'Tables', 'Airtable-like data tables with columns and rows', 'table', 'core', FALSE, 
     ARRAY['activities', 'applications', 'data']::TEXT[], ARRAY[]::TEXT[], 1),
    
    ('views', 'Views', 'Grid, Kanban, Calendar, and Gallery views', 'layout', 'core', FALSE, 
     ARRAY['activities', 'applications', 'data']::TEXT[], ARRAY['tables']::TEXT[], 2),
    
    ('forms', 'Forms', 'Create intake forms that populate tables', 'file-text', 'core', FALSE, 
     ARRAY['activities', 'applications', 'data']::TEXT[], ARRAY['tables']::TEXT[], 3),
    
    -- Activities Hub specific
    ('pulse', 'Pulse Scanning', 'Barcode/QR code check-in and attendance tracking', 'scan-line', 'productivity', FALSE, 
     ARRAY['activities']::TEXT[], ARRAY['tables']::TEXT[], 10),
    
    ('attendance', 'Attendance Tracking', 'Track attendance for activities and events', 'user-check', 'productivity', FALSE, 
     ARRAY['activities']::TEXT[], ARRAY['tables', 'pulse']::TEXT[], 11),
    
    ('calendar', 'Calendar Integration', 'Sync activities with calendar apps', 'calendar', 'integration', FALSE, 
     ARRAY['activities']::TEXT[], ARRAY['tables']::TEXT[], 12),
    
    -- Applications Hub specific
    ('review_workflow', 'Review Workflows', 'Multi-stage application review with stages and reviewers', 'workflow', 'productivity', FALSE, 
     ARRAY['applications']::TEXT[], ARRAY['tables', 'forms']::TEXT[], 20),
    
    ('rubrics', 'Scoring Rubrics', 'Create rubrics for consistent scoring', 'list-checks', 'productivity', FALSE, 
     ARRAY['applications']::TEXT[], ARRAY['review_workflow']::TEXT[], 21),
    
    ('reviewer_portal', 'External Reviewer Portal', 'Allow external reviewers to score applications', 'external-link', 'productivity', FALSE, 
     ARRAY['applications']::TEXT[], ARRAY['review_workflow', 'rubrics']::TEXT[], 22),
    
    ('decision_logic', 'Decision Logic', 'Automate advancement and rejection based on scores', 'git-branch', 'productivity', FALSE, 
     ARRAY['applications']::TEXT[], ARRAY['review_workflow']::TEXT[], 23),
    
    -- Analytics (premium, available everywhere)
    ('analytics', 'Advanced Analytics', 'Charts, reports, and dashboards', 'chart-bar', 'productivity', TRUE, 
     ARRAY['activities', 'applications', 'data']::TEXT[], ARRAY['tables']::TEXT[], 30),
    
    ('export', 'Advanced Export', 'Export to Excel, PDF, and custom formats', 'download', 'productivity', FALSE, 
     ARRAY['activities', 'applications', 'data']::TEXT[], ARRAY['tables']::TEXT[], 31),
    
    -- Communication (future)
    ('notifications', 'Notifications', 'Email and in-app notifications', 'bell', 'communication', FALSE, 
     ARRAY['activities', 'applications', 'data']::TEXT[], ARRAY[]::TEXT[], 40),
    
    ('email_templates', 'Email Templates', 'Create reusable email templates', 'mail', 'communication', TRUE, 
     ARRAY['applications']::TEXT[], ARRAY['notifications']::TEXT[], 41)

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    available_for_hub_types = EXCLUDED.available_for_hub_types,
    dependencies = EXCLUDED.dependencies,
    updated_at = NOW();

-- =====================================================
-- PHASE 5: ROW LEVEL SECURITY
-- =====================================================

-- Module definitions are public read
ALTER TABLE module_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view module definitions" ON module_definitions
    FOR SELECT USING (TRUE);

CREATE POLICY "Only superadmins can modify module definitions" ON module_definitions
    FOR ALL USING (FALSE); -- Managed via migrations only

-- Hub module configs inherit from table access
ALTER TABLE hub_module_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view module configs for accessible tables" ON hub_module_configs
    FOR SELECT USING (
        table_id IN (
            SELECT dt.id FROM data_tables dt
            JOIN workspace_members wm ON dt.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage module configs" ON hub_module_configs
    FOR ALL USING (
        table_id IN (
            SELECT dt.id FROM data_tables dt
            JOIN workspace_members wm ON dt.workspace_id = wm.workspace_id
            WHERE wm.user_id = auth.uid() AND wm.role = 'admin'
        )
    );

-- =====================================================
-- PHASE 6: HELPER FUNCTIONS
-- =====================================================

-- Function to get available modules for a hub type
CREATE OR REPLACE FUNCTION get_available_modules(p_hub_type TEXT)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    description TEXT,
    icon TEXT,
    category TEXT,
    is_premium BOOLEAN,
    dependencies TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        md.id,
        md.name,
        md.description,
        md.icon,
        md.category,
        md.is_premium,
        md.dependencies
    FROM module_definitions md
    WHERE p_hub_type = ANY(md.available_for_hub_types)
      AND md.is_deprecated = FALSE
    ORDER BY md.display_order;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a module can be enabled for a table
CREATE OR REPLACE FUNCTION can_enable_module(p_table_id UUID, p_module_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_hub_type TEXT;
    v_module_hub_types TEXT[];
    v_dependencies TEXT[];
    v_dep TEXT;
    v_enabled_count INTEGER;
BEGIN
    -- Get the table's hub type
    SELECT hub_type INTO v_hub_type
    FROM data_tables
    WHERE id = p_table_id;
    
    IF v_hub_type IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get the module's allowed hub types and dependencies
    SELECT available_for_hub_types, dependencies 
    INTO v_module_hub_types, v_dependencies
    FROM module_definitions
    WHERE id = p_module_id;
    
    IF v_module_hub_types IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if hub type is allowed
    IF NOT v_hub_type = ANY(v_module_hub_types) THEN
        RETURN FALSE;
    END IF;
    
    -- Check all dependencies are enabled
    FOREACH v_dep IN ARRAY v_dependencies
    LOOP
        SELECT COUNT(*) INTO v_enabled_count
        FROM hub_module_configs
        WHERE table_id = p_table_id
          AND module_id = v_dep
          AND is_enabled = TRUE;
        
        IF v_enabled_count = 0 THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-enable default modules when a hub is created
CREATE OR REPLACE FUNCTION auto_enable_default_modules()
RETURNS TRIGGER AS $$
BEGIN
    -- Enable 'tables' module by default for all new hubs
    INSERT INTO hub_module_configs (table_id, module_id, is_enabled, enabled_by)
    VALUES (NEW.id, 'tables', TRUE, NEW.created_by)
    ON CONFLICT DO NOTHING;
    
    -- Enable 'views' module by default
    INSERT INTO hub_module_configs (table_id, module_id, is_enabled, enabled_by)
    VALUES (NEW.id, 'views', TRUE, NEW.created_by)
    ON CONFLICT DO NOTHING;
    
    -- For activities hubs, auto-enable pulse
    IF NEW.hub_type = 'activities' THEN
        INSERT INTO hub_module_configs (table_id, module_id, is_enabled, enabled_by)
        VALUES (NEW.id, 'pulse', TRUE, NEW.created_by)
        ON CONFLICT DO NOTHING;
        
        INSERT INTO hub_module_configs (table_id, module_id, is_enabled, enabled_by)
        VALUES (NEW.id, 'attendance', TRUE, NEW.created_by)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- For applications hubs, auto-enable review workflow
    IF NEW.hub_type = 'applications' THEN
        INSERT INTO hub_module_configs (table_id, module_id, is_enabled, enabled_by)
        VALUES (NEW.id, 'forms', TRUE, NEW.created_by)
        ON CONFLICT DO NOTHING;
        
        INSERT INTO hub_module_configs (table_id, module_id, is_enabled, enabled_by)
        VALUES (NEW.id, 'review_workflow', TRUE, NEW.created_by)
        ON CONFLICT DO NOTHING;
        
        INSERT INTO hub_module_configs (table_id, module_id, is_enabled, enabled_by)
        VALUES (NEW.id, 'rubrics', TRUE, NEW.created_by)
        ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-enabling modules
DROP TRIGGER IF EXISTS auto_enable_modules_trigger ON data_tables;
CREATE TRIGGER auto_enable_modules_trigger
    AFTER INSERT ON data_tables
    FOR EACH ROW
    EXECUTE FUNCTION auto_enable_default_modules();

-- =====================================================
-- PHASE 7: TRIGGERS FOR TIMESTAMPS
-- =====================================================

CREATE TRIGGER update_module_definitions_updated_at 
    BEFORE UPDATE ON module_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hub_module_configs_updated_at 
    BEFORE UPDATE ON hub_module_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PHASE 8: REAL-TIME SUBSCRIPTIONS
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE hub_module_configs;

-- =====================================================
-- PHASE 9: MIGRATION HELPER - UPDATE EXISTING TABLES
-- =====================================================

-- Function to infer and set hub_type for existing tables
CREATE OR REPLACE FUNCTION migrate_existing_hub_types()
RETURNS void AS $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id, name, icon FROM data_tables WHERE hub_type = 'data' OR hub_type IS NULL
    LOOP
        -- Check if table has pulse enabled -> activities
        IF EXISTS (SELECT 1 FROM pulse_enabled_tables WHERE table_id = t.id AND enabled = TRUE) THEN
            UPDATE data_tables SET hub_type = 'activities' WHERE id = t.id;
        -- Check if table is a form (icon='form') with submissions -> applications
        ELSIF t.icon = 'form' THEN
            -- Forms that have rows are likely application forms
            IF EXISTS (SELECT 1 FROM table_rows WHERE table_id = t.id LIMIT 1) THEN
                UPDATE data_tables SET hub_type = 'applications' WHERE id = t.id;
            END IF;
        -- Check if table name suggests activities
        ELSIF LOWER(t.name) LIKE '%activit%' OR LOWER(t.name) LIKE '%event%' THEN
            UPDATE data_tables SET hub_type = 'activities' WHERE id = t.id;
        -- Check if table name suggests applications
        ELSIF LOWER(t.name) LIKE '%application%' OR LOWER(t.name) LIKE '%scholarship%' OR LOWER(t.name) LIKE '%grant%' THEN
            UPDATE data_tables SET hub_type = 'applications' WHERE id = t.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run migration (uncomment when ready)
-- SELECT migrate_existing_hub_types();

-- =====================================================
-- PHASE 10: COMMENTS
-- =====================================================

COMMENT ON TABLE module_definitions IS 'Central registry of all available modules and which hub types can use them';
COMMENT ON TABLE hub_module_configs IS 'Per-table (hub) module enablement and configuration';
COMMENT ON FUNCTION get_available_modules(TEXT) IS 'Returns all modules available for a given hub type';
COMMENT ON FUNCTION can_enable_module(UUID, TEXT) IS 'Checks if a module can be enabled for a table (validates hub type and dependencies)';
COMMENT ON FUNCTION auto_enable_default_modules() IS 'Automatically enables default modules when a new hub is created';
COMMENT ON FUNCTION migrate_existing_hub_types() IS 'Infers and sets hub_type for existing tables based on their usage patterns';

-- =====================================================
-- PHASE 11: RUN MIGRATION AND CLEANUP
-- =====================================================

-- Auto-detect and set hub_type for existing tables
SELECT migrate_existing_hub_types();

-- Summary of deleted tables:
-- ✓ module_instances - replaced by hub_module_configs
-- ✓ module_configs - replaced by hub_module_configs  
-- ✓ activities_hubs - migrated to data_tables with hub_type='activities'
-- ✓ activities_hub_tabs - dropped (tabs now stored in data_tables.settings)
-- ✓ request_hub_forms - legacy, unused
-- ✓ request_hub_tables - legacy, unused
-- ✓ request_templates - legacy, unused
-- ✓ forms - NOT USED (Go backend uses data_tables with icon='form')
-- ✓ form_fields - NOT USED (Go backend uses table_fields)
-- ✓ form_submissions - NOT USED (Go backend uses table_rows)
-- ✓ form_table_connections - NOT USED (forms ARE data_tables)

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- List all modules and their hub type availability
-- SELECT id, name, available_for_hub_types FROM module_definitions ORDER BY display_order;

-- List modules available for activities hubs
-- SELECT * FROM get_available_modules('activities');

-- List modules available for applications hubs  
-- SELECT * FROM get_available_modules('applications');

-- Check enabled modules for a specific table
-- SELECT md.id, md.name, hmc.is_enabled, hmc.settings
-- FROM module_definitions md
-- LEFT JOIN hub_module_configs hmc ON md.id = hmc.module_id AND hmc.table_id = 'YOUR_TABLE_ID'
-- WHERE 'YOUR_HUB_TYPE' = ANY(md.available_for_hub_types)
-- ORDER BY md.display_order;

-- Verify migration worked - show tables by hub type
-- SELECT hub_type, COUNT(*) as count, array_agg(name) as table_names
-- FROM data_tables
-- GROUP BY hub_type;

-- Show what tables were NOT dropped (these are still needed)
-- Remaining tables: organizations, organization_members, workspaces, workspace_members,
-- data_tables, table_fields, table_rows, table_views, table_links, table_row_links,
-- table_attachments, table_comments, active_sessions, activity_logs, scan_history,
-- pulse_enabled_tables, review_workflows, application_stages, reviewer_types, 
-- rubrics, stage_reviewer_configs, module_definitions, hub_module_configs
