#!/bin/bash

# Test Migration Script on Staging Database
# This script helps you safely test the portal_applicants migration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Migration: portal_applicants → ba_users${NC}"
echo "=========================================="
echo ""

# Check if .env.staging exists
if [ ! -f ".env.staging" ]; then
    echo -e "${RED}❌ .env.staging not found${NC}"
    echo "   Please create .env.staging with your staging DATABASE_URL"
    echo "   See docs/migrations/STAGING_DATABASE_SETUP.md for details"
    exit 1
fi

# Load environment variables
source .env.staging

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ] || [[ "$DATABASE_URL" == *"[YOUR-PASSWORD]"* ]] || [[ "$DATABASE_URL" == *"xxxxx"* ]]; then
    echo -e "${RED}❌ DATABASE_URL not properly configured in .env.staging${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment loaded${NC}"
echo ""

# Test connection
echo "🔌 Testing database connection..."
if ! psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${RED}❌ Database connection failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Connected to staging database${NC}"
echo ""

# Pre-migration snapshot
echo -e "${BLUE}📸 Taking pre-migration snapshot...${NC}"
psql "$DATABASE_URL" -c "
SELECT 
    'portal_applicants' as table_name,
    COUNT(*) as total_count,
    COUNT(DISTINCT email) as unique_emails
FROM portal_applicants;
" > /tmp/pre_migration_snapshot.txt 2>&1 || echo "⚠️  portal_applicants table may not exist"

cat /tmp/pre_migration_snapshot.txt
echo ""

# Check if migration already ran
echo -e "${BLUE}🔍 Checking migration status...${NC}"
MIGRATION_STATUS=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) 
FROM portal_applicants 
WHERE ba_user_id IS NOT NULL;
" 2>/dev/null | xargs)

if [ "$MIGRATION_STATUS" != "0" ] && [ ! -z "$MIGRATION_STATUS" ]; then
    echo -e "${YELLOW}⚠️  Migration appears to have already run (${MIGRATION_STATUS} records linked)${NC}"
    read -p "Do you want to continue? This will skip already migrated records. (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# Verify prerequisites
echo -e "${BLUE}✅ Checking prerequisites...${NC}"

# Check if ba_users table exists
if ! psql "$DATABASE_URL" -c "SELECT 1 FROM ba_users LIMIT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ ba_users table does not exist${NC}"
    echo "   Please run migration 029_better_auth.sql first"
    exit 1
fi

# Check if ba_accounts table exists
if ! psql "$DATABASE_URL" -c "SELECT 1 FROM ba_accounts LIMIT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ ba_accounts table does not exist${NC}"
    echo "   Please run migration 029_better_auth.sql first"
    exit 1
fi

# Check if portal_applicants table exists
if ! psql "$DATABASE_URL" -c "SELECT 1 FROM portal_applicants LIMIT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ portal_applicants table does not exist${NC}"
    echo "   Please run migration 017_portal_applicants.sql first"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Show what will be migrated
echo -e "${BLUE}📊 Data to be migrated:${NC}"
psql "$DATABASE_URL" -c "
SELECT 
    COUNT(*) as total_portal_applicants,
    COUNT(DISTINCT email) as unique_emails,
    COUNT(CASE WHEN password_hash IS NOT NULL AND password_hash != '' THEN 1 END) as with_passwords
FROM portal_applicants;
"

echo ""
read -p "Ready to run migration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled"
    exit 0
fi

# Run migration in a transaction
echo ""
echo -e "${BLUE}🔄 Running migration...${NC}"
echo ""

# Check if migration file exists
MIGRATION_FILE="docs/migrations/041_migrate_portal_applicants_to_ba_users.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

# Run migration
if psql "$DATABASE_URL" -f "$MIGRATION_FILE"; then
    echo ""
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}❌ Migration failed${NC}"
    echo "   Check the error messages above"
    exit 1
fi

# Post-migration verification
echo ""
echo -e "${BLUE}🔍 Running verification queries...${NC}"
echo ""

psql "$DATABASE_URL" -f scripts/verify-staging-migration.sql

echo ""
echo -e "${GREEN}✨ Migration test complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "   1. Review the verification results above"
echo "   2. Test your application against staging database"
echo "   3. If everything looks good, apply to production"
echo ""
