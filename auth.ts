/**
 * Better Auth - Root Configuration File
 * 
 * This file exists for Better Auth CLI auto-discovery.
 * The CLI will automatically find this file when running commands without --config flag.
 * 
 * Usage:
 *   npx @better-auth/cli generate
 *   npx @better-auth/cli migrate
 * 
 * For specific configurations:
 *   npx @better-auth/cli generate --config auth/config/main.ts
 *   npx @better-auth/cli generate --config auth/config/portal.ts
 */

export { default } from './auth/config/main';
