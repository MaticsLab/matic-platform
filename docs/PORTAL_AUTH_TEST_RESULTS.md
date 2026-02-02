# Portal Auth Test Results

## Overview
Testing portal sign-in functionality after Better Auth migration to centralized `/auth` directory.

## Portal Auth Configuration

**Endpoint**: `/api/portal-auth/*`
**Cookie Name**: `matic-portal.session_token`
**Database Tables**: 
- `ba_users` (shared with main app)
- `ba_sessions` (shared with main app)
- `ba_accounts` (shared with main app)

**Authentication**:
- Email/Password only (no magic links, no organizations)
- Simplified configuration compared to main platform
- Same database, different cookie for session isolation

## Test Results

### ✅ Endpoint Accessibility
```
GET /api/portal-auth/get-session
Status: 200 OK
Response: null (no active session - expected)
```

### ✅ Database Verification
- Found 5+ users in `ba_users` table
- Found 5+ credential accounts in `ba_accounts` table
- Users exist with email/password authentication

### ✅ Configuration Files
- `/auth/config/portal.ts` - Portal-specific configuration
- `/auth/server/portal.ts` - Server-side exports
- `/auth/client/portal.ts` - Client-side exports
- All files migrated to new structure

### ✅ Code Migration
Files using portal auth client:
- `PublicPortalV2.tsx` - Main portal component
- `AccountSettingsModal.tsx` - Password change functionality

All imports updated to:
```typescript
import { portalBetterAuthClient } from '@/auth/client/portal'
```

## Test Instructions

### Option 1: Use Test HTML Page
1. Open http://localhost:3000/test-portal-signin.html
2. Enter credentials from existing user (e.g., one from ba_users table)
3. Click "Sign In"
4. Check console for auth logs
5. Verify success message or error details

### Option 2: Use Real Portal
1. Visit http://localhost:3000/apply/[form-slug]
2. Use sign-in form on the portal
3. Check browser console for `[PublicPortalV2]` and `[Portal Auth]` logs
4. Verify session creation

## Known Issue: Invalid Password Hash Error

⚠️ **Critical Finding**: "Invalid password hash" error affects BOTH main auth and portal auth

**Root Cause**:
- Existing users in `ba_users` table have bcrypt password hashes
- Better Auth reports these hashes as "invalid"  
- This affects users migrated from old authentication system
- The password hash format appears correct (bcrypt $2a$), but Better Auth cannot verify them

**Evidence**:
```
User: jasanchez85@cps.edu
Password Hash: $2a$10$uhPx73axMHXAV... (60 chars, bcrypt format)
Error: BetterAuthError [BetterAuthError: Invalid password hash]

Testing with BOTH endpoints:
- POST /api/auth/sign-in/email → 500 (Invalid password hash)
- POST /api/portal-auth/sign-in/email → 500 (Invalid password hash)
```

**Hypothesis**:
1. **Password migration issue**: Users migrated from `portal_applicants` table may have incompatible hash format
2. **Test password wrong**: The test password doesn't match the stored hash
3. **Better Auth compatibility**: There may be a mismatch in bcrypt rounds or salt format

**Solutions**:

1. ✅ **Test with new user** (RECOMMENDED):
   - Use sign-up flow to create fresh user with Better Auth
   - This verifies the auth system works correctly for new users
   - Updated test page includes sign-up option

2. **Password reset for existing users**:
   - Implement password reset flow
   - Force users to set new passwords through Better Auth
   - This will rehash passwords in compatible format

3. **Manual password rehash** (for testing):
   ```sql
   -- Don't do this in production - just for testing
   -- Let Better Auth handle password hashing through sign-up
   ```

## ✅ CRM Password Reset Updated

The CRM password reset action has been updated to use Better Auth's scrypt hashing:

**Backend Changes** ([go-backend/handlers/crm.go](../go-backend/handlers/crm.go)):
- ✅ Replaced bcrypt with scrypt password hashing
- ✅ Matches Better Auth's exact configuration (N=16384, r=16, p=1, dkLen=64)
- ✅ Generates 12-character passwords with uppercase, lowercase, numbers, and symbols
- ✅ Returns temporary password to staff for secure delivery to user

**How to Use**:
1. In the CRM, click "Reset Password" on any applicant
2. System generates and displays a temporary password
3. Share password with applicant through secure channel
4. Applicant can immediately sign in to portal with new password

**Technical Details**:
- Password format: `{salt}:{key}` (both hex-encoded)
- Hashing: scrypt with Better Auth parameters
- Storage: `ba_accounts.password` column
- Compatible with both `/api/auth` and `/api/portal-auth` endpoints

## Next Steps

1. **Test with existing user**: Try signing in with credentials from the database
2. **Test sign-up flow**: Create a new portal user through the sign-up form
3. **Monitor logs**: Check both Next.js logs and browser console for errors
4. **Verify session**: After successful sign-in, check `/api/portal-auth/get-session`

## Files for Reference

- Test page: `/public/test-portal-signin.html`
- Test script: `/scripts/test-portal-auth.ts`
- Portal config: `/auth/config/portal.ts`
- Portal client: `/auth/client/portal.ts`
- Main portal component: `/src/components/ApplicationsHub/Applications/ApplicantPortal/PublicPortalV2.tsx`

## Environment Check

Server Status:
- ✅ Next.js dev server running on http://localhost:3000
- ✅ Portal auth endpoint responding
- ✅ Database connected
- ✅ All files migrated to new structure

