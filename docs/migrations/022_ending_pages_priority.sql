-- Add priority field for rule-based ending selection
-- Priority determines the order in which endings are evaluated (lower = higher priority)
-- is_default marks the fallback ending when no rules match

-- Add priority column
ALTER TABLE ending_pages ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Create index for efficient ordering
CREATE INDEX IF NOT EXISTS idx_ending_pages_priority ON ending_pages(form_id, priority ASC);

-- Ensure only one default ending per form (trigger-based enforcement)
CREATE OR REPLACE FUNCTION ensure_single_default_ending()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        -- Unset is_default for all other endings in the same form
        UPDATE ending_pages 
        SET is_default = false, updated_at = CURRENT_TIMESTAMP
        WHERE form_id = NEW.form_id 
          AND id != NEW.id 
          AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_single_default_ending ON ending_pages;
CREATE TRIGGER trigger_single_default_ending
    BEFORE INSERT OR UPDATE OF is_default ON ending_pages
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_ending();

-- Backfill: set priority based on creation order for existing endings
WITH ranked AS (
    SELECT id, form_id, ROW_NUMBER() OVER (PARTITION BY form_id ORDER BY created_at ASC) - 1 as new_priority
    FROM ending_pages
    WHERE priority IS NULL OR priority = 0
)
UPDATE ending_pages ep
SET priority = r.new_priority
FROM ranked r
WHERE ep.id = r.id;

-- If no default is set for a form, set the first published ending as default
WITH first_published AS (
    SELECT DISTINCT ON (form_id) id, form_id
    FROM ending_pages
    WHERE status = 'published'
    ORDER BY form_id, priority ASC, created_at ASC
)
UPDATE ending_pages ep
SET is_default = true
FROM first_published fp
WHERE ep.id = fp.id
  AND NOT EXISTS (
      SELECT 1 FROM ending_pages 
      WHERE form_id = ep.form_id AND is_default = true
  );
