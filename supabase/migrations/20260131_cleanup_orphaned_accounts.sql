-- Migration: Cleanup Orphaned Accounts
-- Date: 2026-01-31
-- Purpose: Delete orphaned ba_users accounts that have no credentials and no data
-- This happens when signup process is abandoned after user creation but before password setup

-- ==============================================
-- DELETE ORPHANED ACCOUNTS
-- ==============================================

-- Delete users who:
-- 1. Have NO password/credentials in ba_accounts
-- 2. Have NO submissions in table_rows
-- 3. Were created more than 24 hours ago (grace period)
DELETE FROM ba_users
WHERE id IN (
    SELECT u.id
    FROM ba_users u
    LEFT JOIN ba_accounts a ON u.id = a.user_id
    LEFT JOIN table_rows tr ON tr.ba_created_by = u.id
    WHERE u.user_type = 'applicant'
      AND a.id IS NULL  -- No credentials
      AND tr.id IS NULL  -- No submissions
      AND u.created_at < NOW() - INTERVAL '24 hours'  -- Older than 24 hours
);

-- ==============================================
-- CREATE CLEANUP FUNCTION
-- ==============================================

-- Function to automatically cleanup orphaned accounts
CREATE OR REPLACE FUNCTION cleanup_orphaned_accounts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete orphaned accounts (no password, no data, older than 24 hours)
    DELETE FROM ba_users
    WHERE id IN (
        SELECT u.id
        FROM ba_users u
        LEFT JOIN ba_accounts a ON u.id = a.user_id
        LEFT JOIN table_rows tr ON tr.ba_created_by = u.id
        WHERE u.user_type = 'applicant'
          AND a.id IS NULL  -- No credentials
          AND tr.id IS NULL  -- No submissions
          AND u.created_at < NOW() - INTERVAL '24 hours'
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    RAISE NOTICE 'Cleaned up % orphaned accounts', deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_orphaned_accounts() IS 
'Removes orphaned applicant accounts that have no credentials and no data after 24 hours';

-- ==============================================
-- OPTIONAL: SCHEDULED CLEANUP (Uncomment if using pg_cron)
-- ==============================================

-- To enable automatic daily cleanup, install pg_cron extension and uncomment:
-- 
-- SELECT cron.schedule(
--     'cleanup-orphaned-accounts',
--     '0 2 * * *',  -- Run at 2 AM daily
--     $$SELECT cleanup_orphaned_accounts();$$
-- );

-- Manual execution: SELECT cleanup_orphaned_accounts();
