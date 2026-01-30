-- Migration to remove student_information field from table_rows data
-- This removes empty student_information keys from the JSONB data column

-- Remove student_information key from all table_rows where it exists
UPDATE table_rows
SET data = data - 'student_information'
WHERE data ? 'student_information';

-- Optional: Log how many rows were affected
-- SELECT COUNT(*) as affected_rows 
-- FROM table_rows 
-- WHERE data ? 'student_information';
