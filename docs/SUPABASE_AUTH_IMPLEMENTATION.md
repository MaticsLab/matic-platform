# Supabase JWT Authentication Implementation

## Overview
Implemented proper Supabase JWT token validation following [Supabase Server-Side Auth Guidelines](https://supabase.com/docs/guides/auth/server-side).

## Changes Made

### 1. Authentication Middleware (`go-backend/middleware/auth.go`)
Created JWT validation middleware that:
- ✅ Validates Supabase JWT tokens using `SUPABASE_JWT_SECRET`
- ✅ Verifies token signature with HMAC signing method
- ✅ Extracts user claims (user_id, email, role)
- ✅ Stores user context in Gin context for handlers
- ✅ Returns 401 for invalid/missing tokens

**Key Functions:**
- `AuthMiddleware(cfg)` - Requires valid JWT token
- `OptionalAuthMiddleware(cfg)` - Validates if present, allows without
- `GetUserID(c)` - Extract user ID from context
- `GetUserEmail(c)` - Extract user email from context
- `GetUserClaims(c)` - Extract full Supabase claims
- `DebugTokenMiddleware()` - Development-only token logging

### 2. Protected Routes (`go-backend/router/router.go`)
Applied authentication to all API v1 endpoints:

**Protected (require auth):**
- `/api/v1/workspaces/*` - All workspace operations
- `/api/v1/tables/*` - All table operations (CRUD, rows, columns)
- `/api/v1/table-links/*` - Table relationship management
- `/api/v1/row-links/*` - Row linking operations
- `/api/v1/forms/*` - Form and submission operations
- `/api/v1/activities-hubs/*` - Activities hub management
- `/api/v1/search/*` - Search and history operations

**Public (no auth):**
- `/` - HTML API documentation
- `/health` - Health check
- `/api-info` - API information
- `/api/v1` - API v1 root endpoint
- `/api/v1/docs` - JSON API documentation

### 3. Dependencies
Added `github.com/golang-jwt/jwt/v5` for JWT parsing and validation.

## How It Works

### Frontend Flow
1. User logs in via Supabase Auth (`src/lib/supabase.ts`)
2. Frontend gets JWT token via `getSessionToken()`
3. Token sent in `Authorization: Bearer <token>` header
4. `goFetch()` automatically includes token in all requests

### Backend Flow
1. Request arrives with `Authorization` header
2. Middleware extracts and validates JWT token
3. Verifies signature using `SUPABASE_JWT_SECRET`
4. Parses claims and stores in Gin context:
   ```go
   c.Set("user_id", claims.Sub)
   c.Set("user_email", claims.Email)
   c.Set("user_role", claims.Role)
   c.Set("user_claims", claims)
   ```
5. Handler can access user info:
   ```go
   userID, exists := middleware.GetUserID(c)
   ```

### JWT Token Structure
```json
{
  "sub": "user-uuid",           // User ID
  "email": "user@example.com",   // User email
  "role": "authenticated",       // User role
  "aud": "authenticated",        // Audience
  "iss": "https://*.supabase.co/auth/v1",  // Issuer
  "exp": 1234567890,             // Expiration timestamp
  "iat": 1234567890,             // Issued at timestamp
  "user_metadata": {},           // Custom user metadata
  "app_metadata": {}             // App metadata
}
```

## Environment Variables

**Required in `go-backend/.env`:**
```bash
SUPABASE_JWT_SECRET=your-jwt-secret-here
```

**Where to find JWT secret:**
1. Go to Supabase Dashboard → Project Settings → API
2. Copy "JWT Secret" (NOT the anon/service role keys)
3. Add to `go-backend/.env` as `SUPABASE_JWT_SECRET`

## Security Improvements

### Before
❌ All routes publicly accessible  
❌ Authorization headers accepted but not validated  
❌ Frontend sends tokens but backend ignores them  
❌ No user context in handlers  

### After
✅ All data routes require valid JWT token  
✅ Tokens validated using Supabase JWT secret  
✅ Invalid tokens return 401 Unauthorized  
✅ User context available in all handlers  
✅ Public routes (docs, health) still accessible  

## Testing

### Test with curl
```bash
# Without token (should fail with 401)
curl https://backend.maticslab.com/api/v1/workspaces

# With valid token (should succeed)
curl -H "Authorization: Bearer <your-supabase-jwt-token>" \
     https://backend.maticslab.com/api/v1/workspaces
```

### Test with frontend
Frontend already configured correctly - tokens sent automatically via `goFetch()`. No frontend changes needed.

### Debug mode
Enable debug middleware in development to log token claims:
```go
// In router.go
api.Use(middleware.DebugTokenMiddleware())
```

## Handler Usage Examples

### Get current user ID
```go
func CreateWorkspace(c *gin.Context) {
    userID, exists := middleware.GetUserID(c)
    if !exists {
        c.JSON(400, gin.H{"error": "User ID not found"})
        return
    }
    
    // Use userID for created_by field
    workspace.CreatedBy = userID
}
```

### Get user email
```go
func GetUserProfile(c *gin.Context) {
    email, _ := middleware.GetUserEmail(c)
    // Use email
}
```

### Get full claims
```go
func SomeHandler(c *gin.Context) {
    claims, exists := middleware.GetUserClaims(c)
    if exists {
        metadata := claims.Meta
        // Access user_metadata, app_metadata, etc.
    }
}
```

## Deployment Checklist

- [x] Middleware created and tested
- [x] Routes protected with AuthMiddleware
- [x] JWT package installed
- [x] Build passes without errors
- [ ] `SUPABASE_JWT_SECRET` added to Render environment variables
- [ ] Deploy to Render
- [ ] Test with frontend on maticsapp.com
- [ ] Verify 401 responses for unauthenticated requests

## Next Steps

1. **Deploy to Render:**
   - Add `SUPABASE_JWT_SECRET` environment variable in Render dashboard
   - Redeploy backend service

2. **Add User Context to Handlers:**
   - Update `CreateWorkspace`, `CreateDataTable`, etc. to use `middleware.GetUserID(c)`
   - Set `created_by` and `updated_by` fields automatically

3. **Add Row-Level Security:**
   - Verify users can only access their organization's data
   - Add workspace ownership checks in handlers

4. **Error Handling:**
   - Add better error messages for expired tokens
   - Log auth failures for security monitoring

## References

- [Supabase Server-Side Auth](https://supabase.com/docs/guides/auth/server-side)
- [Validating JWTs](https://supabase.com/docs/guides/auth/server-side/validating-jwts)
- [golang-jwt/jwt](https://github.com/golang-jwt/jwt)
