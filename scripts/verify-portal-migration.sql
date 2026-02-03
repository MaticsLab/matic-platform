-- Verify Portal Migration to New Schema
-- This script checks that portal submissions are being saved to form_responses

-- 1. Check recent submissions in NEW schema (should have data after migration)
SELECT 
    'NEW SCHEMA (form_submissions + form_responses)' as schema_type,
    fs.id,
    ba.email,
    f.name as form_name,
    fs.status,
    COUNT(fr.id) as response_count,
    fs.created_at,
    fs.updated_at
FROM form_submissions fs
JOIN ba_users ba ON ba.id = fs.user_id
JOIN forms f ON f.id = fs.form_id
LEFT JOIN form_responses fr ON fr.submission_id = fs.id
WHERE ba.user_type = 'applicant'
GROUP BY fs.id, ba.email, f.name, fs.status, fs.created_at, fs.updated_at
ORDER BY fs.updated_at DESC
LIMIT 10;

-- 2. Check recent submissions in OLD schema (for comparison)
SELECT 
    'OLD SCHEMA (table_rows)' as schema_type,
    tr.id,
    tr.data->>'_applicant_email' as email,
    dt.name as form_name,
    tr.metadata->>'status' as status,
    NULL as response_count,
    tr.created_at,
    tr.updated_at
FROM table_rows tr
JOIN data_tables dt ON dt.id = tr.table_id
WHERE dt.hub_type = 'data'
  AND tr.ba_created_by IS NOT NULL
ORDER BY tr.updated_at DESC
LIMIT 10;

-- 3. Check for submissions with 0 responses (need migration)
SELECT 
    'NEEDS MIGRATION' as status,
    fs.id as submission_id,
    ba.email,
    f.name as form_name,
    fs.created_at
FROM form_submissions fs
JOIN ba_users ba ON ba.id = fs.user_id
JOIN forms f ON f.id = fs.form_id
WHERE NOT EXISTS (
    SELECT 1 FROM form_responses fr WHERE fr.submission_id = fs.id
)
AND ba.user_type = 'applicant'
ORDER BY fs.created_at DESC;

-- 4. Summary statistics
SELECT 
    'MIGRATION SUMMARY' as report,
    (SELECT COUNT(*) FROM form_submissions WHERE user_id IN (SELECT id FROM ba_users WHERE user_type = 'applicant')) as total_submissions,
    (SELECT COUNT(DISTINCT submission_id) FROM form_responses WHERE submission_id IN (SELECT id FROM form_submissions WHERE user_id IN (SELECT id FROM ba_users WHERE user_type = 'applicant'))) as submissions_with_responses,
    (SELECT COUNT(*) FROM form_responses WHERE submission_id IN (SELECT id FROM form_submissions WHERE user_id IN (SELECT id FROM ba_users WHERE user_type = 'applicant'))) as total_responses;
