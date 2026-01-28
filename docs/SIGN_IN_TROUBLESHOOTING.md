# Sign-In Endpoint Troubleshooting Guide

## Error: POST "https://www.maticsapp.com/api/auth/sign-in/email" Failed

### Quick Checklist

1. **Environment Variables** (CRITICAL)
   - [ ] `DATABASE_URL` is set and accessible
   - [ ] `BETTER_AUTH_SECRET` is set (generate with `openssl rand -base64 32`)
   - [ ] `NEXT_PUBLIC_APP_URL` is set to `https://www.maticsapp.com`
   - [ ] `RESEND_API_KEY` is set (for password reset emails)

2. **Database Connection**
   - [ ] Supabase PostgreSQL is running and accessible
   - [ ] Database tables exist: `ba_users`, `ba_sessions`, `ba_accounts`, `ba_verifications`
   - [ ] Connection string includes `?sslmode=require` for remote connections

3. **Network & CORS**
   - [ ] Browser DevTools Network tab shows the request reaching the server
   - [ ] Response headers include `Access-Control-Allow-Origin: https://www.maticsapp.com`
   - [ ] No 401/403 CORS errors in the response

### Root Causes & Solutions

#### 1. Missing BETTER_AUTH_SECRET

**Symptom**: Unexpected token errors, session validation failures

**Solution**:
```bash
# Generate a new secret
openssl rand -base64 32

# Add to your environment
export BETTER_AUTH_SECRET="generated-value-here"
```

**In Vercel**:
1. Go to Project Settings → Environment Variables
2. Add `BETTER_AUTH_SECRET` with the generated value
3. Redeploy the project

#### 2. Database Connection Failure

**Symptom**: 500 error with "Internal server error" message

**Check in server logs**:
```
[Better Auth] Database pool connected successfully
```

If not present, check:
- DATABASE_URL format: `postgresql://user:password@host:port/dbname`
- Network connectivity from your deployment region to Supabase
- Firewall rules allow inbound connections

**Solution**:
```bash
# Test connection locally
psql $DATABASE_URL -c "SELECT 1"

# Check tables exist
psql $DATABASE_URL -c "\dt ba_*"
```

#### 3. Missing Database Tables

**Solution**: Run migrations
```bash
# Using Supabase CLI
supabase migration up

# Or manually run SQL scripts from docs/001_initial_schema.sql
```

#### 4. Build-Time vs Runtime Issues

The auth library initializes at module load time. If DATABASE_URL is missing during build:
- ✅ Build still succeeds (using placeholder secret)
- ❌ Runtime fails when DATABASE_URL still missing in production

**Solution**: Ensure DATABASE_URL is set in production environment

#### 5. CORS or Origin Mismatch

**Check**:
- Frontend URL matches `NEXT_PUBLIC_APP_URL`
- Browser is on `https://www.maticsapp.com` (not `http://` or subdomain)
- Trusted origins in `src/lib/better-auth.ts` include the domain

**Solution**: Update trusted origins if needed:
```typescript
trustedOrigins: [
  "https://www.maticsapp.com",
  "https://custom-domain.com", // Add yours
  // ...
]
```

### Debugging Steps

#### Step 1: Check Server Logs

Look for these log messages:
```
[Better Auth] Database pool connected successfully  // Good
[Better Auth] POST request: /api/auth/sign-in/email
[Better Auth] POST response status: 200            // Good
```

If you see database errors:
```
[Better Auth] Failed to create database pool: Error...
[Better Auth] POST error: { message: "...", code: "..." }
```

#### Step 2: Test API Directly

```bash
curl -X POST https://www.maticsapp.com/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

#### Step 3: Check Frontend Logs

Open Browser DevTools (F12) → Console tab. You should see:
```
[Better Auth] POST request: /api/auth/sign-in/email
```

If you see CORS errors, it's a network issue, not auth logic.

#### Step 4: Inspect Network Request

DevTools → Network tab:
1. Fill sign-in form and submit
2. Click the failed POST request to `/api/auth/sign-in/email`
3. Check:
   - **Status**: Should be 200 or 3xx redirect, not 500
   - **Response Headers**: Look for `Set-Cookie` (session token)
   - **Response Body**: Should be JSON with user/session data

### Production Deployment Checklist

Before deploying to production:

```bash
# 1. Generate auth secret
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
echo $BETTER_AUTH_SECRET

# 2. Set in environment
# (Vercel UI or environment config file)

# 3. Verify DATABASE_URL works
psql $DATABASE_URL -c "SELECT version();"

# 4. Run tests
npm run test

# 5. Deploy
git push origin main
```

### Environment Variables Summary

```bash
# Required for production
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=<random-base64>
NEXT_PUBLIC_APP_URL=https://www.maticsapp.com
RESEND_API_KEY=<resend-key>

# Optional but recommended
BETTER_AUTH_URL=https://www.maticsapp.com
NODE_ENV=production
```

### Still Not Working?

Enable verbose logging in `src/app/api/auth/[...all]/route.ts`:
- The route handler now logs request/response details
- Request body is logged with email/password masked
- Full error stack is logged in development

Check the application logs in:
- **Vercel**: Project → Deployments → Logs
- **Self-hosted**: Application stdout/stderr
- **Local**: Terminal running `npm run dev`

Look for patterns like:
- `[Better Auth] Database pool error: ...`
- `[Better Auth] POST error: { message: "...", code: "..." }`
- `Cannot read property 'query' of null` (database pool issue)
