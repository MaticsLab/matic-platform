/**
 * Shared TypeScript types for Better Auth
 */

import { betterAuth } from "better-auth";

// Base auth instance type
export type AuthInstance = ReturnType<typeof betterAuth>;

// Session and user types
export type Session = AuthInstance['$Infer']['Session'];
export type User = Session['user'];

// User for password reset callbacks
export interface UserForReset {
  id: string;
  email: string;
  name?: string;
}

// Email template types
export interface EmailContext {
  email: string;
  url: string;
  token?: string;
  request?: Request;
}

// Organization hook types
export interface OrganizationContext {
  organization: any;
  user: any;
  member?: any;
}

export interface InvitationContext {
  invitation: any;
  inviter: any;
  organization: any;
  user?: any;
  member?: any;
}
