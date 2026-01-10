#!/bin/bash

# Interactive Migration Test Script
# This will guide you through testing the migration on staging

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Migration Test: portal_applicants → ba_users            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check for .env.staging
if [ ! -f ".env.staging" ]; then
    echo -e "${YELLOW}📝 Setting up staging environment...${NC}"
    echo ""
    echo "To test the migration, we need your staging database connection string."
    echo ""
    echo "You can get this from Supabase:"
    echo "  1. Go to your staging project dashboard"
    echo "  2. Settings → Database"
    echo "  3. Copy the 'Connection string' (URI format)"
    echo ""
    echo "It should look like:"
    echo "  postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
    echo ""
    read -p "Enter your staging DATABASE_URL: " STAGING_DB_URL
    
    if [ -z "$STAGING_DB_URL" ]; then
        echo -e "${RED}❌ No connection string provided${NC}"
        exit 1
    fi
    
    # Create .env.staging
    cat > .env.staging << EOF
# Staging Database Connection
DATABASE_URL=$STAGING_DB_URL

# Supabase Settings (optional - add if needed)
# SUPABASE_URL=https://xxxxx.supabase.co
# SUPABASE_ANON_KEY=your-staging-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-staging-service-role-key

# Better Auth (optional - add if needed)
# BETTER_AUTH_SECRET=matic-platform-better-auth-secret-key-2024-staging
EOF
    
    echo -e "${GREEN}✅ Created .env.staging${NC}"
    echo ""
fi

# Load environment
source .env.staging

if [ -z "$DATABASE_URL" ] || [[ "$DATABASE_URL" == *"[YOUR-PASSWORD]"* ]] || [[ "$DATABASE_URL" == *"xxxxx"* ]]; then
    echo -e "${RED}❌ DATABASE_URL not properly configured${NC}"
    echo "   Please edit .env.staging with your actual connection string"
    exit 1
fi

# Test connection
echo -e "${BLUE}🔌 Testing database connection...${NC}"
if ! psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${RED}❌ Connection failed${NC}"
    echo "   Please check your DATABASE_URL in .env.staging"
    exit 1
fi
echo -e "${GREEN}✅ Connected successfully${NC}"
echo ""

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

MISSING_TABLES=()

if ! psql "$DATABASE_URL" -c "SELECT 1 FROM ba_users LIMIT 1;" > /dev/null 2>&1; then
    MISSING_TABLES+=("ba_users (run 029_better_auth.sql)")
fi

if ! psql "$DATABASE_URL" -c "SELECT 1 FROM ba_accounts LIMIT 1;" > /dev/null 2>&1; then
    MISSING_TABLES+=("ba_accounts (run 029_better_auth.sql)")
fi

if ! psql "$DATABASE_URL" -c "SELECT 1 FROM portal_applicants LIMIT 1;" > /dev/null 2>&1; then
    MISSING_TABLES+=("portal_applicants (run 017_portal_applicants.sql)")
fi

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing required tables:${NC}"
    for table in "${MISSING_TABLES[@]}"; do
        echo "   - $table"
    done
    echo ""
    echo "Please run the base migrations first. See STAGING_DATABASE_SETUP.md"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Show current state
echo -e "${BLUE}📊 Current database state:${NC}"
psql "$DATABASE_URL" -c "
SELECT 
    'portal_applicants' as source,
    COUNT(*) as total_records,
    COUNT(DISTINCT email) as unique_emails,
    COUNT(ba_user_id) as already_linked
FROM portal_applicants
UNION ALL
SELECT 
    'ba_users (applicants)',
    COUNT(*),
    COUNT(DISTINCT email),
    0
FROM ba_users
WHERE user_type = 'applicant';
"

echo ""

# Check if migration already ran
ALREADY_MIGRATED=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM portal_applicants WHERE ba_user_id IS NOT NULL;" 2>/dev/null | xargs)

if [ "$ALREADY_MIGRATED" != "0" ] && [ ! -z "$ALREADY_MIGRATED" ]; then
    echo -e "${YELLOW}⚠️  Migration appears partially complete (${ALREADY_MIGRATED} records already linked)${NC}"
    echo "   The migration script will skip already migrated records"
    echo ""
fi

# Confirm
echo -e "${CYAN}Ready to run migration?${NC}"
echo "   This will:"
echo "   • Create ba_users entries for unique emails"
echo "   • Create ba_accounts with password hashes"
echo "   • Link portal_applicants to ba_users"
echo "   • Update table_rows references"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi

# Run migration
echo ""
echo -e "${BLUE}🔄 Running migration...${NC}"
echo ""

MIGRATION_FILE="docs/migrations/041_migrate_portal_applicants_to_ba_users.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

# Run with output
if psql "$DATABASE_URL" -f "$MIGRATION_FILE" 2>&1; then
    echo ""
    echo -e "${GREEN}✅ Migration completed!${NC}"
else
    echo ""
    echo -e "${RED}❌ Migration failed - check errors above${NC}"
    exit 1
fi

# Verification
echo ""
echo -e "${BLUE}🔍 Verifying results...${NC}"
echo ""

psql "$DATABASE_URL" << 'EOF'
-- Summary
SELECT '=== MIGRATION SUMMARY ===' as report;

SELECT 
    'Portal Applicants' as metric,
    COUNT(*)::text as value
FROM portal_applicants
UNION ALL
SELECT 
    'Unique Emails',
    COUNT(DISTINCT email)::text
FROM portal_applicants
UNION ALL
SELECT 
    'Linked to ba_users',
    COUNT(DISTINCT ba_user_id)::text
FROM portal_applicants
WHERE ba_user_id IS NOT NULL
UNION ALL
SELECT 
    'ba_users (applicants)',
    COUNT(*)::text
FROM ba_users
WHERE user_type = 'applicant'
UNION ALL
SELECT 
    'ba_accounts (credential)',
    COUNT(*)::text
FROM ba_accounts
WHERE provider_id = 'credential'
AND user_id IN (SELECT id FROM ba_users WHERE user_type = 'applicant')
UNION ALL
SELECT 
    'table_rows updated',
    COUNT(*)::text
FROM table_rows
WHERE ba_created_by IN (SELECT id FROM ba_users WHERE user_type = 'applicant');

-- Sample migrated user
SELECT '=== SAMPLE MIGRATED USER ===' as report;

SELECT 
    bu.email,
    bu.name,
    bu.user_type,
    jsonb_array_length(bu.metadata->'form_ids') as form_count,
    CASE WHEN ba.password IS NOT NULL THEN 'Yes' ELSE 'No' END as has_password
FROM ba_users bu
LEFT JOIN ba_accounts ba ON ba.user_id = bu.id AND ba.provider_id = 'credential'
WHERE bu.user_type = 'applicant'
AND bu.metadata->>'migrated_from_portal_applicants' = 'true'
LIMIT 3;
EOF

echo ""
echo -e "${GREEN}✨ Migration test complete!${NC}"
echo ""
echo -e "${CYAN}📝 Next steps:${NC}"
echo "   1. Review the results above"
echo "   2. Test CRM - should show migrated users"
echo "   3. Test portal login with migrated credentials"
echo "   4. If all good, apply to production"
echo ""
