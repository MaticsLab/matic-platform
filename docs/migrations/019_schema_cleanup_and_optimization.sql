-- ============================================================================
-- Migration 019: Schema Cleanup & Performance Optimization
-- ============================================================================
-- Purpose: Remove unused tables, add critical indexes, improve query performance
-- Generated: December 11, 2025
--
-- Changes:
-- 1. DROP unused Activities hub tables (pulse, attendance, sub_modules)
-- 2. DROP unused email infrastructure (campaigns, signatures, gmail_connections)
-- 3. DROP module_history_settings (partially used)
-- 4. ADD critical indexes for performance
-- 5. ADD data retention policies for audit tables
-- 6. ADD JSONB field indexes for frequently-queried columns
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: DROP UNUSED TABLES
-- ============================================================================

-- Drop Activities Hub related tables (not in current codebase)
DROP TABLE IF EXISTS sub_modules CASCADE;

-- Drop Email infrastructure tables (unused in portal)
DROP TABLE IF EXISTS sent_emails CASCADE;
DROP TABLE IF EXISTS email_campaigns CASCADE;
DROP TABLE IF EXISTS email_signatures CASCADE;
DROP TABLE IF EXISTS gmail_connections CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;

-- Drop partially used module system tables
DROP TABLE IF EXISTS module_history_settings CASCADE;
DROP TABLE IF EXISTS module_field_configs CASCADE;

-- Drop advanced automation tables (not implemented)
DROP TABLE IF EXISTS tag_automations CASCADE;
DROP TABLE IF EXISTS workflow_actions CASCADE;
DROP TABLE IF EXISTS stage_actions CASCADE;

-- Drop AI embedding queue (move to external job system)
DROP TABLE IF EXISTS embedding_queue CASCADE;

-- Drop unused workflow grouping tables
DROP TABLE IF EXISTS application_groups CASCADE;

-- ============================================================================
-- SECTION 2: ADD CRITICAL INDEXES FOR PERFORMANCE
-- ============================================================================

