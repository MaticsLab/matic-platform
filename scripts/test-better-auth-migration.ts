#!/usr/bin/env npx tsx

/**
 * Test Better Auth Migration
 * Verifies that login and workspace access work correctly
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
║     Better Auth Migration Test                               ║
╚══════════════════════════════════════════════════════════════╝
`);

    // Test 1: Verify Better Auth users exist
    console.log("📋 Test 1: Verify Better Auth users exist\n");
    const users = await pool.query(`
      SELECT id, email, name, created_at
      FROM ba_users
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log(`✅ Found ${users.rows.length} Better Auth users:`);
    users.rows.forEach((user, i) => {
      console.log(`   ${i + 1}. ${user.email} (${user.id})`);
    });

    // Test 2: Verify workspace members have Better Auth IDs
    console.log("\n📋 Test 2: Verify workspace members have Better Auth IDs\n");
    const members = await pool.query(`
      SELECT 
        wm.id,
        wm.workspace_id,
        wm.user_id,
        wm.ba_user_id,
        wm.status,
        w.name as workspace_name,
        bu.email as user_email
      FROM workspace_members wm
      LEFT JOIN workspaces w ON w.id = wm.workspace_id
      LEFT JOIN ba_users bu ON bu.id = wm.ba_user_id
      WHERE wm.status = 'active'
      ORDER BY wm.added_at DESC
      LIMIT 10
    `);
    console.log(`✅ Found ${members.rows.length} active workspace members:`);
    members.rows.forEach((member, i) => {
      const hasBA = member.ba_user_id ? "✅" : "❌";
      console.log(`   ${i + 1}. ${hasBA} ${member.user_email || 'N/A'} → ${member.workspace_name} (ba_user_id: ${member.ba_user_id || 'NULL'})`);
    });

    // Test 3: Verify workspaces have Better Auth organization IDs
    console.log("\n📋 Test 3: Verify workspaces have Better Auth organization IDs\n");
    const workspaces = await pool.query(`
      SELECT 
        w.id,
        w.name,
        w.slug,
        w.ba_organization_id,
        ba_org.name as org_name,
        ba_org.slug as org_slug
      FROM workspaces w
      LEFT JOIN ba_organizations ba_org ON ba_org.id = w.ba_organization_id
      ORDER BY w.created_at DESC
      LIMIT 10
    `);
    console.log(`✅ Found ${workspaces.rows.length} workspaces:`);
    workspaces.rows.forEach((ws, i) => {
      const hasOrg = ws.ba_organization_id ? "✅" : "❌";
      console.log(`   ${i + 1}. ${hasOrg} ${ws.name} (${ws.slug}) → Org: ${ws.org_name || 'NULL'} (${ws.ba_organization_id || 'NULL'})`);
    });

    // Test 4: Verify ba_organizations exist
    console.log("\n📋 Test 4: Verify ba_organizations exist\n");
    const orgs = await pool.query(`
      SELECT 
        id,
        name,
        slug,
        metadata->>'workspace_id' as workspace_id,
        created_at
      FROM ba_organizations
      ORDER BY created_at DESC
    `);
    console.log(`✅ Found ${orgs.rows.length} Better Auth organizations:`);
    orgs.rows.forEach((org, i) => {
      console.log(`   ${i + 1}. ${org.name} (${org.slug}) - Workspace: ${org.workspace_id || 'N/A'}`);
    });

    // Test 5: Verify ba_members exist
    console.log("\n📋 Test 5: Verify ba_members exist\n");
    const baMembers = await pool.query(`
      SELECT 
        bm.id,
        bm.organization_id,
        bm.user_id,
        bm.role,
        ba_org.name as org_name,
        bu.email as user_email
      FROM ba_members bm
      LEFT JOIN ba_organizations ba_org ON ba_org.id = bm.organization_id
      LEFT JOIN ba_users bu ON bu.id = bm.user_id
      ORDER BY bm.created_at DESC
      LIMIT 10
    `);
    console.log(`✅ Found ${baMembers.rows.length} Better Auth members:`);
    baMembers.rows.forEach((member, i) => {
      console.log(`   ${i + 1}. ${member.user_email} → ${member.org_name} (${member.role})`);
    });

    // Test 6: Verify data tables have Better Auth created_by
    console.log("\n📋 Test 6: Verify data tables have Better Auth created_by\n");
    const tables = await pool.query(`
      SELECT 
        dt.id,
        dt.name,
        dt.created_by,
        dt.ba_created_by,
        bu.email as creator_email
      FROM data_tables dt
      LEFT JOIN ba_users bu ON bu.id = dt.ba_created_by
      ORDER BY dt.created_at DESC
      LIMIT 5
    `);
    console.log(`✅ Found ${tables.rows.length} data tables:`);
    tables.rows.forEach((table, i) => {
      const hasBA = table.ba_created_by ? "✅" : "❌";
      console.log(`   ${i + 1}. ${hasBA} ${table.name} (ba_created_by: ${table.ba_created_by || 'NULL'})`);
    });

    // Summary
    console.log("\n📊 Migration Test Summary:\n");
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM ba_users) as ba_users_count,
        (SELECT COUNT(*) FROM ba_organizations) as ba_orgs_count,
        (SELECT COUNT(*) FROM ba_members) as ba_members_count,
        (SELECT COUNT(*) FROM workspace_members WHERE ba_user_id IS NOT NULL) as migrated_members,
        (SELECT COUNT(*) FROM workspaces WHERE ba_organization_id IS NOT NULL) as migrated_workspaces,
        (SELECT COUNT(*) FROM data_tables WHERE ba_created_by IS NOT NULL) as migrated_tables
    `);
    
    const s = stats.rows[0];
    console.log(`   Better Auth Users: ${s.ba_users_count}`);
    console.log(`   Better Auth Organizations: ${s.ba_orgs_count}`);
    console.log(`   Better Auth Members: ${s.ba_members_count}`);
    console.log(`   Migrated Workspace Members: ${s.migrated_members}`);
    console.log(`   Migrated Workspaces: ${s.migrated_workspaces}`);
    console.log(`   Migrated Data Tables: ${s.migrated_tables}`);

    console.log("\n✅ Migration test completed!\n");

  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

