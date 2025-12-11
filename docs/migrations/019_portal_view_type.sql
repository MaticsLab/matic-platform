-- Migration: Add portal view type to table_views
-- This migration adds support for portals as a view type rather than storing
-- portal configuration in data_tables.settings

-- Add 'portal' to the view_type enum if it doesn't exist
-- Note: PostgreSQL doesn't have IF NOT EXISTS for enum values, so we handle this safely

DO $$
BEGIN
    -- Check if view_type is an enum
    IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'view_type'
    ) THEN
        -- Add 'portal' value if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'portal' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'view_type')
        ) THEN
            ALTER TYPE view_type ADD VALUE 'portal';
        END IF;
    END IF;
END $$;

-- Add config column to table_views if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'table_views' AND column_name = 'config'
    ) THEN
        ALTER TABLE table_views ADD COLUMN config JSONB DEFAULT '{}';
    END IF;
END $$;

-- Create a function to migrate portal settings from data_tables to table_views
CREATE OR REPLACE FUNCTION migrate_portal_to_view(p_table_id UUID)
RETURNS UUID AS $$
DECLARE
    v_settings JSONB;
    v_view_id UUID;
    v_table_name TEXT;
    v_created_by UUID;
BEGIN
    -- Get the table settings
    SELECT settings, name, created_by 
    INTO v_settings, v_table_name, v_created_by
    FROM data_tables 
    WHERE id = p_table_id;
    
    -- Check if there are portal sections to migrate
    IF v_settings IS NOT NULL AND v_settings ? 'sections' THEN
        -- Check if a portal view already exists for this table
        SELECT id INTO v_view_id
        FROM table_views
        WHERE table_id = p_table_id AND type = 'portal'
        LIMIT 1;
        
        IF v_view_id IS NULL THEN
            -- Create a new portal view
            INSERT INTO table_views (
                table_id,
                name,
                type,
                config,
                settings,
                is_shared,
                is_locked,
                created_by
            ) VALUES (
                p_table_id,
                COALESCE(v_table_name, 'Application Portal') || ' Portal',
                'portal',
                jsonb_build_object(
                    'sections', v_settings->'sections',
                    'translations', COALESCE(v_settings->'translations', '{}'),
                    'theme', COALESCE(v_settings->'theme', '{}'),
                    'submission_settings', COALESCE(v_settings->'submission_settings', '{}')
                ),
                jsonb_build_object(
                    'is_public', COALESCE((v_settings->>'is_public')::boolean, true),
                    'requires_auth', COALESCE((v_settings->>'requires_auth')::boolean, false)
                ),
                true, -- is_shared (portals are typically public)
                false,
                v_created_by
            )
            RETURNING id INTO v_view_id;
            
            RAISE NOTICE 'Created portal view % for table %', v_view_id, p_table_id;
        ELSE
            -- Update existing portal view
            UPDATE table_views
            SET config = jsonb_build_object(
                'sections', v_settings->'sections',
                'translations', COALESCE(v_settings->'translations', '{}'),
                'theme', COALESCE(v_settings->'theme', '{}'),
                'submission_settings', COALESCE(v_settings->'submission_settings', '{}')
            )
            WHERE id = v_view_id;
            
            RAISE NOTICE 'Updated portal view % for table %', v_view_id, p_table_id;
        END IF;
        
        RETURN v_view_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Migrate all existing portal settings from data_tables
-- Only for tables with icon='form' (application forms/portals)
DO $$
DECLARE
    r RECORD;
    migrated_count INT := 0;
BEGIN
    FOR r IN 
        SELECT id, name, settings
        FROM data_tables
        WHERE icon = 'form' 
        AND settings IS NOT NULL 
        AND settings ? 'sections'
    LOOP
        PERFORM migrate_portal_to_view(r.id);
        migrated_count := migrated_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Migrated % portal configurations to table_views', migrated_count;
END $$;

-- Add an index for portal views
CREATE INDEX IF NOT EXISTS idx_table_views_type ON table_views(type);
CREATE INDEX IF NOT EXISTS idx_table_views_table_type ON table_views(table_id, type);

-- Add a comment explaining the migration
COMMENT ON COLUMN table_views.config IS 
'View-specific configuration. For portal views, contains sections, translations, theme, and submission_settings.';

-- Note: The original settings in data_tables are NOT removed by this migration.
-- They should be cleaned up in a future migration after verifying the portal views work correctly.
-- To clean up later, run:
-- UPDATE data_tables SET settings = settings - 'sections' - 'translations' - 'theme' - 'submission_settings' WHERE icon = 'form';
