#!/usr/bin/env npx tsx

import { Pool } from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

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
║   Migrating workspace_members to Better Auth User IDs         ║
╚══════════════════════════════════════════════════════════════╝
`);

    const sqlPath = resolve(process.cwd(), "docs/migrations/033_migrate_workspace_members_to_better_auth.sql");
    const sql = readFileSync(sqlPath, "utf-8");

    console.log("📋 Running migration SQL...\n");
    await pool.query(sql);

    console.log("✅ Migration completed successfully!\n");

    // Verify the migration
    console.log("🔍 Verifying migration...\n");
    const result = await pool.query(`
      SELECT 
        wm.id,
        wm.user_id,
        wm.ba_user_id,
        wm.workspace_id,
        wm.status,
        ba.email,
        w.name as workspace_name
      FROM workspace_members wm
      JOIN ba_users ba ON ba.id = wm.ba_user_id
      LEFT JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.status = 'active' AND wm.ba_user_id IS NOT NULL
      LIMIT 10
    `);

    console.log(`✅ Found ${result.rows.length} active workspace memberships with Better Auth user IDs:\n`);
    for (const row of result.rows) {
      console.log(`   ${row.email} → ${row.workspace_name || row.workspace_id} (${row.status})`);
    }

  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

