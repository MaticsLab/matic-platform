# Removing student_information Field

The `student_information` field is being removed from the database. Here are three ways to do it:

## Option 1: Use the SQL Migration (Recommended for Production)

Run the migration file directly on your database:

```bash
# Using Supabase CLI
supabase migration up

# Or manually via psql
psql $DATABASE_URL -f supabase/migrations/20260130_remove_student_information_field.sql
```

## Option 2: Use the API Endpoint

The backend has been updated with a cleanup endpoint:

```bash
# Run the cleanup script
./scripts/remove-student-information.sh

# Or call the API directly
curl -X POST \
  http://localhost:8080/api/v1/admin/cleanup/remove-student-information \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

## Option 3: Run SQL Directly

If you have direct database access:

```sql
UPDATE table_rows
SET data = data - 'student_information'
WHERE data ? 'student_information';
```

## What This Does

- Removes the `student_information` key from the JSONB `data` column in `table_rows`
- Only affects rows that have this key
- Uses PostgreSQL's JSONB `-` operator to remove the key
- The frontend has also been updated to filter out empty fields

## Verification

After running the cleanup, verify it worked:

```sql
-- Check if any rows still have student_information
SELECT COUNT(*) 
FROM table_rows 
WHERE data ? 'student_information';

-- Should return 0
```

## Files Changed

1. **Backend:**
   - `go-backend/handlers/data_cleanup.go` - New cleanup handlers
   - `go-backend/router/router.go` - Added admin cleanup endpoints

2. **Frontend:**
   - `src/components/ApplicationsHub/Applications/Review/v2/ApplicationDetail.tsx` - Filters empty fields

3. **Database:**
   - `supabase/migrations/20260130_remove_student_information_field.sql` - Migration script

4. **Scripts:**
   - `scripts/remove-student-information.sh` - Convenient cleanup script
