-- Performance Indexes for Matic Platform
-- Based on API Performance Audit & Optimization Report
-- Run with: psql $DATABASE_URL < scripts/add_performance_indexes.sql
-- Or via Supabase SQL Editor

BEGIN;

-- ============================================================================
-- CRITICAL INDEXES - Highest Impact on Performance
-- ============================================================================

-- Workspace Members: ba_user_id lookups (fixes N+1 query in ListWorkspaces)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_members_ba_user_id 
ON workspace_members(ba_user_id)
WHERE deleted_at IS NULL;

-- Workspace Members: Composite index for workspace + user queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_members_workspace_ba_user 
ON workspace_members(workspace_id, ba_user_id)
WHERE deleted_at IS NULL;

-- Better Auth Sessions: Token lookups (CRITICAL - used on every authenticated request)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ba_sessions_token 
ON ba_sessions(token)
WHERE expires_at > NOW();

-- Better Auth Sessions: User ID lookups (for listing user sessions)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ba_sessions_user_id 
ON ba_sessions(user_id, expires_at DESC)
WHERE expires_at > NOW();

-- Better Auth Members: Organization + User lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ba_members_org_user 
ON ba_members(organization_id, user_id);

-- Better Auth Invitations: Organization lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ba_invitations_org_id 
ON ba_invitations(organization_id, status);

-- Better Auth Invitations: Email lookups for pending invitations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ba_invitations_email_status 
ON ba_invitations(email, status)
WHERE status = 'pending';

-- ============================================================================
-- DATA TABLE INDEXES - Performance for table rows and searches
-- ============================================================================

-- Rows: table_id + created_at for pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rows_table_created 
ON rows(table_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Rows: JSONB search using GIN index (2-5s → 200ms for searches)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rows_data_gin 
ON rows USING GIN (data jsonb_path_ops)
WHERE deleted_at IS NULL;

-- Rows: table_id + updated_at for sorting by last modified
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rows_table_updated 
ON rows(table_id, updated_at DESC)
WHERE deleted_at IS NULL;

-- Fields: table_id lookups with order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fields_table_order 
ON fields(table_id, order_index)
WHERE deleted_at IS NULL;

-- Views: table_id lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_views_table_id 
ON views(table_id)
WHERE deleted_at IS NULL;

-- ============================================================================
-- SUBMISSIONS & FORMS - Portal performance
-- ============================================================================

-- Submissions: user_id + updated_at (fixes N+1 in portal)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_user_updated 
ON submissions(user_id, updated_at DESC)
WHERE deleted_at IS NULL;

-- Submissions: form_id lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_form_id 
ON submissions(form_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Submissions: status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_status 
ON submissions(status, updated_at DESC)
WHERE deleted_at IS NULL;

-- Form Fields: form_id with order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_fields_form_order 
ON form_fields(form_id, order_index)
WHERE deleted_at IS NULL;

-- ============================================================================
-- FILES & ATTACHMENTS
-- ============================================================================

-- Files: row_id lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_row_id 
ON files(row_id)
WHERE deleted_at IS NULL;

-- Files: form_submission_id lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_form_submission 
ON files(form_submission_id)
WHERE deleted_at IS NULL;

-- ============================================================================
-- ACTIVITIES & AUDIT TRAIL
-- ============================================================================

-- Activities: row_id + visibility + created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_row_visibility 
ON activities(row_id, visibility, created_at DESC)
WHERE deleted_at IS NULL;

-- Activities: user_id for user activity history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_id 
ON activities(user_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Activities: workspace_id for workspace activity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_workspace 
ON activities(workspace_id, created_at DESC)
WHERE deleted_at IS NULL;

-- ============================================================================
-- WORKSPACES & ORGANIZATIONS
-- ============================================================================

-- Workspaces: organization_id lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_org_id 
ON workspaces(organization_id)
WHERE deleted_at IS NULL;

-- Activities Hubs: workspace_id lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_hubs_workspace 
ON activities_hubs(workspace_id)
WHERE deleted_at IS NULL;

-- ============================================================================
-- WORKFLOWS & STAGES
-- ============================================================================

-- Workflow Stages: workflow_id with order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_stages_workflow_order 
ON workflow_stages(workflow_id, order_index)
WHERE deleted_at IS NULL;

-- Stage Reviewers: stage_id lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stage_reviewers_stage_id 
ON stage_reviewers(stage_id)
WHERE deleted_at IS NULL;

-- Reviews: submission_id + stage_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_submission_stage 
ON reviews(submission_id, stage_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Reviews: reviewer_id for reviewer's tasks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_reviewer_status 
ON reviews(reviewer_id, status, created_at DESC)
WHERE deleted_at IS NULL;

-- ============================================================================
-- SEARCH & RECOMMENDATIONS
-- ============================================================================

-- Search History: user_id + created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_history_user 
ON search_history(user_id, created_at DESC);

-- Recommendations: submission_id lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_submission 
ON recommendation_requests(submission_id, status);

-- Recommendations: recommender_email for checking existing requests
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_email_status 
ON recommendation_requests(recommender_email, status);

COMMIT;

-- ============================================================================
-- ANALYZE TABLES - Update statistics for query planner
-- ============================================================================

ANALYZE workspace_members;
ANALYZE ba_sessions;
ANALYZE ba_members;
ANALYZE ba_invitations;
ANALYZE rows;
ANALYZE submissions;
ANALYZE files;
ANALYZE activities;
ANALYZE workspaces;
ANALYZE workflow_stages;
ANALYZE reviews;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check index sizes
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 20;
