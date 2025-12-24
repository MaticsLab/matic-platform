/**
 * User Migration API - Migrates users from Supabase Auth to Better Auth
 * 
 * This endpoint fetches all users from Supabase Auth and creates corresponding
 * accounts in Better Auth, linking them via the supabaseUserId field.
 * 
 * Security: This endpoint requires admin authorization
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase admin client (needs service role key)
function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase configuration");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Dynamic import for pg to avoid build issues
async function getPool() {
  const { Pool } = await import("pg");
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
}

interface MigrationResult {
  success: boolean;
  migrated: number;
  skipped: number;
  errors: Array<{ email: string; error: string }>;
  details: Array<{ email: string; status: "migrated" | "skipped" | "error"; reason?: string }>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let pool: any = null;
  
  try {
    // Verify admin authorization
    const adminSecret = request.headers.get("x-admin-secret");
    
    // Check for admin secret (simple auth for migration script)
    if (adminSecret !== process.env.MIGRATION_ADMIN_SECRET && adminSecret !== process.env.BETTER_AUTH_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 401 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    pool = await getPool();

    const result: MigrationResult = {
      success: true,
      migrated: 0,
      skipped: 0,
      errors: [],
      details: [],
    };

    // Fetch all users from Supabase Auth
    console.log("📥 Fetching users from Supabase Auth...");
    const { data: supabaseUsers, error: fetchError } = await supabaseAdmin.auth.admin.listUsers();

    if (fetchError) {
      console.error("❌ Failed to fetch Supabase users:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch Supabase users", details: fetchError.message },
        { status: 500 }
      );
    }

    console.log(`📊 Found ${supabaseUsers.users.length} users in Supabase Auth`);

    // Check existing Better Auth users to avoid duplicates
    const existingUsers = await pool.query(
      "SELECT email, supabase_user_id FROM \"user\" WHERE email IS NOT NULL"
    );
    const existingEmails = new Set(existingUsers.rows.map((u: any) => u.email?.toLowerCase()));
    const existingSupabaseIds = new Set(
      existingUsers.rows.filter((u: any) => u.supabase_user_id).map((u: any) => u.supabase_user_id)
    );

    console.log(`📊 Found ${existingEmails.size} existing users in Better Auth`);

    // Migrate each user
    for (const supabaseUser of supabaseUsers.users) {
      const email = supabaseUser.email?.toLowerCase();
      
      if (!email) {
        result.details.push({
          email: "unknown",
          status: "skipped",
          reason: "No email address",
        });
        result.skipped++;
        continue;
      }

      // Check if already migrated
      if (existingEmails.has(email) || existingSupabaseIds.has(supabaseUser.id)) {
        result.details.push({
          email,
          status: "skipped",
          reason: "Already exists in Better Auth",
        });
        result.skipped++;
        continue;
      }

      try {
        // Extract user metadata
        const userName = supabaseUser.user_metadata?.full_name || 
                        supabaseUser.user_metadata?.name ||
                        email.split("@")[0];
        const avatarUrl = supabaseUser.user_metadata?.avatar_url || null;

        // Create user in Better Auth via direct database insert
        const userId = crypto.randomUUID();
        
        await pool.query(
          `INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at, supabase_user_id, migrated_from_supabase, full_name, avatar_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (email) DO NOTHING`,
          [
            userId,
            userName,
            email,
            supabaseUser.email_confirmed_at ? true : false,
            avatarUrl,
            supabaseUser.created_at || new Date().toISOString(),
            new Date().toISOString(),
            supabaseUser.id,
            true,
            userName,
            avatarUrl,
          ]
        );

        // Create a credential account for email/password login
        const accountId = crypto.randomUUID();
        await pool.query(
          `INSERT INTO "account" (id, account_id, provider_id, user_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [
            accountId,
            supabaseUser.id,
            "credential",
            userId,
            new Date().toISOString(),
            new Date().toISOString(),
          ]
        );

        result.details.push({
          email,
          status: "migrated",
        });
        result.migrated++;
        console.log(`✅ Migrated user: ${email}`);

      } catch (userError: any) {
        console.error(`❌ Failed to migrate user ${email}:`, userError);
        result.errors.push({
          email,
          error: userError.message || "Unknown error",
        });
        result.details.push({
          email,
          status: "error",
          reason: userError.message,
        });
      }
    }

    console.log(`
📊 Migration Complete:
   - Migrated: ${result.migrated}
   - Skipped: ${result.skipped}
   - Errors: ${result.errors.length}
    `);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("❌ Migration failed:", error);
    return NextResponse.json(
      { error: "Migration failed", details: error.message },
      { status: 500 }
    );
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// GET endpoint to check migration status
export async function GET(request: NextRequest): Promise<NextResponse> {
  let pool: any = null;
  
  try {
    const adminSecret = request.headers.get("x-admin-secret");
    
    if (adminSecret !== process.env.MIGRATION_ADMIN_SECRET && adminSecret !== process.env.BETTER_AUTH_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 401 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    pool = await getPool();

    // Count users in both systems
    const [supabaseResult, betterAuthResult, migratedResult] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers(),
      pool.query('SELECT COUNT(*) as count FROM "user"'),
      pool.query('SELECT COUNT(*) as count FROM "user" WHERE migrated_from_supabase = true'),
    ]);

    return NextResponse.json({
      supabaseUsers: supabaseResult.data?.users?.length || 0,
      betterAuthUsers: parseInt(betterAuthResult.rows[0]?.count || "0"),
      migratedUsers: parseInt(migratedResult.rows[0]?.count || "0"),
      pendingMigration: (supabaseResult.data?.users?.length || 0) - parseInt(migratedResult.rows[0]?.count || "0"),
    });

  } catch (error: any) {
    console.error("❌ Failed to get migration status:", error);
    return NextResponse.json(
      { error: "Failed to get status", details: error.message },
      { status: 500 }
    );
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}
