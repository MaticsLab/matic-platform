# Better Auth Portal Login - Complete Audit & Fix

**Date:** February 2, 2026  
**Issue:** Multiple conflicting auth systems causing login failures

---

## 🔴 CRITICAL ISSUES FOUND

### 1. **Three Competing Authentication Systems**

| System | Location | Status | Notes |
|--------|----------|--------|-------|
| **portalBetterAuthClient** | `src/lib/portal-better-auth-client.ts` | ✅ **USE THIS** | New Better Auth system |
| **portalAuthV2** | `src/lib/api/submissions-client.ts` | ❌ **REMOVE** | Legacy token-based |
| **portalAuthClient** | `src/lib/api/portal-auth-client.ts` | ❌ **REMOVE** | Old legacy system |

### 2. **Backend Has Dual Auth Systems**

| Endpoint | Handler | Type | Status |
|----------|---------|------|--------|
| `/api/v1/portal/v2/signup` | `PortalSignupV2` | Better Auth based | ✅ KEEP |
| `/api/v1/portal/v2/login` | `PortalLoginV2` | Better Auth based | ✅ KEEP |
| `/api/v1/portal/login` | Alias to v2 | Legacy compat | ⚠️ Aliased |
| `/api/portal-auth/sign-in/email` | Better Auth native | Direct auth | ✅ KEEP |

### 3. **Frontend Login Flow Issues**

**Current broken flow:**
```
1. User enters email/password
2. Call portalBetterAuthClient.signIn.email() ← Returns 500
3. Call /portal/sync-better-auth-applicant ← Never reached
4. Set local state
```

**Problems:**
- Better Auth returns empty 500 (no error body)
- Sync endpoint is called but may not be needed
- Multiple localStorage keys being used
- Legacy API endpoints still being imported

---

## ✅ CORRECT ARCHITECTURE

### Better Auth Flow (What We Want)

```
┌─────────────────────────────────────────────────────────┐
│ Frontend: PublicPortalV2.tsx                            │
│                                                         │
│  1. User Login                                          │
│     ↓                                                   │
│  2. portalBetterAuthClient.signIn.email()               │
│     → POST /api/portal-auth/sign-in/email              │
│     → Better Auth validates password (bcrypt)           │
│     → Sets cookie: matic-portal.session_token          │
│     → Returns user object                               │
│                                                         │
│  3. Get applicant data (optional)                       │
│     → GET /api/v1/portal/v2/me                         │
│     → Uses Better Auth cookie for auth                  │
│                                                         │
│  4. Set React state                                     │
│     → setIsAuthenticated(true)                          │
│     → setApplicantName(user.name)                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Why Better Auth Login Returns 500

**Root cause:** Better Auth `sign-in/email` endpoint expects specific format but something in our setup is wrong.

**Possible issues:**
1. ❌ Request body format incorrect
2. ❌ Better Auth not handling bcrypt properly
3. ❌ Database connection issue in serverless
4. ❌ Missing configuration in Better Auth

---

## 🔧 FIX PLAN

### Phase 1: Simplify Login Flow (Remove Legacy Code)

**Files to update:**

1. **PublicPortalV2.tsx** - Remove sync call, simplify login
2. **submissions-client.ts** - Remove portalAuthV2
3. **portal-auth-client.ts** - Remove or mark deprecated

### Phase 2: Fix Better Auth Login

**Debug why `/api/portal-auth/sign-in/email` returns 500:**

1. Check request format
2. Verify Better Auth emailAndPassword plugin config
3. Test password verification directly
4. Add proper error response

### Phase 3: Update Backend Handlers

**Keep only Better Auth middleware:**
- `PortalAuthMiddlewareV2` - Uses Better Auth cookies
- Remove token-based middleware

---

## 📋 RECOMMENDED CHANGES

### 1. Simplify PublicPortalV2.tsx Login

```typescript
if (isLogin) {
  // ONLY use Better Auth for login
  const result = await portalBetterAuthClient.signIn.email({
    email,
    password,
  })

  if (result.error || !result.data?.user) {
    throw new Error(result.error?.message || 'Invalid email or password')
  }

  const user = result.data.user
  
  // Set React state
  setIsAuthenticated(true)
  setApplicantName(user.name || user.email)
  
  // Optionally fetch applicant-specific data
  try {
    const baseUrl = getApiUrl()
    const meRes = await fetch(`${baseUrl}/portal/v2/me`, {
      credentials: 'include' // Sends Better Auth cookie
    })
    
    if (meRes.ok) {
      const applicant = await meRes.json()
      setApplicantId(applicant.id)
      // ... set other applicant data
    }
  } catch (err) {
    // Non-critical, continue with just Better Auth user
    console.warn('Could not fetch applicant data:', err)
  }
  
  toast.success('Logged in successfully')
}
```

### 2. Remove Legacy Auth Clients

**Delete or deprecate:**
- `src/lib/api/submissions-client.ts` - `portalAuthV2` object
- `src/lib/api/portal-auth-client.ts` - Entire file (if not used elsewhere)

### 3. Fix Better Auth Sign-In Response

**Why it returns 500:**
Need to investigate by testing the endpoint directly with proper logging.

**Test script:**
```bash
curl -X POST http://localhost:3001/api/portal-auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"jasanchez85@cps.edu","password":"TestPass123"}' \
  -v
