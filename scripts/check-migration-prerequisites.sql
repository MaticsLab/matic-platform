-- Check Migration Prerequisites
-- Run this in Supabase SQL Editor to verify everything is ready

-- 1. Check if required tables exist
SELECT 
    'Required Tables' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_applicants') 
        THEN '✅ portal_applicants exists'
        ELSE '❌ portal_applicants MISSING'
    END as portal_applicants,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ba_users') 
        THEN '✅ ba_users exists'
        ELSE '❌ ba_users MISSING'
    END as ba_users,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ba_accounts') 
        THEN '✅ ba_accounts exists'
        ELSE '❌ ba_accounts MISSING'
    END as ba_accounts,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'table_rows') 
        THEN '✅ table_rows exists'
        ELSE '❌ table_rows MISSING'
    END as table_rows;

-- 2. Check portal_applicants data
SELECT 
    'Portal Applicants Data' as check_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT email) as unique_emails,
    COUNT(CASE WHEN password_hash IS NOT NULL AND password_hash != '' THEN 1 END) as with_passwords,
    COUNT(ba_user_id) as already_linked
FROM portal_applicants;

-- 3. Check if ba_users has user_type column
SELECT 
    'ba_users Schema' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'ba_users' AND column_name = 'user_type'
        )
        THEN '✅ user_type column exists'
        ELSE '❌ user_type column MISSING - run migration 040'
    END as user_type_column,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'ba_users' AND column_name = 'metadata'
        )
        THEN '✅ metadata column exists'
        ELSE '❌ metadata column MISSING - run migration 040'
    END as metadata_column;

-- 4. Check existing ba_users applicants
SELECT 
    'Existing ba_users (applicants)' as check_type,
    COUNT(*) as total_applicants,
    COUNT(CASE WHEN metadata->>'migrated_from_portal_applicants' = 'true' THEN 1 END) as already_migrated
FROM ba_users
WHERE user_type = 'applicant';

-- 5. Summary
SELECT 
    '=== READY TO MIGRATE? ===' as status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_applicants')
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ba_users')
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ba_accounts')
        AND EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'ba_users' AND column_name = 'user_type
        )
        THEN '✅ YES - All prerequisites met'
        ELSE '❌ NO - Missing prerequisites. Check errors above.'
    END as ready;
