-- Migrate data from table_rows to form_responses for submissions without responses
-- This handles the case where form_submissions exist but form_responses are missing
-- 
-- IMPORTANT: table_rows.data uses UUID keys (table_fields.id) but form_fields uses semantic keys (field_key)
-- We need to map through table_fields to match them by name

-- Step 1: Find submissions without responses and their table_rows data
WITH submissions_without_responses AS (
    SELECT 
        fs.id as submission_id,
        fs.user_id,
        ba.email,
        f.id as form_id,
        f.name as form_name,
        tr.id as row_id,
        tr.table_id,
        tr.data,
        tr.created_at as row_created_at
    FROM form_submissions fs
    JOIN ba_users ba ON ba.id = fs.user_id
    JOIN forms f ON f.id = fs.form_id
    JOIN table_rows tr ON tr.ba_created_by = ba.id
    JOIN data_tables dt ON dt.id = tr.table_id
    WHERE dt.name = f.name
      AND NOT EXISTS (
          SELECT 1 FROM form_responses fr WHERE fr.submission_id = fs.id
      )
),
-- Step 2: Map old UUID keys to new semantic keys through table_fields
-- table_rows.data has keys like "140adb06-7fe5-42c7-8e59-a2bd90781491" (table_fields.id)
-- form_fields has keys like "preferred_name" (semantic name from table_fields.name)
field_value_pairs AS (
    SELECT 
        swr.submission_id,
        ff.id as field_id,
        ff.field_key,
        ff.field_type,
        tf.name as old_field_name,
        tf.id::text as old_field_uuid,
        swr.data->>tf.id::text as value,
        swr.row_created_at
    FROM submissions_without_responses swr
    JOIN table_fields tf ON tf.table_id = swr.table_id
    JOIN form_fields ff ON ff.form_id = swr.form_id AND ff.field_key = tf.name
    WHERE swr.data ? tf.id::text  -- Check if UUID key exists in data
      AND swr.data->>tf.id::text IS NOT NULL
      AND swr.data->>tf.id::text != ''
)
-- Step 3: Insert into form_responses with proper type casting
INSERT INTO form_responses (
    id,
    submission_id,
    field_id,
    value_type,
    value_text,
    value_number,
    value_boolean,
    value_json,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    fvp.submission_id,
    fvp.field_id,
    -- value_type: required field that indicates which value column to use
    CASE 
        WHEN fvp.field_type IN ('text', 'email', 'phone', 'dropdown', 'radio', 'textarea', 'url', 'select', 'heading') THEN 'text'
        WHEN fvp.field_type = 'number' THEN 'number'
        WHEN fvp.field_type = 'checkbox' THEN 'boolean'
        WHEN fvp.field_type = 'date' THEN 'date'
        WHEN fvp.field_type IN ('datetime', 'timestamp') THEN 'datetime'
        WHEN fvp.field_type IN ('json', 'repeater', 'array') THEN 'json'
        ELSE 'text'  -- Default to text for unknown types
    END,
    -- value_text: for text, email, phone, dropdown, radio, textarea
    CASE 
        WHEN fvp.field_type IN ('text', 'email', 'phone', 'dropdown', 'radio', 'textarea', 'url', 'date', 'time', 'select', 'heading')
        THEN fvp.value
        ELSE NULL
    END,
    -- value_number: for number fields
    CASE 
        WHEN fvp.field_type = 'number' AND fvp.value ~ '^[0-9.]+$'
        THEN fvp.value::numeric
        ELSE NULL
    END,
    -- value_boolean: for checkbox fields
    CASE 
        WHEN fvp.field_type = 'checkbox'
        THEN CASE 
            WHEN fvp.value IN ('true', 't', 'yes', '1', 'on') THEN TRUE
            WHEN fvp.value IN ('false', 'f', 'no', '0', 'off') THEN FALSE
            ELSE NULL
        END
        ELSE NULL
    END,
    -- value_json: for json, repeater, array fields
    CASE 
        WHEN fvp.field_type IN ('json', 'repeater', 'array')
        THEN fvp.value::jsonb
        ELSE NULL
    END,
    COALESCE(fvp.row_created_at, NOW()),
    NOW()
FROM field_value_pairs fvp
WHERE fvp.field_type != 'heading'  -- Don't create responses for heading fields
ON CONFLICT (submission_id, field_id) DO NOTHING;

-- Show results
SELECT 
    'Migration Summary' as report,
    COUNT(DISTINCT fs.id) as submissions_migrated,
    COUNT(*) as total_responses_created
FROM form_responses fr
JOIN form_submissions fs ON fs.id = fr.submission_id
WHERE fr.created_at > NOW() - INTERVAL '1 minute';
