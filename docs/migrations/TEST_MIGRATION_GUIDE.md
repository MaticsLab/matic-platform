# Testing Migration on Staging Database

This guide walks you through testing the `041_migrate_portal_applicants_to_ba_users.sql` migration on a staging database.

## Prerequisites

1. **Staging Supabase Project Created**
   - Follow [STAGING_DATABASE_SETUP.md](./STAGING_DATABASE_SETUP.md) to create your staging project
   - Or use Supabase's [Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments) guide

2. **Base Migrations Run**
   - `017_portal_applicants.sql` - Creates portal_applicants table
   - `029_better_auth.sql` - Creates ba_users, ba_accounts, ba_sessions tables
   - `034_migrate_all_tables_to_better_auth.sql` - Adds ba_* columns
   - `040_unified_auth_submissions.sql` - Adds user_type and metadata to ba_users

3. **Test Data Loaded (Optional)**
   - Load some portal_applicants data for testing
   - Or use production data export (see STAGING_DATABASE_SETUP.md)

## Quick Test (Automated)

### Step 1: Configure Environment

Create `.env.staging` in your project root:

```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

### Step 2: Run Test Script

```bash
./scripts/test-migration-staging.sh
```

The script will:
- ✅ Test database connection
- ✅ Check prerequisites
- ✅ Show data to be migrated
- ✅ Run the migration
- ✅ Verify results

## Manual Testing (Step-by-Step)

### Step 1: Connect to Staging Database

**Option A: Supabase SQL Editor**
1. Go to your staging project dashboard
2. Navigate to **SQL Editor**
3. Create a new query

**Option B: Command Line**
```bash
psql "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
```

### Step 2: Pre-Migration Check

Run these queries to see what will be migrated:

```sql
-- Count portal applicants
SELECT 
    COUNT(*) as total_applicants,
    COUNT(DISTINCT email) as unique_emails,
    COUNT(CASE WHEN password_hash IS NOT NULL AND password_hash != '' THEN 1 END) as with_passwords
FROM portal_applicants;

-- Check if migration already ran
SELECT 
    COUNT(*) as total,
    COUNT(ba_user_id) as already_migrated
FROM portal_applicants;
```

### Step 3: Run Migration

**In Supabase SQL Editor:**
1. Open `docs/migrations/041_migrate_portal_applicants_to_ba_users.sql`
2. Copy the entire SQL script
3. Paste into SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)

**Via Command Line:**
```bash
psql "$DATABASE_URL" -f docs/migrations/041_migrate_portal_applicants_to_ba_users.sql
```

### Step 4: Verify Results

Run the verification script:

```sql
-- In Supabase SQL Editor, run:
\i scripts/verify-staging-migration.sql

-- Or via command line:
psql "$DATABASE_URL" -f scripts/verify-staging-migration.sql
```

### Step 5: Manual Verification Queries

```sql
-- 1. Check migration counts
SELECT 
    'portal_applicants' as source,
    COUNT(*) as total,
    COUNT(ba_user_id) as linked
FROM portal_applicants
UNION ALL
SELECT 
    'ba_users (applicants)',
    COUNT(*),
    COUNT(CASE WHEN metadata->>'migrated_from_portal_applicants' = 'true' THEN 1 END)
FROM ba_users
WHERE user_type = 'applicant';

-- 2. Check for unmigrated records
SELECT 
    COUNT(*) as unmigrated_count,
    COUNT(DISTINCT email) as unmigrated_emails
FROM portal_applicants
WHERE ba_user_id IS NULL;

-- 3. Sample migrated user
SELECT 
    bu.email,
    bu.name,
    bu.user_type,
    bu.metadata->>'migrated_from_portal_applicants' as is_migrated,
    jsonb_array_length(bu.metadata->'form_ids') as form_count,
    ba.provider_id,
    CASE WHEN ba.password IS NOT NULL THEN 'Has password' ELSE 'No password' END as password_status
FROM ba_users bu
LEFT JOIN ba_accounts ba ON ba.user_id = bu.id AND ba.provider_id = 'credential'
WHERE bu.user_type = 'applicant'
AND bu.metadata->>'migrated_from_portal_applicants' = 'true'
LIMIT 5;

-- 4. Check table_rows references
SELECT 
    COUNT(*) as rows_with_ba_created_by
FROM table_rows
WHERE ba_created_by IN (
    SELECT id FROM ba_users WHERE user_type = 'applicant'
);
```

## Expected Results

After successful migration, you should see:

✅ **All unique emails** from `portal_applicants` have corresponding `ba_users` entries  
✅ **All `portal_applicants`** have `ba_user_id` populated  
✅ **All users with passwords** have `ba_accounts` entries  
✅ **All `table_rows`** linked via `row_id` have `ba_created_by` updated  
✅ **Metadata** contains form relationships  

## Testing Application

After migration, test your application:

### 1. Test CRM
- Navigate to CRM space
- Should show all migrated portal applicants
- Verify names, emails, creation dates display correctly

### 2. Test Portal Login
- Try logging in with a migrated user's email/password
- Should authenticate via Better Auth
- Session should be created in `ba_sessions`

### 3. Test Form Submission
- Submit a form as a migrated user
- Verify `table_rows.ba_created_by` is set correctly
- Check that submission links to the correct `ba_user`

## Troubleshooting

### Migration Fails with "relation does not exist"
- **Cause**: Prerequisite migrations not run
- **Fix**: Run base migrations first (017, 029, 034, 040)

### No users migrated
- **Cause**: No data in `portal_applicants` table
- **Fix**: Load test data first

### Duplicate email errors
- **Cause**: Email already exists in `ba_users` from another source
- **Fix**: Check existing `ba_users` entries and handle conflicts

### Password hash issues
- **Cause**: Password hash format mismatch (Bcrypt vs Scrypt)
- **Fix**: This is expected - Better Auth will handle conversion on first login

## Rollback (if needed)

If you need to rollback the migration:

```sql
-- 1. Clear ba_user_id links
UPDATE portal_applicants SET ba_user_id = NULL;

-- 2. Delete migrated accounts
DELETE FROM ba_accounts 
WHERE user_id IN (
    SELECT id FROM ba_users 
    WHERE metadata->>'migrated_from_portal_applicants' = 'true'
);

-- 3. Delete migrated users
DELETE FROM ba_users 
WHERE metadata->>'migrated_from_portal_applicants' = 'true';

-- 4. Clear table_rows references
UPDATE table_rows 
SET ba_created_by = NULL, ba_updated_by = NULL 
WHERE ba_created_by IN (
    SELECT id FROM ba_users 
    WHERE metadata->>'migrated_from_portal_applicants' = 'true'
);
```

## Next Steps

Once staging migration is verified:

1. ✅ Review all verification results
2. ✅ Test application functionality
3. ✅ Document any issues found
4. ✅ Apply to production (when ready)

## Using Supabase CLI (Recommended)

For better environment management, consider using Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to staging project
supabase link --project-ref your-staging-project-ref

# Create migration
supabase migration new migrate_portal_applicants

# Edit the migration file, then test locally
supabase db reset

# Push to staging
supabase db push
```

See [Supabase Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments) for full CI/CD setup.
