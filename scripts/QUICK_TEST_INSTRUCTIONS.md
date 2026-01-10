# Quick Test Instructions

## Option 1: Using the Interactive Script

Run the interactive script - it will guide you through everything:

```bash
./scripts/run-migration-test.sh
```

When prompted, paste your staging database connection string from Supabase.

## Option 2: Manual Setup

### Step 1: Get Your Staging Database URL

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your **staging project** (or create one)
3. Go to **Settings** → **Database**
4. Scroll to **Connection string** section
5. Copy the **URI** connection string
6. Replace `[YOUR-PASSWORD]` with your actual database password

### Step 2: Create .env.staging

```bash
# Create .env.staging file
cat > .env.staging << 'EOF'
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
EOF
```

### Step 3: Run the Test

```bash
./scripts/test-migration-staging.sh
```

## Option 3: Direct SQL (Supabase Dashboard)

1. Go to your staging project → **SQL Editor**
2. Open `docs/migrations/041_migrate_portal_applicants_to_ba_users.sql`
3. Copy the entire SQL script
4. Paste into SQL Editor
5. Click **Run**
6. Run verification queries from `scripts/verify-staging-migration.sql`

## What You Need

- ✅ Staging Supabase project created
- ✅ Base migrations run (017, 029, 034, 040)
- ✅ Test data in `portal_applicants` table (optional)
- ✅ Database connection string

## Quick Verification

After running, check:

```sql
-- Should show migrated users
SELECT COUNT(*) FROM ba_users WHERE user_type = 'applicant';

-- Should show linked records
SELECT COUNT(*) FROM portal_applicants WHERE ba_user_id IS NOT NULL;
```
