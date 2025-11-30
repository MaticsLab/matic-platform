-- Migration: 016_custom_subdomains.sql
-- Description: Add custom subdomain support for workspaces (pretty portal URLs)
-- URL Pattern: 
--   Default: forms.maticapp.com/{UUID}
--   Pretty:  {custom_subdomain}.maticapp.com/{custom_slug}

-- Add custom_subdomain to workspaces table
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS custom_subdomain VARCHAR(63) UNIQUE;

-- Add index for subdomain lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_custom_subdomain 
ON workspaces(custom_subdomain) WHERE custom_subdomain IS NOT NULL;

-- Subdomain validation function
-- Rules:
-- 1. 3-63 characters (DNS subdomain limit)
-- 2. Lowercase alphanumeric and hyphens only
-- 3. Must start and end with alphanumeric
-- 4. No consecutive hyphens
-- 5. Reserved subdomains blocked (forms, www, api, app, admin, etc.)
CREATE OR REPLACE FUNCTION validate_custom_subdomain(subdomain TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  reserved_subdomains TEXT[] := ARRAY[
    'forms', 'www', 'api', 'app', 'admin', 'dashboard', 'portal', 
    'mail', 'email', 'ftp', 'ssh', 'help', 'support', 'status',
    'blog', 'docs', 'dev', 'staging', 'test', 'demo', 'cdn',
    'assets', 'static', 'img', 'images', 'media', 'files',
    'auth', 'login', 'signup', 'register', 'account', 'billing',
    'matic', 'maticapp', 'apply', 'submit', 'review', 'external'
  ];
BEGIN
  -- NULL is valid (means no custom subdomain)
  IF subdomain IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Length check (3-63 for DNS compatibility)
  IF LENGTH(subdomain) < 3 OR LENGTH(subdomain) > 63 THEN
    RETURN FALSE;
  END IF;
  
  -- Must be lowercase alphanumeric with single hyphens
  IF subdomain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' THEN
    RETURN FALSE;
  END IF;
  
  -- No consecutive hyphens
  IF subdomain ~ '--' THEN
    RETURN FALSE;
  END IF;
  
  -- Check reserved subdomains
  IF subdomain = ANY(reserved_subdomains) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add constraint for subdomain validation
ALTER TABLE workspaces 
DROP CONSTRAINT IF EXISTS chk_workspaces_custom_subdomain_valid;

ALTER TABLE workspaces 
ADD CONSTRAINT chk_workspaces_custom_subdomain_valid 
CHECK (validate_custom_subdomain(custom_subdomain));

-- Comment for documentation
COMMENT ON COLUMN workspaces.custom_subdomain IS 
'Custom subdomain for workspace portals. Creates URLs like {subdomain}.maticapp.com/{slug}. Must be 3-63 chars, lowercase alphanumeric with hyphens, unique across all workspaces.';

-- Function to resolve a form by subdomain + slug combination
CREATE OR REPLACE FUNCTION resolve_form_by_subdomain_slug(
  p_subdomain TEXT,
  p_slug TEXT
)
RETURNS TABLE (
  form_id UUID,
  workspace_id UUID,
  form_name TEXT,
  form_slug TEXT,
  custom_slug TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dt.id as form_id,
    dt.workspace_id,
    dt.name as form_name,
    dt.slug as form_slug,
    dt.custom_slug
  FROM data_tables dt
  JOIN workspaces w ON dt.workspace_id = w.id
  WHERE w.custom_subdomain = p_subdomain
    AND dt.icon = 'form'
    AND dt.is_deleted = FALSE
    AND (dt.custom_slug = p_slug OR dt.slug = p_slug OR dt.id::text = p_slug);
END;
$$ LANGUAGE plpgsql STABLE;

-- Rollback:
-- ALTER TABLE workspaces DROP COLUMN IF EXISTS custom_subdomain;
-- DROP FUNCTION IF EXISTS validate_custom_subdomain(TEXT);
-- DROP FUNCTION IF EXISTS resolve_form_by_subdomain_slug(TEXT, TEXT);
