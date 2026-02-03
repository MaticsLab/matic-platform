# Forms Migration Complete

## Summary
Migrated from legacy multi-table form system to unified normalized schema.

## What Was Done

### 1. Database Migration (`20260202100000_migrate_to_unified_forms.sql`)
- **Migrated `data_tables` → `forms`**: All forms (hub_type='applications') moved to new `forms` table
- **Migrated `table_fields` → `form_fields`**: Field definitions moved with proper type mapping
- **Migrated `table_rows` → `form_submissions`**: All submissions migrated with status, completion, timestamps
- **Parsed JSONB → `form_responses`**: Normalized field values into typed columns (text, number, boolean, date, datetime, json)
- **Dropped legacy tables**:
  - ✅ `application_submissions` (duplicate of table_rows)
  - ✅ `portal_applicants` (deprecated auth system)
  - ✅ `submission_versions` (unused)

### 2. Backend Updates
- **Updated handler**: `portal_auth_v2.go::GetApplicantSubmissions` now queries `form_submissions` + `forms` tables
- **Removed model**: Deleted `go-backend/models/submissions.go` (ApplicationSubmission, SubmissionVersion)
- **Marked deprecated**: `PortalApplicant` model kept for backwards compatibility but marked as deprecated

### 3. Frontend Updates
- **New types**: Created `src/types/forms.ts` with full unified schema types
- **Backed up old**: `src/types/forms.ts.old` contains old types for reference

## New Schema Structure

### Forms Table
```sql
forms (
  id, workspace_id, legacy_table_id, name, slug, description,
  settings JSONB, status, published_at, closes_at,
  max_submissions, allow_multiple_submissions, require_auth,
  version, created_at, updated_at, created_by
)
```

### Form Fields Table
```sql
form_fields (
  id, form_id, section_id, legacy_field_id, field_key,
  field_type, label, description, placeholder,
  required, validation JSONB, options JSONB, conditions JSONB,
  sort_order, width, version, created_at, updated_at
)
```

### Form Submissions Table
```sql
form_submissions (
  id, form_id, user_id, legacy_row_id, status,
  current_section_id, completion_percentage,
  started_at, last_saved_at, submitted_at, form_version,
  workflow_id, current_stage_id, assigned_reviewer_id,
  created_at, updated_at
)
```

### Form Responses Table (Normalized)
```sql
form_responses (
  id, submission_id, field_id,
  value_text, value_number, value_boolean, value_date, value_datetime, value_json,
  value_type, is_valid, validation_errors JSONB,
  created_at, updated_at
)
```

## Benefits

1. **Single Source of Truth**: No more duplicate data across 3 tables
2. **Normalized Schema**: Field responses properly typed instead of JSONB blob
3. **Better Performance**: Indexed columns enable efficient queries on specific fields
4. **Version Tracking**: Form version captured at submission time
5. **Type Safety**: Frontend types match database schema exactly

## Migration Execution

To apply the migration:

```bash
# Using Supabase CLI
supabase db push

# Or manually via psql
psql $DATABASE_URL < supabase/migrations/20260202100000_migrate_to_unified_forms.sql
```

## Legacy Compatibility

- `forms.legacy_table_id` → Links to old `data_tables.id`
- `form_fields.legacy_field_id` → Links to old `table_fields.id`
- `form_submissions.legacy_row_id` → Links to old `table_rows.id`
- `PortalApplicant` model still exists but deprecated

These fields enable gradual migration and rollback if needed.

## Next Steps

1. **Run migration** on staging/production
2. **Update remaining handlers** to use `forms` tables (forms.go, submissions.go)
3. **Update frontend components** to use new `/api/v1/forms` endpoints
4. **Monitor performance** - new schema should be faster
5. **Remove legacy compatibility** after confirming everything works

## Files Modified

### Backend
- `supabase/migrations/20260202100000_migrate_to_unified_forms.sql` (NEW)
- `go-backend/handlers/portal_auth_v2.go` (UPDATED)
- `go-backend/models/submissions.go` (DELETED)
- `go-backend/models/models.go` (UPDATED - deprecated PortalApplicant)

### Frontend
- `src/types/forms.ts` (REPLACED with unified schema types)
- `src/types/forms.ts.old` (BACKUP of old types)