```

Expected response:
```json
{
  "user": {
    "id": "...",
    "email": "jasanchez85@cps.edu",
    "name": "Jose Sanchez"
  },
  "session": {
    "token": "...",
    "expiresAt": "..."
  }
}
```

Actual response: **Empty 500**

### 4. Backend Cleanup

**Keep:**
- `/api/v1/portal/v2/*` endpoints (Better Auth based)
- `PortalAuthMiddlewareV2` (checks Better Auth cookie)

**Remove:**
- Legacy token-based auth middleware (if any)
- Old `/portal/login` that generates tokens (keep alias to v2)

---

## 🧪 TESTING CHECKLIST

After fixes:

- [ ] Reset password: `node scripts/reset-ba-password.mjs email@test.com NewPass123`
- [ ] Verify hash: `node scripts/test-password-login.mjs email@test.com NewPass123`
- [ ] Test Better Auth endpoint directly (curl)
- [ ] Test login via UI on `localhost:3001`
- [ ] Test login via UI on `bpnc.maticsapp.com`
- [ ] Verify cookie is set: `matic-portal.session_token`
- [ ] Verify protected endpoints work with cookie
- [ ] Test signup flow
- [ ] Test magic link (if used)

---

## 🎯 PRIORITY ACTIONS

1. **IMMEDIATE**: Fix Better Auth `/sign-in/email` 500 error
   - Add detailed error logging
   - Check request body format
   - Verify bcrypt password comparison
   
2. **HIGH**: Simplify PublicPortalV2 login (remove sync call, legacy code)

3. **MEDIUM**: Remove legacy auth clients from codebase

4. **LOW**: Update documentation and add migration guide

---

## 💡 KEY INSIGHTS

1. **Better Auth works locally** (test endpoint succeeds)
2. **Database connection works** (pool creates successfully)
3. **Password is correctly hashed** (bcrypt verification passes in script)
4. **Issue is in Better Auth request handler** (not infrastructure)

The problem is NOT:
- ❌ Password hashing
- ❌ Database connection
- ❌ Serverless environment
- ❌ Environment variables

The problem IS:
- ✅ Better Auth `/sign-in/email` endpoint returning empty 500
- ✅ Need to check Better Auth request format/configuration
- ✅ Possible issue with Better Auth's error handling

---

## 📝 NEXT STEPS

1. Start dev server with visible logs
2. Test Better Auth endpoint and capture full error
3. Check Better Auth docs for proper request format
4. Implement simplified login flow
5. Remove all legacy auth code
6. Test end-to-end on production
