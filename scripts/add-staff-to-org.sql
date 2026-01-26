-- Migration: Add all staff users to BPNC organization and fix workspace organization_id
-- Run this in Supabase SQL Editor or via psql

BEGIN;

-- Step 1: Fix workspace organization_id to match ba_organizations
UPDATE workspaces 
SET organization_id = (
  SELECT id::uuid 
  FROM ba_organizations 
  WHERE slug = 'BPNC'
)
WHERE slug = 'BPNC';

-- Verify workspace update
SELECT 'Workspace updated:' as status, id, name, slug, organization_id::text as org_id 
FROM workspaces WHERE slug = 'BPNC';

-- Step 2: Add all staff users to the organization (excluding those already members)
INSERT INTO ba_members (organization_id, user_id, role, created_at)
SELECT 
  '372ca807-feed-40ef-a746-65ff89a64d7f' as organization_id,
  u.id as user_id,
  'member' as role,
  NOW() as created_at
FROM ba_users u
WHERE u.user_type = 'staff'
  AND NOT EXISTS (
    SELECT 1 FROM ba_members m 
    WHERE m.user_id = u.id 
    AND m.organization_id = '372ca807-feed-40ef-a746-65ff89a64d7f'
  );

-- Verify results
SELECT 
  'Migration complete!' as status,
  m.role,
  COUNT(*) as member_count,
  STRING_AGG(u.email, ', ' ORDER BY u.email) as members
FROM ba_members m
JOIN ba_users u ON m.user_id = u.id
WHERE m.organization_id = '372ca807-feed-40ef-a746-65ff89a64d7f'
GROUP BY m.role
ORDER BY m.role;

COMMIT;
