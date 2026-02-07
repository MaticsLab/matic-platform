-- ============================================
-- Migration 051: JSONB Submission Data + Layout Separation
-- 
-- Goals:
--   1. Add raw_data JSONB to form_submissions (single blob per submission)
--   2. Add layout JSONB to forms (layout-only elements)
--   3. Add category to form_fields (data vs layout)
--   4. Backfill layout category for known layout field types
--   5. Backfill raw_data from existing form_responses
--
-- This is non-destructive:
--   - form_responses table is NOT dropped (dual-write during transition)
--   - Existing columns are only added, never removed
-- ============================================

-- 1. Add raw_data JSONB column to form_submissions
ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}';

COMMENT ON COLUMN form_submissions.raw_data IS 'Denormalized submission data as JSONB blob. Keys are field IDs. Primary read source.';

-- 2. Add layout JSONB column to forms
ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS layout JSONB DEFAULT '[]';

COMMENT ON COLUMN forms.layout IS 'Layout-only elements (headings, dividers, etc.) as JSONB array. Not stored as form_fields.';

-- 3. Add category column to form_fields
ALTER TABLE form_fields
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'data';

COMMENT ON COLUMN form_fields.category IS 'Field category: data (collects input) or layout (visual only)';

-- 4. Backfill category for known layout field types
UPDATE form_fields
SET category = 'layout'
WHERE field_type IN (
  'heading',
  'section_header',
  'divider',
  'separator',
  'html',
  'description',
  'page_break',
  'button'
)
AND category = 'data';

-- 5. Create GIN index on raw_data for fast JSONB queries
CREATE INDEX IF NOT EXISTS idx_form_submissions_raw_data
  ON form_submissions USING GIN (raw_data);

-- 6. Create index on form_fields.category for fast filtering
CREATE INDEX IF NOT EXISTS idx_form_fields_category
  ON form_fields (category);

-- 7. Backfill raw_data from existing form_responses
-- This aggregates all responses per submission into a single JSONB object
-- Keys are field_id UUIDs (matching existing frontend convention)
UPDATE form_submissions fs
SET raw_data = COALESCE(
  (
    SELECT jsonb_object_agg(
      fr.field_id::text,
      CASE fr.value_type
        WHEN 'text' THEN to_jsonb(fr.value_text)
        WHEN 'number' THEN to_jsonb(fr.value_number)
        WHEN 'boolean' THEN to_jsonb(fr.value_boolean)
        WHEN 'date' THEN to_jsonb(fr.value_date)
        WHEN 'datetime' THEN to_jsonb(fr.value_datetime)
        WHEN 'json' THEN COALESCE(fr.value_json, 'null'::jsonb)
        ELSE to_jsonb(fr.value_text)
      END
    )
    FROM form_responses fr
    WHERE fr.submission_id = fs.id
  ),
  '{}'::jsonb
)
WHERE fs.raw_data = '{}'::jsonb OR fs.raw_data IS NULL;
