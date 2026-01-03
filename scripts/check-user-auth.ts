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
    const email = 'jsanchez@maticslab.com';
    
    console.log(`\n🔍 Checking authentication for: ${email}\n`);

    // Get user
    const userResult = await pool.query(
      "SELECT id, email, name, email_verified, migrated_from_supabase, supabase_user_id FROM ba_users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      console.log("❌ User not found in ba_users");
      return;
    }

    const user = userResult.rows[0];
    console.log("✅ User found:");
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email Verified: ${user.email_verified}`);
    console.log(`   Migrated: ${user.migrated_from_supabase}`);
    console.log(`   Supabase ID: ${user.supabase_user_id}\n`);

    // Get account
    const accountResult = await pool.query(
      "SELECT id, user_id, provider_id, password IS NOT NULL as has_password, created_at FROM ba_accounts WHERE user_id = $1",
      [user.id]
    );

    if (accountResult.rows.length === 0) {
      console.log("❌ No account found for user");
      return;
    }

    const account = accountResult.rows[0];
    console.log("✅ Account found:");
    console.log(`   Account ID: ${account.id}`);
    console.log(`   Provider: ${account.provider_id}`);
    console.log(`   Has Password: ${account.has_password}`);
    console.log(`   Created: ${account.created_at}\n`);

    // Get sessions
    const sessionsResult = await pool.query(
      `SELECT 
        id, 
        user_id, 
        token, 
        expires_at, 
        expires_at > NOW() as is_active,
        created_at
      FROM ba_sessions 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 5`,
      [user.id]
    );

    console.log(`📊 Sessions (${sessionsResult.rows.length} found):`);
    for (const session of sessionsResult.rows) {
      const expiresAt = new Date(session.expires_at);
      const now = new Date();
      const hoursUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
      console.log(`   ${session.is_active ? '✅' : '❌'} Session: ${session.id.substring(0, 8)}...`);
      console.log(`      Token: ${session.token.substring(0, 20)}...`);
      console.log(`      Expires: ${expiresAt.toISOString()} (${hoursUntilExpiry}h from now)`);
      console.log(`      Created: ${new Date(session.created_at).toISOString()}\n`);
    }

    // Check workspace membership (check both user_id and ba_user_id for compatibility)
    const membershipResult = await pool.query(
      `SELECT 
        wm.id,
        wm.workspace_id,
        wm.user_id,
        wm.ba_user_id,
        wm.status,
        w.name as workspace_name,
        w.slug as workspace_slug
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE (wm.user_id::text = $1 OR wm.ba_user_id = $1) AND wm.status = 'active'`,
      [user.id]
    );

    console.log(`🏢 Workspace Memberships (${membershipResult.rows.length} found):`);
    if (membershipResult.rows.length === 0) {
      console.log("   ⚠️  No workspace memberships found!");
      console.log("   This is why you're getting 'Workspace Not Found'");
    } else {
      for (const membership of membershipResult.rows) {
        console.log(`   ${membership.status === 'active' ? '✅' : '❌'} ${membership.workspace_name} (${membership.workspace_slug})`);
        console.log(`      Status: ${membership.status}`);
        console.log(`      Workspace ID: ${membership.workspace_id}`);
        console.log(`      Member ID: ${membership.id}\n`);
      }
    }

    // Check if user_id in workspace_members matches Better Auth user ID
    console.log("🔍 Checking user_id matching:");
    const supabaseUserCheck = await pool.query(
      `SELECT id, email FROM auth.users WHERE id = $1`,
      [user.supabase_user_id]
    );

    if (supabaseUserCheck.rows.length > 0) {
      console.log(`   ✅ Supabase user exists: ${supabaseUserCheck.rows[0].email}`);
      
      // Check workspace_members with Supabase user ID
      const supabaseMembership = await pool.query(
        `SELECT workspace_id, status FROM workspace_members WHERE user_id = $1`,
        [user.supabase_user_id]
      );
      
      if (supabaseMembership.rows.length > 0) {
        console.log(`   ⚠️  Found ${supabaseMembership.rows.length} workspace memberships with Supabase user ID`);
        console.log(`   ⚠️  These need to be migrated to Better Auth user ID: ${user.id}`);
      }
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();

