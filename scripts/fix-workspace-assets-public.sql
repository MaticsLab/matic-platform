-- Run this directly in Supabase Dashboard > SQL Editor
-- This makes workspace-assets a public bucket (no JWT verification required)

-- Update the bucket to be public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'workspace-assets';

-- Verify the change
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'workspace-assets';
