#!/usr/bin/env npx tsx

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
    const workspaceId = '9a13130f-a0ec-47c9-8fe2-8254f9fcfa7e';
    
    console.log(`\n🔍 Checking workspace members for workspace: ${workspaceId}\n`);

    const result = await pool.query(`
      SELECT 
        wm.id,
        wm.user_id,
        wm.ba_user_id,
        wm.workspace_id,
        wm.status,
        ba.email,
        ba.id as ba_user_id_from_table,
        w.slug
      FROM workspace_members wm
      LEFT JOIN ba_users ba ON ba.id = wm.ba_user_id
      LEFT JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.workspace_id = $1
    `, [workspaceId]);

    console.log(`📊 Found ${result.rows.length} workspace members:\n`);
    
    for (const row of result.rows) {
      console.log(`Member ID: ${row.id}`);
      console.log(`  User ID (UUID): ${row.user_id}`);
      console.log(`  BA User ID (TEXT): ${row.ba_user_id || 'NULL'}`);
      console.log(`  Email: ${row.email || 'N/A'}`);
      console.log(`  Status: ${row.status}`);
      console.log(`  Workspace: ${row.slug || row.workspace_id}`);
      console.log('');
    }

    // Test query that Go backend will use
    const betterAuthUserId = 'b368c5ca-bd91-4b02-aa08-687b1e104959';
    console.log(`\n🧪 Testing Go backend query with Better Auth user ID: ${betterAuthUserId}\n`);
    
    const testQuery = await pool.query(`
      SELECT 
        wm.id,
        wm.workspace_id,
        w.slug,
        w.name
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE (wm.user_id::text = $1 OR wm.ba_user_id = $1) 
        AND wm.status = 'active'
        AND wm.workspace_id = $2
    `, [betterAuthUserId, workspaceId]);

    if (testQuery.rows.length > 0) {
      console.log(`✅ Query successful! Found workspace:`);
      testQuery.rows.forEach(r => {
        console.log(`   ${r.name} (${r.slug})`);
      });
    } else {
      console.log(`❌ Query failed - no workspace found`);
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();

