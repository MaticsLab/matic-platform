-- Migration: Remove workflow builder feature
-- Date: 2026-02-02
-- Description: Drop all workflow-related tables and foreign keys

-- Drop foreign keys first
ALTER TABLE IF EXISTS forms DROP CONSTRAINT IF EXISTS forms_workflow_id_fkey;
ALTER TABLE IF EXISTS application_stages DROP CONSTRAINT IF EXISTS application_stages_review_workflow_id_fkey;
ALTER TABLE IF EXISTS stage_reviewer_configs DROP CONSTRAINT IF EXISTS stage_reviewer_configs_stage_id_fkey;
ALTER TABLE IF EXISTS stage_groups DROP CONSTRAINT IF EXISTS stage_groups_stage_id_fkey;
ALTER TABLE IF EXISTS custom_statuses DROP CONSTRAINT IF EXISTS custom_statuses_stage_id_fkey;
ALTER TABLE IF EXISTS application_groups DROP CONSTRAINT IF EXISTS application_groups_review_workflow_id_fkey;
ALTER TABLE IF EXISTS automation_workflow_executions DROP CONSTRAINT IF EXISTS automation_workflow_executions_automation_workflow_id_fkey;
ALTER TABLE IF EXISTS automation_workflow_execution_logs DROP CONSTRAINT IF EXISTS automation_workflow_execution_logs_execution_id_fkey;

-- Drop workflow feature flag (if exists in workspace_features)
DELETE FROM workspace_features WHERE feature_name = 'review_workflow';

-- Drop workflow-related tables
DROP TABLE IF EXISTS automation_workflow_execution_logs CASCADE;
DROP TABLE IF EXISTS automation_workflow_executions CASCADE;
DROP TABLE IF EXISTS automation_workflows CASCADE;
DROP TABLE IF EXISTS workflow_webhook_configs CASCADE;
DROP TABLE IF EXISTS workflow_actions CASCADE;
DROP TABLE IF EXISTS custom_statuses CASCADE;
DROP TABLE IF EXISTS stage_groups CASCADE;
DROP TABLE IF EXISTS application_groups CASCADE;
DROP TABLE IF EXISTS stage_reviewer_configs CASCADE;
DROP TABLE IF EXISTS application_stages CASCADE;
DROP TABLE IF EXISTS reviewer_types CASCADE;
DROP TABLE IF EXISTS rubrics CASCADE;
DROP TABLE IF EXISTS review_workflows CASCADE;

-- Remove workflow_id column from forms table
ALTER TABLE IF EXISTS forms DROP COLUMN IF EXISTS workflow_id CASCADE;

-- Remove review_workflow_id from form_submissions if it exists
ALTER TABLE IF EXISTS form_submissions DROP COLUMN IF EXISTS review_workflow_id CASCADE;
ALTER TABLE IF EXISTS form_submissions DROP COLUMN IF EXISTS current_stage_id CASCADE;

-- Clean up any workflow-related indexes
DROP INDEX IF EXISTS idx_workflow_stages_workflow_order;
DROP INDEX IF EXISTS idx_application_stages_workflow_id;
DROP INDEX IF EXISTS idx_stage_groups_stage_id;
DROP INDEX IF EXISTS idx_application_groups_workflow_id;
DROP INDEX IF EXISTS idx_automation_workflows_workspace_id;
DROP INDEX IF EXISTS idx_workflow_webhook_configs_workspace_id;

-- Log completion
COMMENT ON TABLE forms IS 'Forms table - workflow_id column removed 2026-02-02';
