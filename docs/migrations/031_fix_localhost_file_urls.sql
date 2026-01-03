-- ============================================================================
-- Migration 031: Fix Localhost File URLs
-- ============================================================================
-- Purpose: Update existing file URLs that use localhost:8080 to use production URL
-- Generated: January 2, 2026
--
-- This migration fixes URLs stored in:
-- 1. recommendation_requests.response JSONB (uploaded_document.url)
-- 2. portal_documents.url column
--
-- Note: Set BASE_URL environment variable in production to prevent this issue
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Fix Portal Documents URLs
-- ============================================================================

-- Update portal_documents URLs from localhost:8080 to production URL
-- Only if table exists (check using DO block to avoid errors if table doesn't exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_documents') THEN
        UPDATE portal_documents
        SET url = REPLACE(url, 'http://localhost:8080', 'https://backend.maticslab.com')
        WHERE url LIKE 'http://localhost:8080%';

        -- Also handle any other localhost variations
        UPDATE portal_documents
        SET url = REPLACE(url, 'http://localhost:8000', 'https://backend.maticslab.com')
        WHERE url LIKE 'http://localhost:8000%';

        UPDATE portal_documents
        SET url = REPLACE(url, 'https://localhost:8080', 'https://backend.maticslab.com')
        WHERE url LIKE 'https://localhost:8080%';
    END IF;
END $$;

-- ============================================================================
-- SECTION 2: Fix Recommendation Request URLs in JSONB
-- ============================================================================

-- Update recommendation_requests.response JSONB field
-- This is more complex because we need to update nested JSON
UPDATE recommendation_requests
SET response = jsonb_set(
    response,
    '{uploaded_document,url}',
    to_jsonb(REPLACE(response->'uploaded_document'->>'url', 'http://localhost:8080', 'https://backend.maticslab.com'))
)
WHERE response->'uploaded_document'->>'url' LIKE 'http://localhost:8080%'
   OR response->'uploaded_document'->>'url' LIKE 'http://localhost:8000%'
   OR response->'uploaded_document'->>'url' LIKE 'https://localhost:8080%';

-- ============================================================================
-- SECTION 3: Verification Queries (for manual checking)
-- ============================================================================

-- Check remaining localhost URLs in portal_documents (if table exists)
-- SELECT id, url FROM portal_documents WHERE url LIKE '%localhost%';

-- Check remaining localhost URLs in recommendation_requests
-- SELECT id, response->'uploaded_document'->>'url' as url 
-- FROM recommendation_requests 
-- WHERE response->'uploaded_document'->>'url' LIKE '%localhost%';

-- Count fixed records
-- SELECT COUNT(*) as fixed_urls 
-- FROM recommendation_requests 
-- WHERE response->'uploaded_document'->>'url' LIKE '%backend.maticslab.com%';

COMMIT;

-- ============================================================================
-- ROLLBACK (if needed):
-- ============================================================================
-- This migration is mostly one-way. To rollback, you would need to restore
-- from a backup or manually revert URLs if you have the original values stored.
-- ============================================================================

