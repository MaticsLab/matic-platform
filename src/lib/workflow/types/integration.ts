/**
 * Integration Types
 *
 * Matic Platform supported integrations.
 * Only includes Matic internal plugins and Resend.
 */

// Integration type union - matic plugins + resend
export type IntegrationType =
  | "matic-email"
  | "matic-review"
  | "resend";

// Generic config type - plugins define their own keys via formFields[].configKey
export type IntegrationConfig = Record<string, string | undefined>;
