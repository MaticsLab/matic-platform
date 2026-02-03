-- ============================================
-- MIGRATION: Migrate to Unified Forms Schema
-- ============================================
-- This migration moves data from legacy tables to the new unified forms system:
-- 1. Migrate data_tables (hub_type='applications') → forms
-- 2. Migrate table_fields → form_fields  
-- 3. Migrate table_rows (submissions) → form_submissions + form_responses
-- 4. Drop legacy tables: application_submissions, portal_applicants, submission_versions
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Migrate Forms (data_tables → forms)
-- ============================================
INSERT INTO forms (
    id,
    workspace_id,
    legacy_table_id,
    name,
    slug,
    description,
    settings,
    status,
    published_at,
    require_auth,
    version,
    created_at,
    updated_at,
    created_by
)
SELECT 
    gen_random_uuid() as id,
    dt.workspace_id,
    dt.id as legacy_table_id,
    dt.name,
    COALESCE(dt.custom_slug, dt.slug) as slug,
    dt.description,
    dt.settings,
    CASE 
        WHEN dt.is_archived THEN 'archived'
        WHEN dt.is_hidden THEN 'draft'
        ELSE 'published'
    END as status,
    dt.created_at as published_at,
    true as require_auth,
    1 as version,
    dt.created_at,
    dt.updated_at,
    dt.ba_created_by as created_by
