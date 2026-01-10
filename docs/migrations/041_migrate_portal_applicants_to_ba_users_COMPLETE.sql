-- ============================================
-- COMPLETE MIGRATION SCRIPT WITH VERIFICATION
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: PREREQUISITE CHECKS
-- ============================================

DO $$
BEGIN
    -- Check if required tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_applicants') THEN
        RAISE EXCEPTION '❌ portal_applicants table does not exist. Run migration 017_portal_applicants.sql first.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ba_users') THEN
        RAISE EXCEPTION '❌ ba_users table does not exist. Run migration 029_better_auth.sql first.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ba_accounts') THEN
        RAISE EXCEPTION '❌ ba_accounts table does not exist. Run migration 029_better_auth.sql first.';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ba_users' AND column_name = 'user_type'
    ) THEN
        RAISE EXCEPTION '❌ user_type column missing from ba_users. Run migration 040_unified_auth_submissions.sql first.';
    END IF;
    
    RAISE NOTICE '✅ All prerequisites met';
END $$;

-- Show pre-migration state
SELECT 
    '📊 PRE-MIGRATION STATE' as report,
    (SELECT COUNT(*) FROM portal_applicants) as total_applicants,
    (SELECT COUNT(DISTINCT email) FROM portal_applicants) as unique_emails,
    (SELECT COUNT(*) FROM portal_applicants WHERE ba_user_id IS NOT NULL) as already_linked,
    (SELECT COUNT(*) FROM ba_users WHERE user_type = 'applicant') as existing_ba_applicants;

-- ============================================
-- PART 2: MIGRATION
-- ============================================

-- STEP 1: Add migration tracking column
ALTER TABLE portal_applicants 
ADD COLUMN IF NOT EXISTS ba_user_id TEXT REFERENCES ba_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_portal_applicants_ba_user_id ON portal_applicants(ba_user_id);

-- STEP 2: Migrate unique emails to ba_users
INSERT INTO ba_users (
    id,
    email,
    name,
    full_name,
    email_verified,
    user_type,
    metadata,
    created_at,
    updated_at
)
SELECT DISTINCT ON (email)
    gen_random_uuid()::TEXT as id,
    email,
    COALESCE(full_name, email) as name,
    full_name,
    FALSE as email_verified,
    'applicant' as user_type,
    jsonb_build_object(
        'migrated_from_portal_applicants', true,
        'portal_applicant_ids', (
            SELECT jsonb_agg(id::text ORDER BY created_at)
            FROM portal_applicants pa2
            WHERE pa2.email = pa.email
        ),
        'form_ids', (
            SELECT jsonb_agg(form_id::text ORDER BY created_at)
            FROM portal_applicants pa3
            WHERE pa3.email = pa.email
        ),
        'first_form_id', form_id::text,
        'last_login_at', last_login_at
    ) as metadata,
    MIN(created_at) OVER (PARTITION BY email) as created_at,
    MAX(updated_at) OVER (PARTITION BY email) as updated_at
FROM portal_applicants pa
WHERE NOT EXISTS (
    SELECT 1 FROM ba_users bu WHERE bu.email = pa.email
)
ORDER BY email, created_at DESC
ON CONFLICT (email) DO NOTHING;

-- STEP 3: Link portal_applicants to ba_users
UPDATE portal_applicants pa
SET ba_user_id = bu.id
FROM ba_users bu
WHERE bu.email = pa.email
AND pa.ba_user_id IS NULL;

-- STEP 4: Create ba_accounts for password auth
INSERT INTO ba_accounts (
    id,
    account_id,
    provider_id,
    user_id,
    password,
    created_at,
    updated_at
)
SELECT DISTINCT ON (pa.email)
    gen_random_uuid()::TEXT as id,
    pa.email as account_id,
    'credential' as provider_id,
    bu.id as user_id,
    pa.password_hash as password,
    MIN(pa.created_at) OVER (PARTITION BY pa.email) as created_at,
    MAX(pa.updated_at) OVER (PARTITION BY pa.email) as updated_at
FROM portal_applicants pa
INNER JOIN ba_users bu ON bu.email = pa.email
WHERE pa.password_hash IS NOT NULL
AND pa.password_hash != ''
AND NOT EXISTS (
    SELECT 1 FROM ba_accounts ba 
    WHERE ba.user_id = bu.id AND ba.provider_id = 'credential'
)
ORDER BY pa.email, pa.created_at DESC
ON CONFLICT DO NOTHING;

-- STEP 5: Update table_rows references
UPDATE table_rows tr
SET ba_created_by = pa.ba_user_id
FROM portal_applicants pa
WHERE tr.id = pa.row_id
AND pa.ba_user_id IS NOT NULL
AND tr.ba_created_by IS NULL;

UPDATE table_rows tr
SET ba_updated_by = pa.ba_user_id
FROM portal_applicants pa
WHERE tr.id = pa.row_id
AND pa.ba_user_id IS NOT NULL
AND tr.ba_updated_by IS NULL;

-- STEP 6: Update metadata with form relationships
UPDATE ba_users bu
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{portal_applicant_forms}',
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'form_id', pa.form_id::text,
                'portal_applicant_id', pa.id::text,
                'row_id', pa.row_id::text,
                'submission_data', pa.submission_data,
                'created_at', pa.created_at,
                'last_login_at', pa.last_login_at
            )
            ORDER BY pa.created_at
        )
        FROM portal_applicants pa
        WHERE pa.email = bu.email
    )
)
WHERE EXISTS (
    SELECT 1 FROM portal_applicants pa WHERE pa.email = bu.email
);

-- Add comments
COMMENT ON COLUMN portal_applicants.ba_user_id IS 'Links to ba_users.id after migration. Portal applicants are now managed through Better Auth.';
COMMENT ON COLUMN ba_users.metadata IS 'JSONB metadata. For migrated portal applicants, contains: migrated_from_portal_applicants, portal_applicant_ids, form_ids, portal_applicant_forms';

-- ============================================
-- PART 3: VERIFICATION
-- ============================================

SELECT '=== MIGRATION COMPLETE ===' as report;

-- Summary
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
    'Linked to ba_users',
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
    'table_rows updated',
    COUNT(*)::text
FROM table_rows
WHERE ba_created_by IN (SELECT id FROM ba_users WHERE user_type = 'applicant');

-- Sample migrated users
SELECT 
    '=== SAMPLE MIGRATED USERS ===' as report;

SELECT 
    bu.email,
    bu.name,
    bu.user_type,
    jsonb_array_length(bu.metadata->'form_ids') as form_count,
    CASE WHEN ba.password IS NOT NULL THEN 'Yes' ELSE 'No' END as has_password
FROM ba_users bu
LEFT JOIN ba_accounts ba ON ba.user_id = bu.id AND ba.provider_id = 'credential'
WHERE bu.user_type = 'applicant'
AND bu.metadata->>'migrated_from_portal_applicants' = 'true'
LIMIT 5;

-- Check for any unmigrated records
SELECT 
    '=== UNMIGRATED CHECK ===' as report,
    COUNT(*) as unmigrated_count
FROM portal_applicants
WHERE ba_user_id IS NULL;

SELECT '✅ Migration verification complete!' as status;
