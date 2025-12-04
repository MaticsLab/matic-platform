-- Migration: Add is_hidden column to data_tables for hub visibility control
-- This allows admins to hide hubs from the workspace navigation and overview
-- Hidden hubs are not visible to any user in the workspace

-- Add is_hidden column to data_tables
ALTER TABLE data_tables 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN data_tables.is_hidden IS 'When true, this hub/table is hidden from navigation and overview for all users in the workspace. Only admins can see and manage hidden hubs.';

-- Create index for faster filtering of visible hubs
CREATE INDEX IF NOT EXISTS idx_data_tables_is_hidden ON data_tables(workspace_id, is_hidden) WHERE is_hidden = FALSE;
