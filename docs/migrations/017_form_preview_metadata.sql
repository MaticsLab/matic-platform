-- Migration: Add preview metadata fields for forms/portals
-- Description: Adds preview_title, preview_description, and preview_image_url to data_tables
--              for customizing how forms appear when shared on social media and other platforms

-- Add preview metadata columns
ALTER TABLE data_tables
ADD COLUMN IF NOT EXISTS preview_title TEXT,
ADD COLUMN IF NOT EXISTS preview_description TEXT,
ADD COLUMN IF NOT EXISTS preview_image_url TEXT;

-- Add comments
COMMENT ON COLUMN data_tables.preview_title IS 'Custom title for share previews (Open Graph, social media cards)';
COMMENT ON COLUMN data_tables.preview_description IS 'Custom description for share previews';
COMMENT ON COLUMN data_tables.preview_image_url IS 'URL to thumbnail image for share previews';
