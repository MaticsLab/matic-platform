/**
 * Email Service for Better Auth
 * Centralized email sending with Resend
 */

import { Resend } from "resend";

// Initialize Resend for email sending
export const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY) 
  : null;

/**
 * Get default email sender
 */
export function getEmailFrom(customName?: string): string {
  const name = customName || "Matics";
  return process.env.EMAIL_FROM || `${name} <hello@notifications.maticsapp.com>`;
}

/**
 * Get support email for replies
 */
export function getReplyTo(): string {
  return "support@maticsapp.com";
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return resend !== null;
}

/**
 * Log email error
 */
export function logEmailError(context: string): void {
  console.error(`[Better Auth Email] ${context} - RESEND_API_KEY missing`);
}