FROM data_tables dt
WHERE dt.hub_type = 'applications'
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 2: Migrate Form Fields (table_fields → form_fields)
-- ============================================
INSERT INTO form_fields (
    id,
    form_id,
    legacy_field_id,
    field_key,
    field_type,
    label,
    description,
    placeholder,
    required,
    validation,
    options,
    sort_order,
    version,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid() as id,
    f.id as form_id,
    tf.id as legacy_field_id,
    tf.name as field_key,
    tf.field_type_id as field_type,
    tf.label,
    tf.description,
    (tf.config->>'placeholder')::text as placeholder,
    (tf.config->>'required')::boolean as required,
    COALESCE(tf.validation, '{}'::jsonb) as validation,
    COALESCE(tf.config->'options', '[]'::jsonb) as options,
    tf.position as sort_order,
    1 as version,
    tf.created_at,
    tf.updated_at
FROM table_fields tf
JOIN data_tables dt ON tf.table_id = dt.id
JOIN forms f ON f.legacy_table_id = dt.id
WHERE dt.hub_type = 'applications'
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 3: Migrate Submissions (table_rows → form_submissions)
-- ============================================
INSERT INTO form_submissions (
    id,
    form_id,
    user_id,
    legacy_row_id,
    status,
    completion_percentage,
    started_at,
    last_saved_at,
    submitted_at,
    form_version,
    workflow_id,
    assigned_reviewer_id,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid() as id,
    f.id as form_id,
    COALESCE(tr.ba_created_by, 'unknown') as user_id,
    tr.id as legacy_row_id,
    COALESCE((tr.metadata->>'status')::text, 'submitted') as status,
    COALESCE((tr.metadata->>'completion_percentage')::int, 100) as completion_percentage,
    tr.created_at as started_at,
    tr.updated_at as last_saved_at,
    COALESCE(
        (tr.metadata->>'submitted_at')::timestamptz,
        tr.created_at
    ) as submitted_at,
    1 as form_version,
    (tr.metadata->>'workflow_id')::uuid as workflow_id,
    (tr.metadata->>'assigned_reviewer_id')::text as assigned_reviewer_id,
    tr.created_at,
    tr.updated_at
FROM table_rows tr
JOIN data_tables dt ON tr.table_id = dt.id
JOIN forms f ON f.legacy_table_id = dt.id
WHERE dt.hub_type = 'applications'
  AND tr.ba_created_by IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 4: Migrate Responses (table_rows.data → form_responses)
-- ============================================
-- Parse JSONB data into normalized form_responses
-- This uses a function to iterate over each key-value pair
CREATE OR REPLACE FUNCTION migrate_row_data_to_responses() RETURNS void AS $$
DECLARE
    submission_rec RECORD;
    field_rec RECORD;
    field_value TEXT;
    value_type TEXT;
BEGIN
    -- For each form submission
    FOR submission_rec IN 
        SELECT 
            fs.id as submission_id,
            tr.data,
            f.id as form_id
        FROM form_submissions fs
        JOIN table_rows tr ON fs.legacy_row_id = tr.id
        JOIN forms f ON fs.form_id = f.id
        WHERE tr.data IS NOT NULL
    LOOP
        -- For each field in the form
        FOR field_rec IN
            SELECT id, field_key, field_type
            FROM form_fields
            WHERE form_id = submission_rec.form_id
        LOOP
            -- Get the value from the JSONB data
            field_value := submission_rec.data->>field_rec.field_key;
            
            IF field_value IS NOT NULL THEN
                -- Determine value type based on field_type
                value_type := CASE 
                    WHEN field_rec.field_type IN ('number', 'currency', 'percentage') THEN 'number'
                    WHEN field_rec.field_type IN ('checkbox', 'toggle') THEN 'boolean'
                    WHEN field_rec.field_type = 'date' THEN 'date'
                    WHEN field_rec.field_type IN ('datetime', 'timestamp') THEN 'datetime'
                    WHEN field_rec.field_type IN ('select', 'multi-select', 'file', 'repeater') THEN 'json'
                    ELSE 'text'
                END;
                
                -- Insert response based on value type
                INSERT INTO form_responses (
                    submission_id,
                    field_id,
                    value_type,
                    value_text,
                    value_number,
                    value_boolean,
                    value_date,
                    value_datetime,
                    value_json
                ) VALUES (
                    submission_rec.submission_id,
                    field_rec.id,
                    value_type,
                    CASE WHEN value_type = 'text' THEN field_value ELSE NULL END,
                    CASE WHEN value_type = 'number' THEN field_value::numeric ELSE NULL END,
                    CASE WHEN value_type = 'boolean' THEN field_value::boolean ELSE NULL END,
                    CASE WHEN value_type = 'date' THEN field_value::date ELSE NULL END,
                    CASE WHEN value_type = 'datetime' THEN field_value::timestamptz ELSE NULL END,
                    CASE WHEN value_type = 'json' THEN submission_rec.data->field_rec.field_key ELSE NULL END
                )
                ON CONFLICT (submission_id, field_id) DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration function
SELECT migrate_row_data_to_responses();

-- Drop the migration function
DROP FUNCTION migrate_row_data_to_responses();

-- ============================================
-- STEP 5: Create Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_forms_workspace ON forms(workspace_id);
CREATE INDEX IF NOT EXISTS idx_forms_slug ON forms(workspace_id, slug);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);
CREATE INDEX IF NOT EXISTS idx_forms_legacy_table ON forms(legacy_table_id);

CREATE INDEX IF NOT EXISTS idx_form_fields_form ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_sort ON form_fields(form_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_user ON form_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_legacy_row ON form_submissions(legacy_row_id);

CREATE INDEX IF NOT EXISTS idx_form_responses_submission ON form_responses(submission_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_field ON form_responses(field_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_value_text ON form_responses(value_text) WHERE value_type = 'text';

-- ============================================
-- STEP 6: Drop Legacy Tables
-- ============================================
-- Drop application_submissions (duplicate data)
DROP TABLE IF EXISTS submission_versions CASCADE;
DROP TABLE IF EXISTS application_submissions CASCADE;

-- Drop portal_applicants (deprecated)
DROP TABLE IF EXISTS portal_applicants CASCADE;

-- ============================================
-- STEP 7: Add Comments
-- ============================================
COMMENT ON TABLE forms IS 'Unified form definitions (replaces data_tables with hub_type=applications)';
COMMENT ON TABLE form_fields IS 'Form field definitions (replaces table_fields for forms)';
COMMENT ON TABLE form_submissions IS 'Form submissions (replaces table_rows for forms)';
COMMENT ON TABLE form_responses IS 'Normalized field responses (replaces JSONB data in table_rows)';

COMMIT;
