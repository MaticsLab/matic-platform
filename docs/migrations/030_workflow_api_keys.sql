-- Migration: 030_workflow_api_keys.sql
-- Description: Create API keys table for workflow builder webhook authentication
-- Created: 2025-01-XX

-- =====================================================
-- WORKFLOW API KEYS TABLE
-- =====================================================
-- API Keys for authenticating workflow webhook triggers
-- Keys are stored as hashes, with only the prefix visible for identification

CREATE TABLE IF NOT EXISTS wf_api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES ba_users(id) ON DELETE CASCADE,
    name TEXT,  -- Optional label for the API key
    key_hash TEXT NOT NULL,  -- SHA-256 hash of the full API key
    key_prefix TEXT NOT NULL,  -- First few chars for display (e.g., "wfb_abc...")
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- Indexes for API keys
CREATE INDEX IF NOT EXISTS idx_wf_api_keys_user_id ON wf_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_wf_api_keys_key_hash ON wf_api_keys(key_hash);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE wf_api_keys IS 'API keys for authenticating workflow webhook triggers';
COMMENT ON COLUMN wf_api_keys.key_hash IS 'SHA-256 hash of the full API key - never store the actual key';
COMMENT ON COLUMN wf_api_keys.key_prefix IS 'Prefix of the key (e.g., wfb_abc...) for user identification';
COMMENT ON COLUMN wf_api_keys.last_used_at IS 'Timestamp of last API key usage for tracking';
