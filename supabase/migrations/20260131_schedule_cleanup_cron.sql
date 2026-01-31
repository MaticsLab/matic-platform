-- Optional: Schedule automatic cleanup using pg_cron
-- Run this if you have pg_cron extension installed

-- Enable pg_cron extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup to run daily at 2 AM
SELECT cron.schedule(
    'cleanup-orphaned-accounts',
    '0 2 * * *',
    $$SELECT cleanup_orphaned_accounts();$$
);

-- View scheduled jobs
SELECT * FROM cron.job WHERE jobname = 'cleanup-orphaned-accounts';

-- Unschedule (if needed)
-- SELECT cron.unschedule('cleanup-orphaned-accounts');

-- Manual execution for testing
-- SELECT cleanup_orphaned_accounts();
