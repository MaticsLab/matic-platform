# Authentication Setup Guide

This guide covers setting up Better Auth for the Matic Platform.

## Overview

The Matic Platform uses **Better Auth** for authentication with PostgreSQL as the session store. Authentication works in both development and production.

## Environment Variables Required

### Critical Variables (Without these, sign-in fails)

```bash
# PostgreSQL connection string (required for session storage)
DATABASE_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres

# Random secret for signing sessions (required for security)
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=your-generated-secret-key-here

# Application URLs
NEXT_PUBLIC_APP_URL=https://www.maticsapp.com
BETTER_AUTH_URL=https://www.maticsapp.com
```

### Optional Variables (For email features)

```bash
# Email sending via Resend
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=Matics <hello@notifications.maticsapp.com>

# OAuth providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Setup Steps

### 1. Generating BETTER_AUTH_SECRET

Run this command once and save the output:

```bash
openssl rand -base64 32
```

Example output:
```
aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890+/==
```

### 2. Setting Environment Variables

#### Development (Local)

Create `.env.local` in the root directory:

```bash
# Copy template
cp .env.example .env.local

# Edit with your values
DATABASE_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres
BETTER_AUTH_SECRET=<output-from-step-1>
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
RESEND_API_KEY=your-resend-key
NODE_ENV=development
```

#### Production (Vercel/Deployment)

Add environment variables in your deployment platform:

**Vercel**:
1. Go to Project Settings → Environment Variables
2. Add each variable with values for Production

```
DATABASE_URL = postgresql://...
BETTER_AUTH_SECRET = (your-generated-secret)
NEXT_PUBLIC_APP_URL = https://www.maticsapp.com
BETTER_AUTH_URL = https://www.maticsapp.com
RESEND_API_KEY = (your-resend-key)
NODE_ENV = production
```

3. Redeploy the project

### 3. Database Setup

Better Auth requires the following tables. Run the initial schema:

```bash
# Using Supabase CLI
supabase migration up

# Or manually run: docs/001_initial_schema.sql in Supabase SQL Editor
```

Tables created:
- `ba_users` - User accounts
- `ba_sessions` - Active sessions
- `ba_accounts` - OAuth connections
- `ba_verifications` - Email verifications

### 4. Testing Authentication

**Local Development**:

```bash
npm run dev
# App runs on http://localhost:3000
```

Visit the sign-in page and try creating an account.

**Production**:

After deployment, test the sign-in endpoint:

```bash
curl -X POST https://www.maticsapp.com/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

## Common Issues & Solutions

### Issue: "Fetch failed loading: POST /api/auth/sign-in/email"

**Cause**: Database connection failed or environment variables missing

**Solution**:
1. Verify `DATABASE_URL` is set: `echo $DATABASE_URL`
2. Test database connection: `psql $DATABASE_URL -c "SELECT 1"`
3. Verify `BETTER_AUTH_SECRET` is set: `echo $BETTER_AUTH_SECRET`
4. Check tables exist: `psql $DATABASE_URL -c "\dt ba_*"`

### Issue: Sessions not persisting between page reloads

**Cause**: BETTER_AUTH_SECRET differs between deployments or requests

**Solution**:
- Ensure same `BETTER_AUTH_SECRET` is used everywhere
- Don't regenerate the secret after users have logged in
- Check logs for "BETTER_AUTH_SECRET is not set" warnings

### Issue: CORS errors when signing in

**Cause**: Frontend URL not in trusted origins

**Solution**: Update trusted origins in `src/lib/better-auth.ts`

```typescript
trustedOrigins: [
  "https://www.maticsapp.com",
  "https://custom-domain.com", // Add yours
]
```

### Issue: Password reset emails not sending

**Cause**: `RESEND_API_KEY` not set

**Solution**:
1. Get API key from [Resend Dashboard](https://resend.com)
2. Set `RESEND_API_KEY` in environment variables
3. Set `EMAIL_FROM` to a verified domain in Resend

## Security Best Practices

1. **BETTER_AUTH_SECRET**
   - Generate a new secret for each environment
   - Store securely (never commit to Git)
   - Rotate regularly for high-security applications

2. **DATABASE_URL**
   - Use strong passwords
   - Enable SSL/TLS connections
   - Use VPC endpoints if available

3. **Session Cookies**
   - Cookies are HttpOnly (cannot be accessed by JavaScript)
   - Secure flag set in production (HTTPS only)
   - SameSite=Lax prevents CSRF attacks

4. **User Passwords**
   - Never transmitted in plain text
   - Hashed with bcrypt
   - Password reset tokens expire after 1 hour

## Configuration Reference

### Cookie Settings (Production)

```typescript
// src/lib/better-auth.ts
cookies: {
  sessionToken: {
    attributes: {
      secure: true,           // HTTPS only
      sameSite: "none",       // Cross-site requests
      domain: ".maticsapp.com" // All subdomains
    }
  }
}
```

### Session Expiration

```typescript
session: {
  expiresIn: 60 * 60 * 24 * 7,  // 7 days
  updateAge: 60 * 60 * 24,       // Update every 24 hours
  freshAge: 60 * 15,              // Require fresh session after 15 minutes
}
```

### Rate Limiting

```typescript
rateLimit: {
  enabled: true,
  window: 60,      // 1 minute
  max: 100,        // 100 requests per minute
}
```

## Monitoring & Debugging

### Check Server Logs

Look for these indicators:

```
✅ [Better Auth] Database pool connected successfully
✅ [Better Auth] POST response status: 200
❌ [Better Auth] Database pool error: ...
❌ [Better Auth] BETTER_AUTH_SECRET is not set
```

### Enable Verbose Logging

In production, check application logs in:
- **Vercel**: Project → Deployments → Logs
- **Self-hosted**: Application stdout
- **Local**: Terminal running `npm run dev`

### Test Database Connection

```bash
# Check connection string
echo $DATABASE_URL

# Test with psql
psql $DATABASE_URL -c "SELECT current_timestamp, current_user;"

# List auth tables
psql $DATABASE_URL -c "\dt ba_users ba_sessions ba_accounts ba_verifications"
```

## Migration from Supabase Auth

If migrating from Supabase Auth:

1. Users need to reset their password (Supabase passwords not compatible)
2. Sessions will be invalidated
3. Use magic links for seamless passwordless re-authentication

See: [Supabase Auth Migration Guide](docs/SUPABASE_MIGRATION.md)

## More Help

- [Better Auth Documentation](https://better-auth.vercel.app/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Next.js Authentication](https://nextjs.org/docs/app/building-your-application/authentication)
- [Troubleshooting Guide](SIGN_IN_TROUBLESHOOTING.md)
