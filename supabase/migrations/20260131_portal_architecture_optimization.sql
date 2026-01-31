-- Migration: Portal Architecture Optimization
-- Date: 2026-01-31
-- Purpose: Add indexes to support new portal architecture (single source of truth: table_rows)
-- Related: docs/PORTAL_APPLICATION_ARCHITECTURE_AUDIT.md

-- ==============================================
-- PERFORMANCE INDEXES FOR table_rows
-- ==============================================

-- Index 1: Standard email lookup (preferred location)
-- This index optimizes the most common query pattern for portal submissions
CREATE INDEX IF NOT EXISTS idx_table_rows_applicant_email 
ON table_rows ((data->>'_applicant_email'))
WHERE data ? '_applicant_email';

COMMENT ON INDEX idx_table_rows_applicant_email IS 
'Optimizes email lookup for portal submissions using standard _applicant_email field';

-- Index 2: Legacy email lookup (personal.personalEmail)
-- Supports existing submissions using old field structure
CREATE INDEX IF NOT EXISTS idx_table_rows_personal_email 
ON table_rows ((data->'personal'->>'personalEmail'))
WHERE data->'personal' ? 'personalEmail';

COMMENT ON INDEX idx_table_rows_personal_email IS 
'Supports legacy email lookup for submissions using personal.personalEmail field';

-- Index 3: Status filtering (from metadata)
-- Enables fast filtering by submission status (draft, submitted, etc.)
CREATE INDEX IF NOT EXISTS idx_table_rows_status 
ON table_rows ((metadata->>'status'))
WHERE metadata ? 'status';

COMMENT ON INDEX idx_table_rows_status IS 
'Enables fast filtering of submissions by status (draft, submitted, reviewing, etc.)';

-- Index 4: User submissions lookup
-- Optimizes queries for "get all submissions by user"
CREATE INDEX IF NOT EXISTS idx_table_rows_ba_created_by 
ON table_rows (ba_created_by, table_id)
WHERE ba_created_by IS NOT NULL;

COMMENT ON INDEX idx_table_rows_ba_created_by IS 
'Optimizes user submission queries (ListUserSubmissions endpoint)';

-- Index 5: Composite index for email + table lookup
-- Covers the most common query pattern: find submission by email for specific form
CREATE INDEX IF NOT EXISTS idx_table_rows_table_applicant_email 
ON table_rows (table_id, ((data->>'_applicant_email')))
WHERE data ? '_applicant_email';

COMMENT ON INDEX idx_table_rows_table_applicant_email IS 
'Composite index for fastest email lookup within specific form/table';

-- Index 6: Submitted date for reporting
CREATE INDEX IF NOT EXISTS idx_table_rows_submitted_at 
ON table_rows ((metadata->>'submitted_at'))
WHERE metadata ? 'submitted_at';

COMMENT ON INDEX idx_table_rows_submitted_at IS 
'Enables fast queries for submission date-based reports and analytics';

-- ==============================================
-- ANALYZE TABLES
-- ==============================================

-- Update table statistics for query planner
ANALYZE table_rows;
ANALYZE ba_users;
ANALYZE ba_sessions;

-- ==============================================
-- VERIFICATION QUERIES
-- ==============================================

-- Run these queries to verify indexes are being used:
-- 
-- 1. Check email lookup performance:
-- EXPLAIN ANALYZE
-- SELECT * FROM table_rows 
-- WHERE data->>'_applicant_email' = 'test@example.com'
-- AND table_id = 'your-uuid';
--
-- 2. Check user submissions performance:
-- EXPLAIN ANALYZE
-- SELECT * FROM table_rows 
-- WHERE ba_created_by = 'user-id'
-- ORDER BY created_at DESC;
--
-- 3. Check status filtering performance:
-- EXPLAIN ANALYZE
-- SELECT * FROM table_rows 
-- WHERE metadata->>'status' = 'submitted'
-- AND table_id = 'your-uuid';

-- ==============================================
-- INDEX SIZE MONITORING
-- ==============================================

-- Query to monitor index sizes and usage:
-- 
-- SELECT 
--     schemaname,
--     tablename,
--     indexname,
--     pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
--     idx_scan as times_used,
--     idx_tup_read as rows_read,
--     idx_tup_fetch as rows_fetched
-- FROM pg_stat_user_indexes
-- WHERE tablename = 'table_rows'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- ==============================================
-- ROLLBACK INSTRUCTIONS
-- ==============================================

-- If you need to rollback these indexes:
-- 
-- DROP INDEX IF EXISTS idx_table_rows_applicant_email;
-- DROP INDEX IF EXISTS idx_table_rows_personal_email;
-- DROP INDEX IF EXISTS idx_table_rows_status;
-- DROP INDEX IF EXISTS idx_table_rows_ba_created_by;
-- DROP INDEX IF EXISTS idx_table_rows_table_applicant_email;
-- DROP INDEX IF EXISTS idx_table_rows_submitted_at;
