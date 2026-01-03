#!/usr/bin/env npx tsx

/**
 * Run the comprehensive Better Auth migration
 * This migrates all tables to use Better Auth user IDs and organizations
 */

import { readFileSync } from "fs";
import { Pool } from "pg";
import path from "path";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ Missing DATABASE_URL");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║   Comprehensive Better Auth Migration                        ║
║   Migrating all tables to use ba_users and ba_organizations  ║
╚══════════════════════════════════════════════════════════════╝
`);

    // Read migration SQL
    const migrationPath = path.join(
      __dirname,
      "../docs/migrations/034_migrate_all_tables_to_better_auth.sql"
    );
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("📋 Running migration SQL...\n");

    // Execute migration
    await pool.query(migrationSQL);

    console.log("✅ Migration completed successfully!\n");

    // Verify migration
    console.log("🔍 Verifying migration...\n");

    // Check ba_user_id columns
    const userColumns = await pool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name LIKE 'ba_%'
        AND table_name NOT LIKE 'ba_%'
      ORDER BY table_name, column_name
    `);

    console.log(`✅ Found ${userColumns.rows.length} Better Auth columns:\n`);
    for (const col of userColumns.rows) {
      console.log(`   ${col.table_name}.${col.column_name}`);
    }

    // Check ba_organizations
    const orgs = await pool.query(`
      SELECT COUNT(*) as count
      FROM ba_organizations
    `);
    console.log(`\n✅ Created ${orgs.rows[0].count} organizations in ba_organizations`);

    // Check ba_members
    const members = await pool.query(`
      SELECT COUNT(*) as count
      FROM ba_members
    `);
    console.log(`✅ Created ${members.rows[0].count} memberships in ba_members`);

    // Check workspaces with ba_organization_id
    const workspaces = await pool.query(`
      SELECT COUNT(*) as count
      FROM workspaces
      WHERE ba_organization_id IS NOT NULL
    `);
    console.log(`✅ Linked ${workspaces.rows[0].count} workspaces to ba_organizations`);

  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

