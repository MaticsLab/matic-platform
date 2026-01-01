/**
 * Password Reset API
 * 
 * Handles the actual password reset using the token from the forgot-password email.
 * Works with both Better Auth and Supabase users.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

// Get Supabase admin client
function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
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

// Get database pool
function getPool() {
  if (!process.env.DATABASE_URL) return null;
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
}

export async function POST(request: NextRequest) {
  let pool: Pool | null = null;
  
  try {
    const body = await request.json();
    const { token, newPassword, email: providedEmail, provider } = body;

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "Token and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    pool = getPool();
    const supabaseAdmin = getSupabaseAdmin();

    // Verify the token and get the email
    let email = providedEmail;
    
    if (pool) {
      try {
        // Find the verification token
        const result = await pool.query(
          `SELECT identifier, value, expires_at FROM ba_verifications 
           WHERE value = $1 AND identifier LIKE 'password-reset:%'`,
          [token]
        );

        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: "Invalid or expired reset token" },
            { status: 400 }
          );
        }

        const verification = result.rows[0];
        
        // Check if expired
        if (new Date(verification.expires_at) < new Date()) {
          // Delete expired token
          await pool.query(
            'DELETE FROM ba_verifications WHERE value = $1',
            [token]
          );
          return NextResponse.json(
            { error: "Reset token has expired. Please request a new one." },
            { status: 400 }
          );
        }

        // Extract email from identifier (format: "password-reset:email@example.com")
        email = verification.identifier.replace('password-reset:', '');
        
        console.log(`[Reset Password] Token verified for: ${email}`);
      } catch (err) {
        console.error("[Reset Password] Token verification failed:", err);
        return NextResponse.json(
          { error: "Failed to verify reset token" },
          { status: 500 }
        );
      }
    }

    if (!email) {
      return NextResponse.json(
        { error: "Could not determine user email" },
        { status: 400 }
      );
    }

    let passwordUpdated = false;

    // Try Better Auth first
    if (pool) {
      try {
        // Check if user exists in Better Auth
        const userResult = await pool.query(
          'SELECT id FROM ba_users WHERE LOWER(email) = LOWER($1)',
          [email]
        );

        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].id;
          
          // Hash the new password
          const hashedPassword = await bcrypt.hash(newPassword, 10);
          
          // Update the password in ba_accounts
          const updateResult = await pool.query(
            `UPDATE ba_accounts 
             SET password = $1, updated_at = NOW() 
             WHERE user_id = $2 AND provider_id = 'credential'`,
            [hashedPassword, userId]
          );

          if (updateResult.rowCount && updateResult.rowCount > 0) {
            passwordUpdated = true;
            console.log(`[Reset Password] Password updated in Better Auth for: ${email}`);
          } else {
            // Create credential account if it doesn't exist
            const accountId = `credential:${email.toLowerCase()}`;
            await pool.query(
              `INSERT INTO ba_accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
               VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())
               ON CONFLICT (provider_id, account_id) DO UPDATE SET password = $4, updated_at = NOW()`,
              [crypto.randomUUID(), accountId, userId, hashedPassword]
            );
            passwordUpdated = true;
            console.log(`[Reset Password] Created credential account for: ${email}`);
          }
        }
      } catch (err) {
        console.error("[Reset Password] Better Auth update failed:", err);
      }
    }

    // Try Supabase if not updated in Better Auth
    if (!passwordUpdated && supabaseAdmin) {
      try {
        // Find user by email
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const supabaseUser = usersData?.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (supabaseUser) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(
            supabaseUser.id,
            { password: newPassword }
          );

          if (!error) {
            passwordUpdated = true;
            console.log(`[Reset Password] Password updated in Supabase for: ${email}`);
          } else {
            console.error("[Reset Password] Supabase update error:", error);
          }
        }
      } catch (err) {
        console.error("[Reset Password] Supabase update failed:", err);
      }
    }

    if (!passwordUpdated) {
      return NextResponse.json(
        { error: "User not found or failed to update password" },
        { status: 404 }
      );
    }

    // Delete the used token
    if (pool) {
      try {
        await pool.query(
          'DELETE FROM ba_verifications WHERE value = $1',
          [token]
        );
        console.log(`[Reset Password] Token deleted for: ${email}`);
      } catch (err) {
        console.error("[Reset Password] Failed to delete token:", err);
        // Non-fatal error
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Reset Password] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}
