-- Migration: Add invitation columns to workspace_members table
-- This simplifies the invitation system by using a single table instead of separate workspace_invitations
-- NOTE: This is the ACTUAL implementation - invitations are stored in workspace_members with status='pending'
--       See handlers/invitations.go for the implementation

-- Add new columns for invitation tracking
ALTER TABLE workspace_members 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS invited_email TEXT,
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS invite_token TEXT,
ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- Allow user_id to be NULL for pending invitations
ALTER TABLE workspace_members ALTER COLUMN user_id DROP NOT NULL;

-- Create index on invite_token for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_members_invite_token 
ON workspace_members(invite_token) 
WHERE invite_token IS NOT NULL AND invite_token != '';

-- Create index on invited_email for lookups
CREATE INDEX IF NOT EXISTS idx_workspace_members_invited_email 
ON workspace_members(invited_email) 
WHERE invited_email IS NOT NULL AND invited_email != '';

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_workspace_members_status 
ON workspace_members(status);

-- Update existing records to have status = 'active'
UPDATE workspace_members SET status = 'active' WHERE status IS NULL;

-- Optional: Migrate existing workspace_invitations to workspace_members (if table exists)
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'workspace_invitations') THEN
--     INSERT INTO workspace_members (workspace_id, role, hub_access, permissions, status, invited_email, invited_by, invite_token, invite_expires_at, invited_at)
--     SELECT 
--       workspace_id,
--       role,
--       hub_access,
--       permissions,
--       status,
--       email as invited_email,
--       invited_by,
--       token as invite_token,
--       expires_at as invite_expires_at,
--       created_at as invited_at
--     FROM workspace_invitations
--     ON CONFLICT DO NOTHING;
--   END IF;
-- END $$;
