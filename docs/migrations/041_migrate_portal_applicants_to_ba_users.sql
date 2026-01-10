-- Migration: Migrate portal_applicants to ba_users
-- Date: 2026-01-10
-- Purpose: Consolidate portal applicants into Better Auth system
-- 
-- This migration:
-- 1. Creates ba_users entries for each unique email in portal_applicants
-- 2. Creates ba_accounts entries with password hashes
-- 3. Stores form relationships in ba_users.metadata
-- 4. Updates table_rows.ba_created_by/ba_updated_by references
-- 5. Preserves all portal_applicants data for backward compatibility

-- ============================================
-- STEP 1: PREPARATION - Add migration tracking columns
-- ============================================

-- Add column to track migration status
ALTER TABLE portal_applicants 
ADD COLUMN IF NOT EXISTS ba_user_id TEXT REFERENCES ba_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_portal_applicants_ba_user_id ON portal_applicants(ba_user_id);

-- ============================================
-- STEP 2: MIGRATE UNIQUE EMAILS TO ba_users
-- ============================================

-- For each unique email in portal_applicants, create a ba_user
-- Use DISTINCT ON to get the most recent entry per email
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
    FALSE as email_verified, -- Portal applicants haven't verified email through Better Auth
    'applicant' as user_type, -- Use 'applicant' to match existing user types
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
    MIN(created_at) OVER (PARTITION BY email) as created_at, -- Use earliest created_at
    MAX(updated_at) OVER (PARTITION BY email) as updated_at -- Use latest updated_at
FROM portal_applicants pa
WHERE NOT EXISTS (
    SELECT 1 FROM ba_users bu WHERE bu.email = pa.email
)
ORDER BY email, created_at DESC
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- STEP 3: LINK portal_applicants TO ba_users
-- ============================================

-- Update portal_applicants with ba_user_id for all entries
UPDATE portal_applicants pa
SET ba_user_id = bu.id
FROM ba_users bu
WHERE bu.email = pa.email
AND pa.ba_user_id IS NULL;

-- ============================================
-- STEP 4: CREATE ba_accounts FOR PASSWORD AUTH
-- ============================================

-- For each unique email, create a ba_account entry with the password hash
-- Use the most recent password_hash (in case user changed password)
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
    pa.email as account_id, -- Use email as account_id for credential auth
    'credential' as provider_id,
    bu.id as user_id,
    pa.password_hash as password, -- Use the most recent password hash
    MIN(pa.created_at) OVER (PARTITION BY pa.email) as created_at,
    MAX(pa.updated_at) OVER (PARTITION BY pa.email) as updated_at
FROM portal_applicants pa
INNER JOIN ba_users bu ON bu.email = pa.email
WHERE pa.password_hash IS NOT NULL
AND pa.password_hash != '' -- Only migrate non-empty passwords
AND NOT EXISTS (
    SELECT 1 FROM ba_accounts ba 
    WHERE ba.user_id = bu.id AND ba.provider_id = 'credential'
)
ORDER BY pa.email, pa.created_at DESC
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 5: UPDATE table_rows REFERENCES
-- ============================================

-- Update table_rows.ba_created_by where rows were created by portal applicants
-- This links submissions to the migrated ba_users
UPDATE table_rows tr
SET ba_created_by = pa.ba_user_id
FROM portal_applicants pa
WHERE tr.id = pa.row_id
AND pa.ba_user_id IS NOT NULL
AND tr.ba_created_by IS NULL; -- Only update if not already set

-- Update table_rows.ba_updated_by similarly
UPDATE table_rows tr
SET ba_updated_by = pa.ba_user_id
FROM portal_applicants pa
WHERE tr.id = pa.row_id
AND pa.ba_user_id IS NOT NULL
AND tr.ba_updated_by IS NULL;

-- ============================================
-- STEP 6: UPDATE METADATA WITH FORM RELATIONSHIPS
-- ============================================

-- Update ba_users.metadata to include all form relationships
-- This preserves the many-to-many relationship (one email can have multiple forms)
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

-- ============================================
-- STEP 7: VERIFICATION QUERIES
-- ============================================

-- Count migrated users
-- SELECT COUNT(*) as migrated_users FROM ba_users WHERE user_type = 'applicant' AND metadata->>'migrated_from_portal_applicants' = 'true';

-- Count users with accounts
-- SELECT COUNT(*) as users_with_accounts FROM ba_accounts WHERE provider_id = 'credential' AND user_id IN (SELECT id FROM ba_users WHERE user_type = 'applicant');

-- Count linked portal_applicants
-- SELECT COUNT(*) as linked_applicants FROM portal_applicants WHERE ba_user_id IS NOT NULL;

-- ============================================
-- STEP 8: COMMENTS AND DOCUMENTATION
-- ============================================

COMMENT ON COLUMN portal_applicants.ba_user_id IS 'Links to ba_users.id after migration. Portal applicants are now managed through Better Auth.';
COMMENT ON COLUMN ba_users.metadata IS 'JSONB metadata. For migrated portal applicants, contains: migrated_from_portal_applicants, portal_applicant_ids, form_ids, portal_applicant_forms';

-- ============================================
-- ROLLBACK PLAN (if needed)
-- ============================================
-- 
-- If you need to rollback this migration:
-- 
-- 1. Remove ba_user_id links:
--    UPDATE portal_applicants SET ba_user_id = NULL;
-- 
-- 2. Delete migrated accounts:
--    DELETE FROM ba_accounts WHERE user_id IN (
--        SELECT id FROM ba_users WHERE metadata->>'migrated_from_portal_applicants' = 'true'
--    );
-- 
-- 3. Delete migrated users:
--    DELETE FROM ba_users WHERE metadata->>'migrated_from_portal_applicants' = 'true';
-- 
-- 4. Clear table_rows references:
--    UPDATE table_rows SET ba_created_by = NULL, ba_updated_by = NULL 
--    WHERE ba_created_by IN (
--        SELECT id FROM ba_users WHERE metadata->>'migrated_from_portal_applicants' = 'true'
--    );
-- 
-- Note: portal_applicants table data is preserved and not deleted
