-- Migration: Update workspace_members to use Better Auth user IDs
-- This allows workspace_members to reference ba_users instead of auth.users
-- 
-- NOTE: This migration uses a workaround because changing column types
-- requires dropping RLS policies. Instead, we'll add a new TEXT column
-- and migrate data, then switch to using it.

-- Step 1: Drop foreign key constraint if it exists (workspace_members.user_id -> auth.users.id)
DO $$
BEGIN
  -- Drop the foreign key constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'workspace_members_user_id_fkey'
    AND table_name = 'workspace_members'
  ) THEN
    ALTER TABLE workspace_members DROP CONSTRAINT workspace_members_user_id_fkey;
    RAISE NOTICE 'Dropped foreign key constraint workspace_members_user_id_fkey';
  END IF;
END $$;

-- Step 2: Add a new TEXT column for Better Auth user IDs
ALTER TABLE workspace_members 
ADD COLUMN IF NOT EXISTS ba_user_id TEXT;

-- Step 3: Populate ba_user_id from ba_users mapping
UPDATE workspace_members wm
SET ba_user_id = ba.id
FROM ba_users ba
WHERE ba.supabase_user_id::text = wm.user_id::text
  AND ba.supabase_user_id IS NOT NULL
  AND wm.user_id IS NOT NULL;

-- Step 4: For now, keep both columns. The Go backend will be updated to use ba_user_id
-- This avoids breaking RLS policies that depend on user_id

-- Step 8: Add index for performance
CREATE INDEX IF NOT EXISTS idx_workspace_members_ba_user_id 
ON workspace_members(user_id) 
WHERE user_id IS NOT NULL;

-- Step 9: Update unique constraint to work with TEXT
-- Drop existing unique constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'workspace_members_workspace_id_user_id_key'
  ) THEN
    ALTER TABLE workspace_members DROP CONSTRAINT workspace_members_workspace_id_user_id_key;
  END IF;
END $$;

-- Recreate unique constraint with TEXT user_id
ALTER TABLE workspace_members 
ADD CONSTRAINT workspace_members_workspace_id_user_id_key 
UNIQUE (workspace_id, user_id);

-- Step 4: Add index for ba_user_id
CREATE INDEX IF NOT EXISTS idx_workspace_members_ba_user_id 
ON workspace_members(ba_user_id) 
WHERE ba_user_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN workspace_members.ba_user_id IS 'Better Auth user ID (TEXT) - references ba_users.id. Populated for migrated users. The Go backend checks both user_id (UUID) and ba_user_id (TEXT) for compatibility.';

