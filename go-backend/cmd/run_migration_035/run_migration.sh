#!/bin/bash
set -e

# Change to project root
cd "$(dirname "$0")/../../.."

# Load .env file
if [ -f go-backend/.env ]; then
    export $(grep -v '^#' go-backend/.env | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not found in .env file"
    exit 1
fi

echo "Running migration 035: Ensure all tables use Better Auth..."
psql "$DATABASE_URL" -f docs/migrations/035_ensure_all_tables_use_better_auth.sql

echo "✅ Migration 035 completed successfully!"

