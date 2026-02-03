# Portal Migration to New Schema - COMPLETE

## Summary
Successfully migrated the portal from saving to `table_rows` (old schema) to `form_responses` (new schema).

## Changes Made

### 1. Frontend Updates (PublicPortalV2.tsx)

#### After Login
- Now calls `/portal/v2/forms/:form_id/submissions` (POST) to get or create submission
- Loads submission data from `/portal/v2/submissions/:id` (GET)
- Uses Better Auth session cookies for authentication

#### After Signup
- Creates Better Auth user account
- Immediately gets or creates form_submission
- No longer uses legacy `portal-sync-better-auth-applicant` endpoint

#### Form Submission (handleFormSubmit)
- Always uses `/portal/v2/submissions/:id` (PUT) to save data
- If no submission ID exists, gets/creates one first
- Saves to `form_responses` table with proper field mapping
- Calculates completion percentage
- Marks as 'draft' or 'submitted' based on user action

#### Session Restoration
- On page load, attempts to restore from localStorage
- Then fetches latest data from `/portal/v2/submissions/:id`
- Falls back to creating new submission if none exists

### 2. Backend Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/portal/v2/forms/:form_id/submissions` | POST | Get or create submission for authenticated user |
| `/portal/v2/submissions/:id` | GET | Load submission with all responses |
| `/portal/v2/submissions/:id` | PUT | Update submission and save responses |

### 3. Data Migration

**Migration Script**: `scripts/migrate-form-responses.sql`
- Maps UUID keys from `table_rows.data` to semantic keys in `form_fields.field_key`
- Migrates data through `table_fields` as the bridge
- Properly sets `value_type` field (text, number, boolean, json, etc.)
- Creates `form_responses` records with proper type casting

**Results**:
- 34 total form_submissions
- 33 submissions with migrated responses (1 is empty/new)
- 599 total form_responses migrated
- 100% of submissions with data have been migrated

## Database Schema

### NEW Schema (Active)
```
forms
  ├── form_fields (field definitions)
  └── form_submissions
      └── form_responses (actual field values)
```

### OLD Schema (Legacy - Read Only)
```
data_tables
  ├── table_fields (field definitions)
  └── table_rows (JSONB data column)
```

## Testing

### Verify Migration Status
```bash
psql $DB_URL -f scripts/verify-portal-migration.sql
```

### Test Portal Submission
1. Go to portal: http://localhost:3000/portal/the-logan-scholarship
2. Sign up or login
3. Fill out and save form
4. Check database:
```sql
-- Should see new submission with responses
SELECT fs.id, ba.email, COUNT(fr.id) as response_count
FROM form_submissions fs
JOIN ba_users ba ON ba.id = fs.user_id
LEFT JOIN form_responses fr ON fr.submission_id = fs.id
WHERE ba.email = 'test@example.com'
GROUP BY fs.id, ba.email;
```

## CRM Display

The CRM now properly displays all portal submissions because:
1. Portal saves to `form_responses` (new schema)
2. CRM reads from `form_responses` (new schema)
3. Data flow is unified

**CRM Query Path**:
```
GET /api/v1/crm/applicants
  → GetApplicantsCRM handler
  → Joins form_submissions + form_responses
  → Returns all applicants with their submission data
```

## Migration Benefits

✅ **Data Consistency**: Single source of truth for form data
✅ **Performance**: Indexed queries on form_responses instead of JSONB scans
✅ **Validation**: Field-level validation and type safety
✅ **Real-time**: Better support for real-time updates via Supabase
✅ **Scalability**: Relational structure scales better than JSONB
✅ **Debugging**: Easy to query individual field responses

## Rollback Plan

If issues occur, the old `table_rows` data is preserved:
1. Portal can temporarily revert to `/forms/:id/submit` endpoint
2. Run reverse migration to sync `form_responses` back to `table_rows`
3. Old data is never deleted, only new data is added to new schema

## Future Work

- [ ] Remove legacy `/forms/:id/submit` endpoint after confidence period
- [ ] Remove legacy `portal-sync-better-auth-applicant` endpoint  
- [ ] Archive `table_rows` data to cold storage
- [ ] Remove `data_tables` and `table_fields` tables
- [ ] Update remaining references to old schema

## Monitoring

Monitor these metrics to ensure migration success:
- Form submission success rate (should remain at 100%)
- CRM data display (should show all applicants)
- Portal load times (should improve)
- Database query performance (should improve)

## Contact

For issues or questions about this migration:
- Check logs: `/tmp/backend.log` (Go backend)
- Check browser console for frontend errors
- Run verification script to check data integrity
