-- Migration: User Assets Storage Bucket
-- Description: Create storage bucket for user profile photos and assets
-- Run this in Supabase SQL Editor or Dashboard

-- Create the user-assets storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-assets',
  'user-assets',
  true,  -- Public bucket for profile photos
  2097152,  -- 2MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Storage policies for user-assets bucket

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-assets' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND (split_part(storage.filename(name), '_', 1) = auth.uid()::text)
);

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-assets'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (split_part(storage.filename(name), '_', 1) = auth.uid()::text)
);

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-assets'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (split_part(storage.filename(name), '_', 1) = auth.uid()::text)
);

-- Allow public read access to all avatars (they're profile photos)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-assets');
