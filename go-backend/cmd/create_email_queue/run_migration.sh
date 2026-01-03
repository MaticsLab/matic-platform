#!/bin/bash
set -e

cd "$(dirname "$0")/../.."

# Load .env file
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not found in .env file"
    exit 1
fi

echo "Running email_queue migration..."
psql "$DATABASE_URL" -f cmd/create_email_queue/migration.sql

echo "✅ Migration completed successfully!"

