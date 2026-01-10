# Migration Plan: portal_applicants → ba_users

## Overview
Migrate all users from `portal_applicants` table to Better Auth (`ba_users`) system with user_type `'applicant'`.

## Current State

### portal_applicants Table Structure
- `id` (UUID) - Primary key
- `form_id` (UUID) - References table_views(id)
- `email` (VARCHAR) - User email (can have multiple entries per email, one per form)
- `password_hash` (VARCHAR) - Bcrypt hashed password
- `full_name` (VARCHAR) - User's full name
- `submission_data` (JSONB) - Form submission data
- `row_id` (UUID) - Links to table_rows (submission)
- `last_login_at` (TIMESTAMP) - Last login time
- `created_at`, `updated_at` (TIMESTAMP)

### Better Auth Tables Structure

#### ba_users
- `id` (TEXT) - Primary key (UUID as text)
- `email` (TEXT) - UNIQUE
- `name` (TEXT) - Display name
- `full_name` (TEXT) - Full name
- `email_verified` (BOOLEAN)
- `user_type` (VARCHAR) - 'staff', 'applicant', 'reviewer'
- `metadata` (JSONB) - Flexible data storage
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### ba_accounts
- `id` (TEXT) - Primary key
- `account_id` (TEXT) - Email for credential auth
- `provider_id` (TEXT) - 'credential' for email/password
- `user_id` (TEXT) - References ba_users(id)
- `password` (TEXT) - Hashed password (scrypt format)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### ba_sessions
- `id` (TEXT) - Primary key
- `user_id` (TEXT) - References ba_users(id)
- `token` (TEXT) - Session token
- `expires_at` (TIMESTAMPTZ)
- Other session metadata

## Migration Strategy

### Key Considerations

1. **One-to-Many Relationship**: One email can have multiple `portal_applicants` entries (one per form)
   - **Solution**: Create ONE `ba_user` per unique email
   - Store all form relationships in `ba_users.metadata`

2. **Password Hash Format**: 
   - `portal_applicants.password_hash` uses Bcrypt
   - `ba_accounts.password` expects Scrypt (Better Auth format)
   - **Solution**: Migrate Bcrypt hash as-is, Better Auth will handle conversion on first login

3. **Backward Compatibility**:
   - Keep `portal_applicants` table intact
   - Add `ba_user_id` column to link back to `ba_users`
   - Existing code can continue using `portal_applicants` while we migrate

4. **Data Preservation**:
   - All `portal_applicants` data preserved
   - Form relationships stored in `ba_users.metadata`
   - `row_id` links maintained

## Migration Steps

### Step 1: Preparation
- Add `ba_user_id` column to `portal_applicants` for linking
- Create index on `ba_user_id`

### Step 2: Migrate Users
- For each unique email in `portal_applicants`:
  - Create `ba_user` with `user_type = 'applicant'`
  - Use earliest `created_at` as user creation date
  - Store all form IDs and portal_applicant IDs in `metadata`

### Step 3: Link Records
- Update `portal_applicants.ba_user_id` to point to corresponding `ba_user`

### Step 4: Create Accounts
- For each migrated user:
  - Create `ba_account` entry with `provider_id = 'credential'`
  - Use most recent `password_hash` (in case user changed password)
  - Link to `ba_user` via `user_id`

### Step 5: Update References
- Update `table_rows.ba_created_by` where `row_id` matches `portal_applicants.row_id`
- Update `table_rows.ba_updated_by` similarly

### Step 6: Enrich Metadata
- Update `ba_users.metadata` with detailed form relationships
- Include submission data, row_ids, form_ids for each form

## Post-Migration

### Code Updates Required

1. **Authentication Flow**:
   - Update portal login to check `ba_users` + `ba_accounts` instead of `portal_applicants`
   - Use Better Auth session management

2. **CRM Query**:
   - Already updated to query `ba_users` with `user_type = 'applicant'`
   - Can now remove `portal_applicants` query

3. **Form Submission**:
   - Update to link submissions to `ba_users.id` instead of `portal_applicants.id`
   - Use `ba_created_by` in `table_rows`

4. **Portal Dashboard**:
   - Update to fetch user data from `ba_users` + `ba_accounts`
   - Use Better Auth session validation

### Verification Queries

```sql
-- Count migrated users
SELECT COUNT(*) as migrated_users 
FROM ba_users 
WHERE user_type = 'applicant' 
AND metadata->>'migrated_from_portal_applicants' = 'true';

-- Count users with accounts
SELECT COUNT(*) as users_with_accounts 
FROM ba_accounts 
WHERE provider_id = 'credential' 
AND user_id IN (
    SELECT id FROM ba_users WHERE user_type = 'applicant'
);

-- Count linked portal_applicants
SELECT COUNT(*) as linked_applicants 
FROM portal_applicants 
WHERE ba_user_id IS NOT NULL;

-- Check for unmigrated applicants
SELECT COUNT(*) as unmigrated 
FROM portal_applicants 
WHERE ba_user_id IS NULL;
```

## Rollback Plan

If migration needs to be rolled back:

1. Clear `ba_user_id` links in `portal_applicants`
2. Delete `ba_accounts` entries for migrated users
3. Delete `ba_users` entries with `migrated_from_portal_applicants = true`
4. Clear `table_rows.ba_created_by/ba_updated_by` references

**Note**: `portal_applicants` data is never deleted, so rollback is safe.

## Testing Checklist

- [ ] Run migration on staging database
- [ ] Verify all unique emails migrated to `ba_users`
- [ ] Verify password hashes migrated to `ba_accounts`
- [ ] Verify `portal_applicants.ba_user_id` populated
- [ ] Verify `table_rows.ba_created_by` updated
- [ ] Test portal login with migrated users
- [ ] Test CRM shows migrated users
- [ ] Test form submission links to migrated users
- [ ] Verify metadata contains all form relationships

## Timeline Estimate

- **Migration Script**: 1-2 hours
- **Code Updates**: 2-3 hours
- **Testing**: 2-3 hours
- **Total**: ~1 day

## Risk Assessment

**Low Risk**:
- `portal_applicants` data preserved
- Backward compatible (can query both tables)
- Rollback plan available

**Medium Risk**:
- Password hash format difference (Bcrypt vs Scrypt)
  - **Mitigation**: Better Auth handles conversion on first login
- Multiple forms per email
  - **Mitigation**: Stored in metadata, can query both ways

**High Risk**:
- None identified
