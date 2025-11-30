-- Migration 015: Custom Portal URLs
-- Adds support for custom pretty URLs for public portals/forms
-- By default, portals use their UUID ID, but users can optionally set a custom slug

-- Add custom_slug column to data_tables (which stores forms)
-- This is separate from the existing 'slug' field which is auto-generated from name
ALTER TABLE data_tables
ADD COLUMN IF NOT EXISTS custom_slug VARCHAR(255) UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_data_tables_custom_slug 
ON data_tables(custom_slug) 
WHERE custom_slug IS NOT NULL;

-- Create function to validate custom slugs
CREATE OR REPLACE FUNCTION validate_custom_slug(slug TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Must be 3-50 characters
    IF LENGTH(slug) < 3 OR LENGTH(slug) > 50 THEN
        RETURN FALSE;
    END IF;
    
    -- Must only contain lowercase letters, numbers, and hyphens
    IF slug !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND slug !~ '^[a-z0-9]$' THEN
        RETURN FALSE;
    END IF;
    
    -- Cannot have consecutive hyphens
    IF slug ~ '--' THEN
        RETURN FALSE;
    END IF;
    
    -- Cannot be a reserved word that looks like UUID
    IF slug ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add constraint to ensure custom slugs are valid
ALTER TABLE data_tables
ADD CONSTRAINT check_custom_slug_valid
CHECK (custom_slug IS NULL OR validate_custom_slug(custom_slug));

-- Comment for documentation
COMMENT ON COLUMN data_tables.custom_slug IS 'Optional custom URL slug for public portals. If NULL, the form ID (UUID) is used. Must be 3-50 chars, lowercase alphanumeric with hyphens.';
