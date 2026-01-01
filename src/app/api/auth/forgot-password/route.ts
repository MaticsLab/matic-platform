/**
 * Hybrid Password Reset API
 * 
 * Handles password reset for both Better Auth and Supabase users.
 * Sends reset emails via Resend API.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { Pool } from "pg";
import crypto from "crypto";

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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

// Generate a secure reset token
function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Get base URL
function getBaseURL(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export async function POST(request: NextRequest) {
  let pool: Pool | null = null;
  
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!resend) {
      console.error("[Forgot Password] RESEND_API_KEY not configured");
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    pool = getPool();
    const supabaseAdmin = getSupabaseAdmin();
    
    let userFound = false;
    let userName = "";
    let authProvider: "better-auth" | "supabase" | null = null;

    // Check Better Auth first
    if (pool) {
      try {
        const result = await pool.query(
          'SELECT id, name, email FROM ba_users WHERE LOWER(email) = LOWER($1)',
          [email]
        );
        if (result.rows.length > 0) {
          userFound = true;
          userName = result.rows[0].name || "";
          authProvider = "better-auth";
          console.log(`[Forgot Password] Found user in Better Auth: ${email}`);
        }
      } catch (err) {
        console.error("[Forgot Password] Better Auth check failed:", err);
      }
    }

    // Check Supabase if not found in Better Auth
    if (!userFound && supabaseAdmin) {
      try {
        // List users and find by email
        const { data, error } = await supabaseAdmin.auth.admin.listUsers();
        if (!error && data?.users) {
          const supabaseUser = data.users.find(
            (u) => u.email?.toLowerCase() === email.toLowerCase()
          );
          if (supabaseUser) {
            userFound = true;
            userName = supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || "";
            authProvider = "supabase";
            console.log(`[Forgot Password] Found user in Supabase: ${email}`);
          }
        }
      } catch (err) {
        console.error("[Forgot Password] Supabase check failed:", err);
      }
    }

    // For security, always return success even if user not found
    // This prevents email enumeration attacks
    if (!userFound) {
      console.log(`[Forgot Password] User not found: ${email} (returning success anyway)`);
      if (pool) await pool.end();
      return NextResponse.json({ success: true });
    }

    // Generate reset token and store it
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token in ba_verifications table
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO ba_verifications (id, identifier, value, expires_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (identifier) DO UPDATE 
           SET value = $3, expires_at = $4, updated_at = NOW()`,
          [
            crypto.randomUUID(),
            `password-reset:${email.toLowerCase()}`,
            resetToken,
            expiresAt,
          ]
        );
        console.log(`[Forgot Password] Stored reset token for: ${email}`);
      } catch (err) {
        console.error("[Forgot Password] Failed to store token:", err);
        // Continue anyway - we'll send the email
      }
    }

    // Build reset URL
    const baseURL = getBaseURL();
    const resetURL = `${baseURL}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}&provider=${authProvider}`;

    // Send reset email via Resend
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || "Matic <noreply@notifications.maticsapp.com>",
        to: email,
        subject: "Reset your password - Matic",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1e40af; margin: 0;">Matic</h1>
            </div>
            
            <h2 style="color: #1f2937; margin-bottom: 16px;">Reset Your Password</h2>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
              Hi ${userName || "there"},
            </p>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 24px;">
              We received a request to reset your password for your Matic account. 
              Click the button below to create a new password:
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetURL}" 
                 style="background-color: #2563eb; color: white; padding: 14px 28px; 
                        text-decoration: none; border-radius: 8px; display: inline-block;
                        font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 20px;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="color: #3b82f6; font-size: 14px; word-break: break-all;">
              ${resetURL}
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
            
            <p style="color: #9ca3af; font-size: 12px; line-height: 18px;">
              This link will expire in 1 hour. If you didn't request a password reset, 
              you can safely ignore this email.
            </p>
            
            <p style="color: #9ca3af; font-size: 12px; line-height: 18px; margin-top: 24px;">
              © ${new Date().getFullYear()} Matic. All rights reserved.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error("[Forgot Password] Resend error:", error);
        if (pool) await pool.end();
        return NextResponse.json(
          { error: "Failed to send reset email" },
          { status: 500 }
        );
      }

      console.log(`[Forgot Password] Email sent successfully to ${email}, ID: ${data?.id}`);
      if (pool) await pool.end();
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[Forgot Password] Failed to send email:", err);
      if (pool) await pool.end();
      return NextResponse.json(
        { error: "Failed to send reset email" },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("[Forgot Password] Unexpected error:", err);
    if (pool) await pool.end();
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
