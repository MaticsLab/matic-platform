-- Migration: Form Assets Storage Bucket
-- Description: Create storage bucket for form logos and background images
-- Run this in Supabase SQL Editor or Dashboard

-- Create the form-assets storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-assets',
  'form-assets',
  true,  -- Public bucket for logos and backgrounds
  5242880,  -- 5MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

-- Storage policies for form-assets bucket

-- Allow authenticated users to upload form assets
CREATE POLICY "Authenticated users can upload form assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'form-assets');

-- Allow authenticated users to update form assets
CREATE POLICY "Authenticated users can update form assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'form-assets');

-- Allow authenticated users to delete form assets
CREATE POLICY "Authenticated users can delete form assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'form-assets');

-- Allow public read access to all form assets (logos and backgrounds are public)
CREATE POLICY "Anyone can view form assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'form-assets');
