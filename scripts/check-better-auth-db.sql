-- Better Auth Database Verification Queries
-- Run these in Supabase SQL Editor to check Better Auth setup

-- ============================================
-- 1. CHECK IF TABLES EXIST
-- ============================================
SELECT 
  table_name,
  CASE WHEN table_name IN (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM (
  VALUES 
    ('ba_users'),
    ('ba_sessions'),
    ('ba_accounts'),
    ('ba_verifications'),
    ('ba_organizations'),
    ('ba_members'),
    ('ba_invitations')
) AS expected_tables(table_name);

-- ============================================
-- 2. TABLE ROW COUNTS
-- ============================================
SELECT 
  'ba_users' as table_name,
  COUNT(*) as row_count
FROM ba_users
UNION ALL
SELECT 
  'ba_sessions' as table_name,
  COUNT(*) as row_count
FROM ba_sessions
UNION ALL
SELECT 
  'ba_accounts' as table_name,
  COUNT(*) as row_count
FROM ba_accounts
UNION ALL
SELECT 
  'ba_verifications' as table_name,
  COUNT(*) as row_count
FROM ba_verifications
UNION ALL
SELECT 
  'ba_organizations' as table_name,
  COUNT(*) as row_count
FROM ba_organizations
UNION ALL
SELECT 
  'ba_members' as table_name,
  COUNT(*) as row_count
FROM ba_members
UNION ALL
SELECT 
  'ba_invitations' as table_name,
  COUNT(*) as row_count
FROM ba_invitations;

-- ============================================
-- 3. MIGRATION STATISTICS
-- ============================================
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE migrated_from_supabase = true) as migrated_from_supabase,
  COUNT(*) FILTER (WHERE email_verified = true) as email_verified,
  COUNT(*) FILTER (WHERE supabase_user_id IS NOT NULL) as has_supabase_link
FROM ba_users;

-- ============================================
-- 4. SAMPLE USERS (Last 10)
-- ============================================
SELECT 
  id,
  email,
  name,
  email_verified,
  migrated_from_supabase,
  supabase_user_id,
  created_at
FROM ba_users
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- 5. ACTIVE SESSIONS
-- ============================================
SELECT 
  s.id,
  s.user_id,
  u.email,
  s.expires_at,
  s.active_organization_id,
  CASE 
    WHEN s.expires_at > NOW() THEN '✅ Active'
    ELSE '❌ Expired'
  END as status
FROM ba_sessions s
JOIN ba_users u ON u.id = s.user_id
ORDER BY s.created_at DESC
LIMIT 10;

-- ============================================
-- 6. ACCOUNTS BY PROVIDER
-- ============================================
SELECT 
  provider_id,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE password IS NOT NULL) as with_password
FROM ba_accounts
GROUP BY provider_id
ORDER BY count DESC;

-- ============================================
-- 7. USERS WITHOUT ACCOUNTS (CANNOT LOGIN)
-- ============================================
SELECT 
  u.id,
  u.email,
  u.name,
  u.created_at
FROM ba_users u
LEFT JOIN ba_accounts a ON a.user_id = u.id
WHERE a.id IS NULL;

-- ============================================
-- 8. USERS WITH SESSIONS BUT NO ACCOUNTS
-- ============================================
SELECT 
  u.id,
  u.email,
  COUNT(s.id) as session_count
FROM ba_users u
JOIN ba_sessions s ON s.user_id = u.id
LEFT JOIN ba_accounts a ON a.user_id = u.id
WHERE a.id IS NULL
GROUP BY u.id, u.email;

-- ============================================
-- 9. MIGRATION CONSISTENCY CHECK
-- ============================================
SELECT 
  COUNT(*) as users_with_supabase_id_but_not_marked_migrated
FROM ba_users
WHERE supabase_user_id IS NOT NULL 
  AND migrated_from_supabase = false;

-- ============================================
-- 10. EXPIRED SESSIONS COUNT
-- ============================================
SELECT 
  COUNT(*) as expired_sessions,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as active_sessions
FROM ba_sessions;

-- ============================================
-- 11. ORGANIZATION MEMBERSHIP
-- ============================================
SELECT 
  o.name as organization_name,
  o.slug,
  COUNT(m.id) as member_count
FROM ba_organizations o
LEFT JOIN ba_members m ON m.organization_id = o.id
GROUP BY o.id, o.name, o.slug
ORDER BY member_count DESC;

-- ============================================
-- 12. USER-ACCOUNT-SESSION SUMMARY
-- ============================================
SELECT 
  u.email,
  u.migrated_from_supabase,
  COUNT(DISTINCT a.id) as account_count,
  COUNT(DISTINCT s.id) FILTER (WHERE s.expires_at > NOW()) as active_session_count
FROM ba_users u
LEFT JOIN ba_accounts a ON a.user_id = u.id
LEFT JOIN ba_sessions s ON s.user_id = u.id
GROUP BY u.id, u.email, u.migrated_from_supabase
ORDER BY u.created_at DESC
LIMIT 20;

