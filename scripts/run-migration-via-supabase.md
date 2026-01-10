# Run Migration via Supabase Dashboard

Since the MCP connection isn't available yet, here's how to test the migration directly in Supabase:

## Step 1: Check Prerequisites

1. Go to your Supabase project: https://supabase.com/dashboard/project/bpvdnphvunezonyrjwub
2. Open **SQL Editor**
3. Copy and paste the contents of `scripts/check-migration-prerequisites.sql`
4. Click **Run**
5. Verify all checks show ✅

## Step 2: Run the Migration

1. In the same SQL Editor, open a **New Query**
2. Open `docs/migrations/041_migrate_portal_applicants_to_ba_users.sql` in your editor
3. Copy the **entire SQL script** (all 210 lines)
4. Paste into Supabase SQL Editor
5. Click **Run** (or press Cmd/Ctrl + Enter)

## Step 3: Verify Results

1. Open another **New Query** in SQL Editor
2. Copy and paste the contents of `scripts/verify-staging-migration.sql`
3. Click **Run**
4. Review the results

## Expected Output

After successful migration, you should see:
- ✅ All unique emails from `portal_applicants` in `ba_users`
- ✅ All `portal_applicants` have `ba_user_id` populated
- ✅ All users with passwords have `ba_accounts` entries
- ✅ `table_rows.ba_created_by` updated where applicable

## Quick Verification Query

```sql
SELECT 
    'Migration Status' as report,
    (SELECT COUNT(*) FROM portal_applicants) as total_applicants,
    (SELECT COUNT(DISTINCT email) FROM portal_applicants) as unique_emails,
    (SELECT COUNT(*) FROM portal_applicants WHERE ba_user_id IS NOT NULL) as linked_count,
    (SELECT COUNT(*) FROM ba_users WHERE user_type = 'applicant' AND metadata->>'migrated_from_portal_applicants' = 'true') as migrated_users,
    (SELECT COUNT(*) FROM ba_accounts WHERE provider_id = 'credential' AND user_id IN (SELECT id FROM ba_users WHERE user_type = 'applicant')) as accounts_created;
```
