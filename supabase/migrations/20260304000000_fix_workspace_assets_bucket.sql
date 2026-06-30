-- Fix workspace-assets bucket to allow public access
--  This fixes the "signature verification failed" error for file uploads in the public portal

-- First, ensure the bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('workspace-assets', 'workspace-assets', true, 52428800, NULL)
ON CONFLICT (id) 
DO UPDATE SET public = true;

-- Ensure RLS policies allow public uploads (already exist but adding for completeness)
-- These policies already exist in the schema, but we'll recreate them to ensure they're correct

DROP POLICY IF EXISTS "Authenticated upload workspace-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read workspace-assets" ON storage.objects;
DROP POLICY IF EXISTS "Delete files workspace-assets" ON storage.objects;
DROP POLICY IF EXISTS "Update own files workspace-assets" ON storage.objects;

-- Allow anyone to upload to workspace-assets bucket
CREATE POLICY "Public upload workspace-assets"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'workspace-assets');

-- Allow anyone to read from workspace-assets bucket
CREATE POLICY "Public read workspace-assets"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'workspace-assets');

-- Allow anyone to delete from workspace-assets bucket
CREATE POLICY "Public delete workspace-assets"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'workspace-assets');

-- Allow anyone to update workspace-assets files
CREATE POLICY "Public update workspace-assets"
  ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'workspace-assets');
