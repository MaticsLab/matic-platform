-- Migration: 014_table_files.sql
-- Description: Create table_files for storing file attachments across all modules
-- This table stores metadata for files uploaded to any table (applications, data tables, forms, etc.)
-- Files are stored in Supabase Storage, this table tracks the metadata and relationships

-- ============================================================================
-- STEP 1: Create the table_files table
-- ============================================================================

CREATE TABLE IF NOT EXISTS table_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships (all optional to support different use cases)
    table_id UUID REFERENCES data_tables(id) ON DELETE CASCADE,          -- Which table this file belongs to
    row_id UUID REFERENCES table_rows(id) ON DELETE CASCADE,             -- Which row/submission/application
    field_id UUID REFERENCES table_fields(id) ON DELETE SET NULL,        -- Which field (if field-level attachment)
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,       -- Workspace for orphan files
    
    -- File metadata
    filename TEXT NOT NULL,                    -- Stored filename (with timestamp prefix)
    original_filename TEXT NOT NULL,           -- Original user filename
    mime_type TEXT NOT NULL,                   -- MIME type (application/pdf, image/png, etc.)
    size_bytes BIGINT NOT NULL,                -- File size in bytes
    
    -- Storage location
    storage_bucket TEXT NOT NULL DEFAULT 'workspace-assets',  -- Supabase storage bucket
    storage_path TEXT NOT NULL,                               -- Full path in storage
    public_url TEXT,                                          -- Public URL if applicable
    
    -- Optional metadata
    description TEXT,                          -- User description
    alt_text TEXT,                             -- Alt text for images
    metadata JSONB DEFAULT '{}',               -- Flexible metadata (dimensions, duration, etc.)
    tags TEXT[] DEFAULT '{}',                  -- Tags for categorization
    
    -- Versioning support
    version INTEGER DEFAULT 1,                 -- File version number
    parent_file_id UUID REFERENCES table_files(id) ON DELETE SET NULL,  -- Previous version
    is_current BOOLEAN DEFAULT true,           -- Is this the current version?
    
    -- Audit fields
    uploaded_by UUID,                          -- User who uploaded (can be null for anonymous)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ                     -- Soft delete
);

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX idx_table_files_table ON table_files(table_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_table_files_row ON table_files(row_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_table_files_field ON table_files(field_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_table_files_workspace ON table_files(workspace_id) WHERE deleted_at IS NULL;

-- Composite indexes for common queries
CREATE INDEX idx_table_files_row_field ON table_files(row_id, field_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_table_files_table_row ON table_files(table_id, row_id) WHERE deleted_at IS NULL;

-- Storage path uniqueness (per bucket)
CREATE UNIQUE INDEX idx_table_files_storage_path ON table_files(storage_bucket, storage_path) WHERE deleted_at IS NULL;

-- Version tracking
CREATE INDEX idx_table_files_versions ON table_files(parent_file_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_table_files_current ON table_files(row_id, field_id, is_current) WHERE is_current = true AND deleted_at IS NULL;

-- Metadata and tags search
CREATE INDEX idx_table_files_metadata ON table_files USING gin(metadata);
CREATE INDEX idx_table_files_tags ON table_files USING gin(tags);

-- MIME type filtering
CREATE INDEX idx_table_files_mime ON table_files(mime_type) WHERE deleted_at IS NULL;

-- ============================================================================
-- STEP 3: Create updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_table_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_table_files_updated_at
    BEFORE UPDATE ON table_files
    FOR EACH ROW
    EXECUTE FUNCTION update_table_files_updated_at();

-- ============================================================================
-- STEP 4: Create helper functions
-- ============================================================================

-- Get all files for a row (current versions only)
CREATE OR REPLACE FUNCTION get_row_files(p_row_id UUID)
RETURNS TABLE (
    id UUID,
    field_id UUID,
    filename TEXT,
    original_filename TEXT,
    mime_type TEXT,
    size_bytes BIGINT,
    public_url TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.field_id,
        f.filename,
        f.original_filename,
        f.mime_type,
        f.size_bytes,
        f.public_url,
        f.metadata,
        f.created_at
    FROM table_files f
    WHERE f.row_id = p_row_id
      AND f.is_current = true
      AND f.deleted_at IS NULL
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Get file count and total size for a row
CREATE OR REPLACE FUNCTION get_row_file_stats(p_row_id UUID)
RETURNS TABLE (
    file_count BIGINT,
    total_size_bytes BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT,
        COALESCE(SUM(f.size_bytes), 0)::BIGINT
    FROM table_files f
    WHERE f.row_id = p_row_id
      AND f.is_current = true
      AND f.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Soft delete a file (marks as deleted but keeps in storage for audit)
CREATE OR REPLACE FUNCTION soft_delete_file(p_file_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE table_files
    SET deleted_at = now(),
        is_current = false
    WHERE id = p_file_id
      AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create a new version of a file
CREATE OR REPLACE FUNCTION create_file_version(
    p_parent_file_id UUID,
    p_filename TEXT,
    p_original_filename TEXT,
    p_mime_type TEXT,
    p_size_bytes BIGINT,
    p_storage_path TEXT,
    p_public_url TEXT,
    p_uploaded_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_table_id UUID;
    v_row_id UUID;
    v_field_id UUID;
    v_workspace_id UUID;
    v_bucket TEXT;
    v_version INTEGER;
BEGIN
    -- Get parent file info
    SELECT table_id, row_id, field_id, workspace_id, storage_bucket, version
    INTO v_table_id, v_row_id, v_field_id, v_workspace_id, v_bucket, v_version
    FROM table_files
    WHERE id = p_parent_file_id AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent file not found';
    END IF;
    
    -- Mark old version as not current
    UPDATE table_files
    SET is_current = false
    WHERE id = p_parent_file_id;
    
    -- Create new version
    INSERT INTO table_files (
        table_id, row_id, field_id, workspace_id,
        filename, original_filename, mime_type, size_bytes,
        storage_bucket, storage_path, public_url,
        version, parent_file_id, is_current, uploaded_by
    ) VALUES (
        v_table_id, v_row_id, v_field_id, v_workspace_id,
        p_filename, p_original_filename, p_mime_type, p_size_bytes,
        v_bucket, p_storage_path, p_public_url,
        v_version + 1, p_parent_file_id, true, p_uploaded_by
    )
    RETURNING id INTO v_new_id;
    
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: Create view for easy querying
-- ============================================================================

CREATE OR REPLACE VIEW v_table_files_current AS
SELECT 
    f.id,
    f.table_id,
    f.row_id,
    f.field_id,
    f.workspace_id,
    f.filename,
    f.original_filename,
    f.mime_type,
    f.size_bytes,
    f.storage_bucket,
    f.storage_path,
    f.public_url,
    f.description,
    f.alt_text,
    f.metadata,
    f.tags,
    f.version,
    f.parent_file_id,
    f.uploaded_by,
    f.created_at,
    f.updated_at,
    -- Computed fields
    CASE 
        WHEN f.mime_type LIKE 'image/%' THEN 'image'
        WHEN f.mime_type LIKE 'video/%' THEN 'video'
        WHEN f.mime_type LIKE 'audio/%' THEN 'audio'
        WHEN f.mime_type = 'application/pdf' THEN 'pdf'
        WHEN f.mime_type LIKE 'application/vnd.ms-excel%' OR f.mime_type LIKE 'application/vnd.openxmlformats-officedocument.spreadsheet%' THEN 'spreadsheet'
        WHEN f.mime_type LIKE 'application/vnd.ms-word%' OR f.mime_type LIKE 'application/vnd.openxmlformats-officedocument.wordprocessing%' THEN 'document'
        ELSE 'file'
    END AS file_category,
    -- Format size for display
    CASE
        WHEN f.size_bytes >= 1073741824 THEN ROUND(f.size_bytes::NUMERIC / 1073741824, 2) || ' GB'
        WHEN f.size_bytes >= 1048576 THEN ROUND(f.size_bytes::NUMERIC / 1048576, 2) || ' MB'
        WHEN f.size_bytes >= 1024 THEN ROUND(f.size_bytes::NUMERIC / 1024, 2) || ' KB'
        ELSE f.size_bytes || ' bytes'
    END AS formatted_size
FROM table_files f
WHERE f.is_current = true
  AND f.deleted_at IS NULL;

-- ============================================================================
-- STEP 6: Create storage bucket and policies
-- ============================================================================

-- Create the workspace-assets bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'workspace-assets', 
    'workspace-assets', 
    true,
    52428800,  -- 50MB limit
    ARRAY[
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv',
        'video/mp4', 'video/webm',
        'audio/mpeg', 'audio/wav', 'audio/ogg'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read public files
DROP POLICY IF EXISTS "Public read workspace-assets" ON storage.objects;
CREATE POLICY "Public read workspace-assets" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'workspace-assets');

-- Policy: Authenticated users can upload
DROP POLICY IF EXISTS "Authenticated upload workspace-assets" ON storage.objects;
CREATE POLICY "Authenticated upload workspace-assets" ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'workspace-assets');

-- Policy: Users can update their own files
DROP POLICY IF EXISTS "Update own files workspace-assets" ON storage.objects;
CREATE POLICY "Update own files workspace-assets" ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'workspace-assets');

-- Policy: Users can delete files
DROP POLICY IF EXISTS "Delete files workspace-assets" ON storage.objects;
CREATE POLICY "Delete files workspace-assets" ON storage.objects
    FOR DELETE
    USING (bucket_id = 'workspace-assets');

-- ============================================================================
-- STEP 7: Add RLS to table_files
-- ============================================================================

ALTER TABLE table_files ENABLE ROW LEVEL SECURITY;

-- Everyone can read files (they're linked to public data)
CREATE POLICY "Read table_files" ON table_files
    FOR SELECT
    USING (deleted_at IS NULL);

-- Authenticated users can insert files
CREATE POLICY "Insert table_files" ON table_files
    FOR INSERT
    WITH CHECK (true);

-- Users can update files
CREATE POLICY "Update table_files" ON table_files
    FOR UPDATE
    USING (true);

-- Users can soft delete files
CREATE POLICY "Delete table_files" ON table_files
    FOR DELETE
    USING (true);

-- ============================================================================
-- STEP 8: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON table_files TO authenticated;
GRANT SELECT ON table_files TO anon;
GRANT SELECT ON v_table_files_current TO authenticated, anon;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_bucket_exists BOOLEAN;
    v_index_count INTEGER;
BEGIN
    -- Check table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'table_files'
    ) INTO v_table_exists;
    
    -- Check bucket exists
    SELECT EXISTS (
        SELECT 1 FROM storage.buckets 
        WHERE id = 'workspace-assets'
    ) INTO v_bucket_exists;
    
    -- Count indexes
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE tablename = 'table_files';
    
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Migration 014_table_files.sql VERIFICATION';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'table_files exists: %', v_table_exists;
    RAISE NOTICE 'workspace-assets bucket exists: %', v_bucket_exists;
    RAISE NOTICE 'Index count: %', v_index_count;
    RAISE NOTICE '================================================';
END;
$$;
