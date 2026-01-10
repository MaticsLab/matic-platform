#!/bin/bash

# Setup Staging Database Script
# This script helps set up a staging database in Supabase

set -e

echo "🚀 Matic Platform - Staging Database Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql is not installed. Please install PostgreSQL client tools.${NC}"
    echo "   macOS: brew install postgresql"
    echo "   Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

# Check if .env.staging exists
if [ ! -f ".env.staging" ]; then
    echo -e "${YELLOW}⚠️  .env.staging not found. Creating template...${NC}"
    cat > .env.staging << EOF
# Staging Database Connection
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres

# Supabase Settings
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-staging-service-role-key

# Better Auth
BETTER_AUTH_SECRET=matic-platform-better-auth-secret-key-2024-staging
BETTER_AUTH_URL=https://your-staging-domain.com

# Go Backend
PORT=8080
GIN_MODE=debug
EOF
    echo -e "${GREEN}✅ Created .env.staging template${NC}"
    echo -e "${YELLOW}📝 Please edit .env.staging with your staging database credentials${NC}"
    exit 1
fi

# Load environment variables
source .env.staging

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ] || [[ "$DATABASE_URL" == *"[YOUR-PASSWORD]"* ]] || [[ "$DATABASE_URL" == *"xxxxx"* ]]; then
    echo -e "${RED}❌ DATABASE_URL not properly configured in .env.staging${NC}"
    echo "   Please update .env.staging with your actual Supabase connection string"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables loaded${NC}"
echo ""

# Test connection
echo "🔌 Testing database connection..."
if psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo "   Please check your DATABASE_URL in .env.staging"
    exit 1
fi

echo ""
echo "📊 Current database status:"
psql "$DATABASE_URL" -c "
SELECT 
    'portal_applicants' as table_name,
    COUNT(*) as row_count
FROM information_schema.tables t
LEFT JOIN portal_applicants pa ON t.table_name = 'portal_applicants'
WHERE t.table_schema = 'public' AND t.table_name = 'portal_applicants'
GROUP BY t.table_name
UNION ALL
SELECT 
    'ba_users',
    COUNT(*)
FROM information_schema.tables t
LEFT JOIN ba_users bu ON t.table_name = 'ba_users' AND bu.user_type = 'applicant'
WHERE t.table_schema = 'public' AND t.table_name = 'ba_users'
GROUP BY t.table_name;
" 2>/dev/null || echo "   Tables may not exist yet - this is normal for a fresh database"

echo ""
echo "📋 Migration files to run (in order):"
echo "   1. docs/migrations/001_initial_schema.sql (or your base schema)"
echo "   2. docs/migrations/017_portal_applicants.sql"
echo "   3. docs/migrations/029_better_auth.sql"
echo "   4. docs/migrations/034_migrate_all_tables_to_better_auth.sql"
echo "   5. docs/migrations/040_unified_auth_submissions.sql"
echo "   6. docs/migrations/041_migrate_portal_applicants_to_ba_users.sql (test migration)"
echo ""

read -p "Do you want to run migrations now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔄 Running migrations..."
    
    MIGRATION_DIR="docs/migrations"
    
    # List of migrations in order
    MIGRATIONS=(
        "017_portal_applicants.sql"
        "029_better_auth.sql"
        "034_migrate_all_tables_to_better_auth.sql"
        "040_unified_auth_submissions.sql"
    )
    
    for migration in "${MIGRATIONS[@]}"; do
        if [ -f "$MIGRATION_DIR/$migration" ]; then
            echo -e "${YELLOW}📄 Running $migration...${NC}"
            psql "$DATABASE_URL" -f "$MIGRATION_DIR/$migration" || {
                echo -e "${RED}❌ Migration $migration failed${NC}"
                echo "   Continuing with next migration..."
            }
        else
            echo -e "${YELLOW}⚠️  Migration file not found: $migration${NC}"
        fi
    done
    
    echo ""
    echo -e "${GREEN}✅ Base migrations completed${NC}"
    echo ""
    echo "🧪 Ready to test migration: 041_migrate_portal_applicants_to_ba_users.sql"
    echo "   Run it manually when ready:"
    echo "   psql \"\$DATABASE_URL\" -f docs/migrations/041_migrate_portal_applicants_to_ba_users.sql"
fi

echo ""
echo -e "${GREEN}✨ Staging database setup complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "   1. Load test data (optional)"
echo "   2. Run test migration: 041_migrate_portal_applicants_to_ba_users.sql"
echo "   3. Verify results with queries in the migration file"
echo "   4. Test your application against staging database"
