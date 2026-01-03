# Better Auth Accounts Table Explained

## Overview

The `ba_accounts` table stores authentication accounts for Better Auth. It supports both **credential** (email/password) and **OAuth** (Google, GitHub, etc.) authentication methods.

## Account Types

### 1. Credential Accounts (Email/Password)

For users who sign in with email and password:

```sql
provider_id = 'credential'
password = 'salt:hash' (scrypt-hashed)
access_token = NULL
refresh_token = NULL
id_token = NULL
account_id = Supabase user ID (for migrated users)
```

**Key Points:**
- ✅ **Password field is REQUIRED** - Contains scrypt-hashed password
- ✅ **OAuth tokens are NULL** - This is correct! OAuth tokens are only for OAuth providers
- ✅ **account_id** - Links to Supabase user ID for migration tracking

### 2. OAuth Accounts (Google, GitHub, etc.)

For users who sign in with OAuth providers:

```sql
provider_id = 'google' | 'github' | etc.
password = NULL
access_token = 'oauth_access_token'
refresh_token = 'oauth_refresh_token'
id_token = 'oauth_id_token'
account_id = Provider's user ID
```

**Key Points:**
- ✅ **OAuth tokens are REQUIRED** - Used to authenticate with the provider
- ✅ **Password is NULL** - Not used for OAuth authentication
- ✅ **account_id** - Provider's unique user identifier

## Migration Notes

### Password Migration

**⚠️ IMPORTANT:** Password hashes **cannot** be migrated from Supabase to Better Auth because:

1. **Supabase** uses `bcrypt` for password hashing
2. **Better Auth** uses `scrypt` for password hashing
3. These are **incompatible** hash formats

**Solution:** Migrated users must reset their password on first Better Auth login.

### OAuth Tokens

For credential accounts created during migration:
- `access_token = NULL` ✅ **CORRECT** - Not needed for credential auth
- `refresh_token = NULL` ✅ **CORRECT** - Not needed for credential auth  
- `id_token = NULL` ✅ **CORRECT** - Not needed for credential auth

These fields are **only** populated for OAuth provider accounts.

## Code Examples

### Checking Account Type

```typescript
// Check if account is credential-based
if (account.provider_id === 'credential') {
  // Has password, no OAuth tokens
  console.log('Credential account - password required');
}

// Check if account is OAuth-based
if (account.provider_id === 'google' || account.provider_id === 'github') {
  // Has OAuth tokens, no password
  console.log('OAuth account - tokens required');
}
```

### Creating Credential Account

```sql
INSERT INTO ba_accounts (
  id,
  account_id,
  provider_id,
  user_id,
  password,           -- Scrypt-hashed password
  access_token,       -- NULL for credential
  refresh_token,      -- NULL for credential
  id_token            -- NULL for credential
) VALUES (
  'account_id',
  'supabase_user_id',
  'credential',
  'better_auth_user_id',
  'salt:hash',        -- Scrypt format
  NULL,               -- OAuth tokens not used
  NULL,
  NULL
);
```

## Health Checks

### ✅ Valid Credential Account
- `provider_id = 'credential'`
- `password IS NOT NULL`
- `access_token IS NULL` (expected)
- `refresh_token IS NULL` (expected)
- `id_token IS NULL` (expected)

### ✅ Valid OAuth Account
- `provider_id IN ('google', 'github', ...)`
- `password IS NULL` (expected)
- `access_token IS NOT NULL`
- `refresh_token IS NOT NULL` (usually)
- `id_token IS NOT NULL` (usually)

### ❌ Invalid Account
- `provider_id = 'credential'` but `password IS NULL` → User cannot login
- `provider_id = 'google'` but `access_token IS NULL` → OAuth broken

## Summary

**For credential (email/password) authentication:**
- OAuth tokens (`access_token`, `refresh_token`, `id_token`) are **correctly NULL**
- Only the `password` field is used
- This is the **expected behavior** - not a bug!

**For OAuth authentication:**
- OAuth tokens are required
- `password` field is NULL
- This is also **expected behavior**

The current database setup is **correct** - credential accounts don't need OAuth tokens!

