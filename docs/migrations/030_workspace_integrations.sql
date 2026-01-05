-- ============================================================================
-- Workspace Integrations - Google Drive and other third-party integrations
-- Migration: 030_workspace_integrations.sql
-- ============================================================================

-- Create workspace_integrations table to store integration configurations
CREATE TABLE IF NOT EXISTS workspace_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Integration type: 'google_drive', 'dropbox', 'onedrive', etc.
    integration_type TEXT NOT NULL,
    
    -- Integration status
    is_enabled BOOLEAN DEFAULT false,
    is_connected BOOLEAN DEFAULT false,
    
    -- OAuth tokens (encrypted in production)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    
    -- Integration-specific configuration
    -- For Google Drive: { root_folder_id, folder_structure, sync_settings }
    config JSONB DEFAULT '{}',
    
    -- Connection metadata
    connected_email TEXT,  -- Email of the connected account
    connected_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES users(id),
    
    -- Only one integration per type per workspace
    UNIQUE(workspace_id, integration_type)
);

-- Create form_integration_settings table for per-form integration configs
CREATE TABLE IF NOT EXISTS form_integration_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    workspace_integration_id UUID NOT NULL REFERENCES workspace_integrations(id) ON DELETE CASCADE,
    
    -- Whether this integration is enabled for this form
    is_enabled BOOLEAN DEFAULT true,
    
    -- Form-specific settings
    -- For Google Drive: { folder_id, applicant_folder_template, sync_on_submit }
    settings JSONB DEFAULT '{}',
    
    -- The Drive folder created for this form
    external_folder_id TEXT,
    external_folder_url TEXT,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(form_id, workspace_integration_id)
);

-- Create applicant_folders table to track applicant-specific folders in external storage
CREATE TABLE IF NOT EXISTS applicant_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_integration_id UUID NOT NULL REFERENCES form_integration_settings(id) ON DELETE CASCADE,
    row_id UUID NOT NULL REFERENCES rows(id) ON DELETE CASCADE,
    
    -- Applicant identifier (email or name used for folder naming)
    applicant_identifier TEXT NOT NULL,
    
    -- External folder info
    external_folder_id TEXT NOT NULL,
    external_folder_url TEXT,
    
    -- Sync status
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'pending', -- pending, synced, error
    sync_error TEXT,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(form_integration_id, row_id)
);

-- Create file_sync_log table to track file syncs to external storage
CREATE TABLE IF NOT EXISTS file_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_folder_id UUID NOT NULL REFERENCES applicant_folders(id) ON DELETE CASCADE,
    table_file_id UUID REFERENCES table_files(id) ON DELETE SET NULL,
    
    -- External file info
    external_file_id TEXT,
    external_file_url TEXT,
    
    -- Original file info
    original_filename TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type TEXT,
    
    -- Sync status
    sync_status TEXT DEFAULT 'pending', -- pending, synced, error, deleted
    sync_error TEXT,
    synced_at TIMESTAMPTZ,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_integrations_workspace ON workspace_integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_integrations_type ON workspace_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_form_integration_settings_form ON form_integration_settings(form_id);
CREATE INDEX IF NOT EXISTS idx_applicant_folders_row ON applicant_folders(row_id);
CREATE INDEX IF NOT EXISTS idx_file_sync_log_folder ON file_sync_log(applicant_folder_id);
CREATE INDEX IF NOT EXISTS idx_file_sync_log_file ON file_sync_log(table_file_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_integration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspace_integrations_updated_at
    BEFORE UPDATE ON workspace_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_timestamp();

CREATE TRIGGER form_integration_settings_updated_at
    BEFORE UPDATE ON form_integration_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_timestamp();

CREATE TRIGGER applicant_folders_updated_at
    BEFORE UPDATE ON applicant_folders
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_timestamp();

-- Comments
COMMENT ON TABLE workspace_integrations IS 'Third-party integration configurations per workspace (Google Drive, Dropbox, etc.)';
COMMENT ON TABLE form_integration_settings IS 'Per-form settings for workspace integrations';
COMMENT ON TABLE applicant_folders IS 'Tracks folders created for each applicant in external storage';
COMMENT ON TABLE file_sync_log IS 'Logs file sync operations to external storage';
