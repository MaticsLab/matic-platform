-- Migrate newly-linked table_rows to form_submissions
INSERT INTO form_submissions (id, form_id, user_id, status, created_at, updated_at, legacy_row_id)
SELECT
  gen_random_uuid(),
  dt.id,
  tr.ba_created_by,
  'draft',
  tr.created_at,
  tr.updated_at,
  tr.id
FROM table_rows tr
JOIN data_tables dt ON dt.id = tr.table_id
WHERE dt.hub_type = 'data'
  AND tr.ba_created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM form_submissions fs
    WHERE fs.legacy_row_id = tr.id
  );

-- Show migrated submissions
SELECT 
  fs.id as submission_id,
  bu.email,
  f.name as form_name,
  fs.status,
  fs.created_at
FROM form_submissions fs
JOIN ba_users bu ON bu.id = fs.user_id
JOIN forms f ON f.id = fs.form_id
WHERE fs.updated_at >= NOW() - INTERVAL '2 minutes'
ORDER BY fs.updated_at DESC
LIMIT 15;
