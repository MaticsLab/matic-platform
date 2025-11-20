# 🚨 URGENT: Supabase JWT Secret Configuration Required

## What's Missing
The `JWT_SECRET` in `go-backend/.env` is currently set to a placeholder value. It needs to be set to your **actual Supabase JWT Secret** for authentication to work.

## How to Find Your Supabase JWT Secret

1. Go to https://supabase.com/dashboard
2. Select your project: `bpvdnphvunezonyrjwub`
3. Click **Settings** (gear icon) → **API**
4. Scroll down to **JWT Settings** section
5. Copy the **JWT Secret** (NOT the anon or service role keys)

## Update Configuration

### Local Development (`go-backend/.env`)
```bash
JWT_SECRET=your-actual-supabase-jwt-secret-here
```

### Production (Render Dashboard)
1. Go to https://dashboard.render.com
2. Select your `matic-platform-go` service
3. Go to **Environment** tab
4. Find `JWT_SECRET` variable
5. Update value to your Supabase JWT secret
6. Click **Save Changes** (will trigger redeployment)

## Why This Is Critical

**Current State:**
- ❌ Using placeholder JWT secret
- ❌ Token validation will fail
- ❌ All authenticated requests will return 401 errors
- ❌ Frontend cannot communicate with backend

**After Updating:**
- ✅ Tokens signed by Supabase can be validated
- ✅ Authentication works correctly
- ✅ Users can access their data
- ✅ Security is enforced

## Verification

After updating the JWT secret:

```bash
# Test locally
cd go-backend
go run main.go

# In another terminal, test with a real Supabase token
curl -H "Authorization: Bearer <token-from-frontend>" \
     http://localhost:8080/api/v1/workspaces
```

Expected result: Should return workspaces, not 401 error

## Important Notes

- The JWT Secret is **different** from the anon key and service role key
- It's a longer string used specifically for signing/verifying tokens
- Never commit this to git
- Same secret used in both development and production
- Can be found in Supabase Dashboard → Settings → API → JWT Settings

## Next Steps

1. [ ] Find JWT secret in Supabase dashboard
2. [ ] Update `go-backend/.env` locally
3. [ ] Test authentication locally
4. [ ] Update Render environment variable
5. [ ] Redeploy to production
6. [ ] Test with frontend on maticsapp.com
