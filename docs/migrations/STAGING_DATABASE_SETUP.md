# Staging Database Setup Guide

## Overview
This guide will help you create a staging database in Supabase for testing migrations before applying them to production.

## Step 1: Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Click **"New Project"**
3. Fill in the details:
   - **Name**: `matic-platform-staging` (or your preferred name)
   - **Database Password**: Generate a strong password (save it securely!)
   - **Region**: Choose the same region as your production database
   - **Pricing Plan**: Free tier is fine for staging
4. Click **"Create new project"**
5. Wait for the project to be provisioned (2-3 minutes)

## Step 2: Get Database Connection String

1. In your Supabase project dashboard, go to **Settings** → **Database**
2. Scroll down to **Connection string** section
3. Copy the **URI** connection string (it looks like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with your actual database password

## Step 3: Set Up Environment Variables

Create a `.env.staging` file in your project root:

```bash
# Staging Database
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres

# Supabase Settings (for staging)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-staging-service-role-key

# Better Auth (use different secret for staging)
BETTER_AUTH_SECRET=matic-platform-better-auth-secret-key-2024-staging
BETTER_AUTH_URL=https://your-staging-domain.com

# Go Backend
PORT=8080
GIN_MODE=debug
```

## Step 4: Run Schema Migrations

You'll need to run all your existing migrations on the staging database. Here's the order:

### Option A: Using Supabase SQL Editor

1. Go to **SQL Editor** in Supabase dashboard
2. Run migrations in order:
   - `001_initial_schema.sql` (or your base schema)
   - `017_portal_applicants.sql`
   - `029_better_auth.sql`
   - `034_migrate_all_tables_to_better_auth.sql`
   - `040_unified_auth_submissions.sql`
   - Any other migrations you have

### Option B: Using psql Command Line

```bash
# Connect to staging database
psql "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"

# Or use the connection string directly
psql $DATABASE_URL
```

Then run each migration file:
```sql
\i docs/migrations/001_initial_schema.sql
\i docs/migrations/017_portal_applicants.sql
\i docs/migrations/029_better_auth.sql
-- etc.
```

## Step 5: Copy Production Data (Optional)

If you want to test with real data:

### Option A: Export/Import via Supabase Dashboard
1. Go to **Database** → **Backups** in production
2. Create a backup
3. Restore to staging (if supported)

### Option B: Use pg_dump/pg_restore
```bash
# Export from production
pg_dump "postgresql://postgres:[PROD-PASSWORD]@db.prod.supabase.co:5432/postgres" \
  --schema-only \
  --file=production_schema.sql

# Import to staging
psql "postgresql://postgres:[STAGING-PASSWORD]@db.staging.supabase.co:5432/postgres" \
  -f production_schema.sql

# Export data (selective tables)
pg_dump "postgresql://postgres:[PROD-PASSWORD]@db.prod.supabase.co:5432/postgres" \
  --data-only \
  --table=portal_applicants \
  --table=ba_users \
  --file=production_data.sql

# Import data to staging
psql "postgresql://postgres:[STAGING-PASSWORD]@db.staging.supabase.co:5432/postgres" \
  -f production_data.sql
```

## Step 6: Test Migration Script

1. Connect to staging database
2. Run the migration script:
   ```sql
   \i docs/migrations/041_migrate_portal_applicants_to_ba_users.sql
   ```
3. Run verification queries (included in the migration script)
4. Test your application against staging database

## Step 7: Update Backend Configuration

Update your `go-backend/.env.staging`:

```bash
DATABASE_URL=postgresql://postgres:[STAGING-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
PORT=8080
GIN_MODE=debug
```

## Verification Checklist

- [ ] Staging project created in Supabase
- [ ] Connection string obtained
- [ ] Environment variables configured
- [ ] All migrations run successfully
- [ ] Test data loaded (if needed)
- [ ] Backend can connect to staging database
- [ ] Migration script tested
- [ ] Application works with staging database

## Useful Commands

### Check table counts
```sql
SELECT 
  'portal_applicants' as table_name, 
  COUNT(*) as count 
FROM portal_applicants
UNION ALL
SELECT 
  'ba_users (applicants)', 
  COUNT(*) 
FROM ba_users 
WHERE user_type = 'applicant';
```

### Check migration status
```sql
SELECT 
  COUNT(*) as total_applicants,
  COUNT(ba_user_id) as migrated_count,
  COUNT(*) - COUNT(ba_user_id) as unmigrated_count
FROM portal_applicants;
```

### List all tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

## Troubleshooting

### Connection Issues
- Verify password is correct
- Check if IP is whitelisted (Supabase → Settings → Database → Connection Pooling)
- Try using connection pooling mode if direct connection fails

### Migration Errors
- Check if all prerequisite migrations have been run
- Verify table structures match expected schema
- Check for foreign key constraints

### Data Issues
- Verify data types match between production and staging
- Check for missing required columns
- Ensure indexes are created

## Next Steps

After staging is set up:
1. Test the migration script
2. Verify all data migrated correctly
3. Test application functionality
4. Once confident, apply to production
