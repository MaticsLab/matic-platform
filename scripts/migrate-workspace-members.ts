#!/usr/bin/env npx tsx

/**
 * Migrate workspace_members to use Better Auth user IDs
 * 
 * This script updates workspace_members.user_id from Supabase user IDs
 * to Better Auth user IDs by looking up the mapping in ba_users.supabase_user_id
 */

import { Pool } from "pg";

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
║     Workspace Members Migration to Better Auth User IDs      ║
╚══════════════════════════════════════════════════════════════╝
`);

    // Find all workspace_members that need migration
    const membersToMigrate = await pool.query(`
      SELECT 
        wm.id,
        wm.user_id as supabase_user_id,
        wm.workspace_id,
        wm.status,
        ba.id as better_auth_user_id,
        ba.email,
        w.name as workspace_name
      FROM workspace_members wm
      JOIN ba_users ba ON ba.supabase_user_id::text = wm.user_id::text
      LEFT JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id::text IN (
        SELECT supabase_user_id::text 
        FROM ba_users 
        WHERE supabase_user_id IS NOT NULL
      )
    `);

    console.log(`📊 Found ${membersToMigrate.rows.length} workspace memberships to migrate\n`);

    if (membersToMigrate.rows.length === 0) {
      console.log("✅ No memberships need migration - all are already using Better Auth user IDs");
      return;
    }

    let migrated = 0;
    let errors = 0;

    for (const member of membersToMigrate.rows) {
      try {
        // Check if a membership already exists with the Better Auth user ID
        const existing = await pool.query(
          `SELECT id FROM workspace_members 
           WHERE workspace_id = $1 AND user_id = $2`,
          [member.workspace_id, member.better_auth_user_id]
        );

        if (existing.rows.length > 0) {
          console.log(`⏭️  Skipping ${member.email} - workspace ${member.workspace_name || member.workspace_id}`);
          console.log(`   → Membership already exists with Better Auth user ID\n`);
          
          // Delete the old Supabase-based membership
          await pool.query(
            `DELETE FROM workspace_members WHERE id = $1`,
            [member.id]
          );
          console.log(`   ✅ Deleted duplicate Supabase-based membership\n`);
          continue;
        }

        // Update the membership to use Better Auth user ID
        await pool.query(
          `UPDATE workspace_members 
           SET user_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [member.better_auth_user_id, member.id]
        );

        console.log(`✅ Migrated: ${member.email}`);
        console.log(`   Workspace: ${member.workspace_name || member.workspace_id}`);
        console.log(`   Status: ${member.status}`);
        console.log(`   Old ID: ${member.supabase_user_id}`);
        console.log(`   New ID: ${member.better_auth_user_id}\n`);

        migrated++;
      } catch (error: any) {
        console.error(`❌ Failed to migrate membership for ${member.email}:`, error.message);
        errors++;
      }
    }

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    Migration Complete                         ║
╠══════════════════════════════════════════════════════════════╣
║  Total Found:        ${String(membersToMigrate.rows.length).padStart(5)}                              ║
║  Migrated:           ${String(migrated).padStart(5)}                              ║
║  Errors:             ${String(errors).padStart(5)}                              ║
╚══════════════════════════════════════════════════════════════╝
`);

    // Verify migration
    console.log("🔍 Verifying migration...\n");
    const remaining = await pool.query(`
      SELECT COUNT(*) as count
      FROM workspace_members wm
      WHERE wm.user_id::text IN (
        SELECT supabase_user_id::text 
        FROM ba_users 
        WHERE supabase_user_id IS NOT NULL
      )
    `);

    const remainingCount = parseInt(remaining.rows[0].count, 10);
    if (remainingCount > 0) {
      console.log(`⚠️  ${remainingCount} memberships still using Supabase user IDs`);
    } else {
      console.log("✅ All memberships migrated successfully!");
    }

  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