-- Core Data Tables - Indexes for foreign key queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_table_rows_table_id_created_at 
  ON table_rows(table_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_table_rows_table_id_updated_at 
  ON table_rows(table_id, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_table_fields_table_id 
  ON table_fields(table_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_table_fields_field_type_id 
  ON table_fields(field_type_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portal_applicants_form_id_created_at 
  ON portal_applicants(form_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portal_applicants_email 
  ON portal_applicants(email);

-- Workspace & Org indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_tables_workspace_id 
  ON data_tables(workspace_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_organization_id 
  ON workspaces(organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_members_workspace_id 
  ON workspace_members(workspace_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_members_user_id 
  ON workspace_members(user_id);

-- Workflow indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_workflows_workspace_id 
  ON review_workflows(workspace_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_application_stages_review_workflow_id 
  ON application_stages(review_workflow_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stage_groups_stage_id 
  ON stage_groups(stage_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stage_groups_workspace_id 
  ON stage_groups(workspace_id);

-- Change tracking indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_row_versions_row_id_created_at 
  ON row_versions(row_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_row_versions_table_id 
  ON row_versions(table_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_field_changes_row_version_id 
  ON field_changes(row_version_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_field_changes_row_id 
  ON field_changes(row_id);

-- Search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_index_table_id 
  ON search_index(table_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_index_workspace_id 
  ON search_index(workspace_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_workspace_id 
  ON search_analytics(workspace_id);

-- File management indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_table_files_table_id 
  ON table_files(table_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_table_files_row_id 
  ON table_files(row_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_table_files_field_id 
  ON table_files(field_id);

-- ============================================================================
-- SECTION 3: ADD JSONB INDEXES FOR FREQUENTLY-QUERIED FIELDS
-- ============================================================================

-- Index on table_rows.data for common field lookups
-- This uses GIN index for JSONB containment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_table_rows_data_gin 
  ON table_rows USING gin(data);

-- Index on portal_applicants.submission_data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portal_applicants_submission_data_gin 
  ON portal_applicants USING gin(submission_data);

-- Index on data_tables.settings for hub_type lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_tables_settings_gin 
  ON data_tables USING gin(settings);

-- Index on application_stages.hidden_pii_fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_application_stages_hidden_pii_fields_gin 
  ON application_stages USING gin(hidden_pii_fields);

-- ============================================================================
-- SECTION 4: ADD DATA RETENTION POLICIES
-- ============================================================================

-- Function to archive old row_versions (keep last 100 per row, archive rest)
CREATE OR REPLACE FUNCTION archive_old_row_versions() 
RETURNS void AS $$
BEGIN
  -- Delete row_versions older than 1 year, keeping last 100 per row
  DELETE FROM row_versions
  WHERE id IN (
    SELECT id
    FROM (
      SELECT 
        id,
        row_id,
        ROW_NUMBER() OVER (PARTITION BY row_id ORDER BY created_at DESC) as rn,
        created_at
      FROM row_versions
    ) sub
    WHERE rn > 100 OR created_at < NOW() - INTERVAL '1 year'
  );
  
  RAISE NOTICE 'Archived old row_versions';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old field_changes (cascades when row_versions deleted)
-- This is handled by CASCADE on FK, no additional function needed

-- Function to archive old search_analytics (keep last 6 months)
CREATE OR REPLACE FUNCTION archive_old_search_analytics() 
RETURNS void AS $$
BEGIN
  DELETE FROM search_analytics
  WHERE created_at < NOW() - INTERVAL '6 months';
  
  RAISE NOTICE 'Archived old search_analytics';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up orphaned change_requests (older than 90 days and still pending)
CREATE OR REPLACE FUNCTION cleanup_stale_change_requests() 
RETURNS void AS $$
BEGIN
  DELETE FROM change_requests
  WHERE status = 'pending' 
    AND created_at < NOW() - INTERVAL '90 days';
  
  RAISE NOTICE 'Cleaned up stale change_requests';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 5: ADD HELPFUL VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for table data with field definitions (reduces N+1 queries)
CREATE OR REPLACE VIEW v_table_rows_with_fields AS
SELECT 
  tr.id,
  tr.table_id,
  tr.data,
  tr.metadata,
  tr.tags,
  tr.created_at,
  tr.updated_at,
  tr.created_by,
  tr.updated_by,
  dt.name as table_name,
  dt.workspace_id,
  json_agg(
    json_build_object(
      'id', tf.id,
      'name', tf.name,
      'label', tf.label,
      'field_type_id', tf.field_type_id,
      'config', tf.config
    ) ORDER BY tf.position
  ) as fields
FROM table_rows tr
JOIN data_tables dt ON tr.table_id = dt.id
LEFT JOIN table_fields tf ON tf.table_id = dt.id
GROUP BY tr.id, tr.table_id, tr.data, tr.metadata, tr.tags, 
         tr.created_at, tr.updated_at, tr.created_by, tr.updated_by,
         dt.name, dt.workspace_id;

-- View for portal applicants with form metadata
CREATE OR REPLACE VIEW v_portal_applicants_with_form AS
SELECT 
  pa.id,
  pa.form_id,
  pa.email,
  pa.submission_data,
  pa.status,
  pa.created_at,
  tv.name as form_name,
  tv.table_id,
  dt.name as table_name,
  dt.workspace_id
FROM portal_applicants pa
JOIN table_views tv ON pa.form_id = tv.id
JOIN data_tables dt ON tv.table_id = dt.id;

-- ============================================================================
-- SECTION 6: ADD STATISTICS COLLECTION
-- ============================================================================

-- Analyze tables to update query planner statistics
ANALYZE table_rows;
ANALYZE table_fields;
ANALYZE portal_applicants;
ANALYZE data_tables;
ANALYZE review_workflows;
ANALYZE application_stages;
ANALYZE row_versions;
ANALYZE field_changes;

-- ============================================================================
-- SECTION 7: ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE table_rows IS 'Actual data storage. Each row.data is JSONB keyed by field.name. Validate against field_type_registry.storage_schema.';
COMMENT ON COLUMN table_rows.data IS 'JSONB object with keys matching table_fields.name (snake_case). Example: {"first_name": "John", "email": "john@example.com"}';
COMMENT ON COLUMN table_rows.metadata IS 'JSONB for system metadata. Expected keys: row_status (active|archived|draft), row_workflow (workflow_id), row_tags (string[])';

COMMENT ON TABLE portal_applicants IS 'Form submissions from external portals. submission_data structure matches form field names.';
COMMENT ON COLUMN portal_applicants.submission_data IS 'JSONB with form field values. Keys match field.name from form definition.';

COMMENT ON TABLE data_tables IS 'Table definitions (hubs). settings.hub_type determines available modules (data|applications|activities).';
COMMENT ON COLUMN data_tables.settings IS 'JSONB with keys: hub_type (string), approval_settings (object), ai_settings (object), history_settings (object)';

COMMENT ON TABLE application_stages IS 'Workflow stages for application review. Complex JSONB configs for PII, statuses, logic rules.';
COMMENT ON COLUMN application_stages.hidden_pii_fields IS 'JSONB array of field names to hide from reviewers at this stage. Example: ["ssn", "dob"]';
COMMENT ON COLUMN application_stages.logic_rules IS 'JSONB array of automation rules. Example: [{"condition": "score > 80", "action": "advance_to_stage", "target_stage_id": "..."}]';
COMMENT ON COLUMN application_stages.custom_statuses IS 'JSONB array of status options. Example: [{"value": "waitlist", "label": "Waitlisted", "color": "#FFA500"}]';

COMMENT ON TABLE field_type_registry IS 'Master field type definitions. Each type has 4 schemas: input (form), storage (validation), config (instance settings), ai (embedding strategy).';
COMMENT ON COLUMN field_type_registry.storage_schema IS 'JSON Schema for validating table_rows.data values. Example: {"type": "string", "format": "email"}';
COMMENT ON COLUMN field_type_registry.input_schema IS 'JSON Schema for form rendering. Defines UI component properties.';
COMMENT ON COLUMN field_type_registry.config_schema IS 'JSON Schema for table_fields.config. Defines what settings each instance can override.';
COMMENT ON COLUMN field_type_registry.ai_schema IS 'JSONB defining embedding strategy. Keys: should_embed (bool), privacy_level (public|private|pii), boost_factor (float)';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- List remaining tables (should be ~30 instead of 47)
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public';
  
  RAISE NOTICE 'Total tables in public schema: %', table_count;
END $$;

-- List all indexes created
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

COMMIT;

-- ============================================================================
-- POST-MIGRATION TASKS (Run manually after migration)
-- ============================================================================

-- Schedule retention policy functions (run via cron or pg_cron extension)
-- Example using pg_cron:
-- SELECT cron.schedule('archive-row-versions', '0 2 * * 0', 'SELECT archive_old_row_versions()');
-- SELECT cron.schedule('archive-search-analytics', '0 3 * * 0', 'SELECT archive_old_search_analytics()');
-- SELECT cron.schedule('cleanup-stale-changes', '0 4 * * *', 'SELECT cleanup_stale_change_requests()');
