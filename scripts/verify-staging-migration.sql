-- Verification Queries for Staging Migration
-- Run these after executing 041_migrate_portal_applicants_to_ba_users.sql

-- ============================================
-- 1. COUNT VERIFICATION
-- ============================================

-- Count portal applicants
SELECT 
    'portal_applicants' as table_name,
    COUNT(*) as total_count,
    COUNT(DISTINCT email) as unique_emails,
    COUNT(ba_user_id) as linked_count,
    COUNT(*) - COUNT(ba_user_id) as unlinked_count
FROM portal_applicants;

-- Count migrated ba_users
SELECT 
    'ba_users (applicants)' as table_name,
    COUNT(*) as total_applicants,
    COUNT(CASE WHEN metadata->>'migrated_from_portal_applicants' = 'true' THEN 1 END) as migrated_count
FROM ba_users
WHERE user_type = 'applicant';

-- Count ba_accounts for applicants
SELECT 
    'ba_accounts (credential)' as table_name,
    COUNT(*) as total_accounts
FROM ba_accounts
WHERE provider_id = 'credential'
AND user_id IN (
    SELECT id FROM ba_users WHERE user_type = 'applicant'
);

-- ============================================
-- 2. DATA INTEGRITY CHECKS
-- ============================================

-- Check for emails in portal_applicants without ba_user
SELECT 
    'Unmigrated emails' as check_type,
    COUNT(DISTINCT email) as count
FROM portal_applicants
WHERE ba_user_id IS NULL;

-- Check for ba_users without accounts
SELECT 
    'Users without accounts' as check_type,
    COUNT(*) as count
FROM ba_users bu
WHERE bu.user_type = 'applicant'
AND bu.metadata->>'migrated_from_portal_applicants' = 'true'
AND NOT EXISTS (
    SELECT 1 FROM ba_accounts ba 
    WHERE ba.user_id = bu.id AND ba.provider_id = 'credential'
);

-- Check for duplicate emails in ba_users (should be 0)
SELECT 
    'Duplicate emails in ba_users' as check_type,
    COUNT(*) as count
FROM (
    SELECT email, COUNT(*) as cnt
    FROM ba_users
    WHERE user_type = 'applicant'
    GROUP BY email
    HAVING COUNT(*) > 1
) duplicates;

-- ============================================
-- 3. SAMPLE DATA VERIFICATION
-- ============================================

-- Show sample migrated user
SELECT 
    bu.id,
    bu.email,
    bu.name,
    bu.full_name,
    bu.user_type,
    bu.metadata->>'migrated_from_portal_applicants' as migrated,
    bu.metadata->'form_ids' as form_ids,
    ba.id as account_id,
    ba.provider_id,
    CASE WHEN ba.password IS NOT NULL THEN 'Has password' ELSE 'No password' END as password_status
FROM ba_users bu
LEFT JOIN ba_accounts ba ON ba.user_id = bu.id AND ba.provider_id = 'credential'
WHERE bu.user_type = 'applicant'
AND bu.metadata->>'migrated_from_portal_applicants' = 'true'
LIMIT 5;

-- Show sample portal_applicant with link
SELECT 
    pa.id as portal_applicant_id,
    pa.email,
    pa.full_name,
    pa.form_id,
    pa.ba_user_id,
    bu.email as ba_user_email,
    bu.user_type
FROM portal_applicants pa
LEFT JOIN ba_users bu ON bu.id = pa.ba_user_id
LIMIT 10;

-- ============================================
-- 4. TABLE ROWS REFERENCES
-- ============================================

-- Count table_rows updated with ba_created_by
SELECT 
    'table_rows with ba_created_by (applicants)' as check_type,
    COUNT(*) as count
FROM table_rows tr
WHERE tr.ba_created_by IN (
    SELECT id FROM ba_users WHERE user_type = 'applicant'
);

-- Count table_rows linked via portal_applicants.row_id
SELECT 
    'table_rows linked via portal_applicants' as check_type,
    COUNT(*) as count
FROM table_rows tr
WHERE tr.id IN (
    SELECT row_id FROM portal_applicants WHERE row_id IS NOT NULL
);

-- ============================================
-- 5. METADATA VERIFICATION
-- ============================================

-- Check metadata structure
SELECT 
    bu.email,
    bu.metadata->>'migrated_from_portal_applicants' as is_migrated,
    jsonb_array_length(bu.metadata->'form_ids') as form_count,
    jsonb_array_length(bu.metadata->'portal_applicant_ids') as applicant_entry_count
FROM ba_users bu
WHERE bu.user_type = 'applicant'
AND bu.metadata->>'migrated_from_portal_applicants' = 'true'
LIMIT 5;

-- ============================================
-- 6. SUMMARY REPORT
-- ============================================

SELECT 
    '=== MIGRATION SUMMARY ===' as report;

SELECT 
    'Portal Applicants' as metric,
    COUNT(*)::text as value
FROM portal_applicants
UNION ALL
SELECT 
    'Unique Emails',
    COUNT(DISTINCT email)::text
FROM portal_applicants
UNION ALL
SELECT 
    'Migrated to ba_users',
    COUNT(DISTINCT ba_user_id)::text
FROM portal_applicants
WHERE ba_user_id IS NOT NULL
UNION ALL
SELECT 
    'ba_users (applicants)',
    COUNT(*)::text
FROM ba_users
WHERE user_type = 'applicant'
UNION ALL
SELECT 
    'ba_accounts (credential)',
    COUNT(*)::text
FROM ba_accounts
WHERE provider_id = 'credential'
AND user_id IN (SELECT id FROM ba_users WHERE user_type = 'applicant')
UNION ALL
SELECT 
    'table_rows with ba_created_by',
    COUNT(*)::text
FROM table_rows
WHERE ba_created_by IN (SELECT id FROM ba_users WHERE user_type = 'applicant');
