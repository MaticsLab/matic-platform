# Better Auth Migration Guide

## Overview

This guide helps you gradually migrate from the old file structure to the new centralized `/auth` directory.

## Old Structure → New Structure

| Old Location | New Location | Status |
|--------------|--------------|--------|
| `src/lib/better-auth.ts` | `auth/server/main.ts` | ✅ Both work |
| `src/lib/better-auth-client.ts` | `auth/client/main.ts` | ✅ Both work |
| `src/lib/portal-better-auth.ts` | `auth/server/portal.ts` | ✅ Both work |
| `src/lib/portal-better-auth-client.ts` | `auth/client/portal.ts` | ✅ Both work |

## Migration Strategy

### ✅ Recommended: Gradual Migration

1. **Keep old files working** (already done - no changes needed)
2. **Use new structure for NEW code**
3. **Update old code incrementally**

### Phase 1: New Code (Start Now)

For all NEW components and API routes, use the centralized structure:

```typescript
// ✅ New code - use centralized auth
import { auth } from '@/auth/server/main'
import { authClient, useSession } from '@/auth/client/main'
```

### Phase 2: Update Imports (Gradual)

Update existing files one at a time using find & replace:

#### Server-Side Updates

**Find:**
```typescript
import { auth } from '@/lib/better-auth'
import { getAuth } from '@/lib/better-auth'
```

**Replace with:**
```typescript
import { auth } from '@/auth/server/main'
import { getAuth } from '@/auth/server/main'
```

#### Client-Side Updates

**Find:**
```typescript
import { authClient, useSession } from '@/lib/better-auth-client'
import { organizationAPI } from '@/lib/better-auth-client'
```

**Replace with:**
```typescript
import { authClient, useSession } from '@/auth/client/main'
import { organizationAPI } from '@/auth/client/main'
```

#### Portal Updates

**Find:**
```typescript
import { portalAuth } from '@/lib/portal-better-auth'
import { portalBetterAuthClient } from '@/lib/portal-better-auth-client'
```

**Replace with:**
```typescript
import { portalAuth } from '@/auth/server/portal'
import { portalAuthClient } from '@/auth/client/portal'
```

### Phase 3: Remove Old Files (When Ready)

Once all imports are updated and tested:

```bash
# Backup first!
mkdir -p old-auth-backup
cp src/lib/better-auth*.ts old-auth-backup/
cp src/lib/portal-better-auth*.ts old-auth-backup/

# Then remove
rm src/lib/better-auth.ts
rm src/lib/better-auth-client.ts  
rm src/lib/portal-better-auth.ts
rm src/lib/portal-better-auth-client.ts
```

## Testing Your Migration

### 1. Server-Side Test

Create a test API route to verify server imports work:

```typescript
// app/api/test-auth/route.ts
import { auth } from '@/auth/server/main'

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  return Response.json({ success: true, user: session?.user })
}
```

### 2. Client-Side Test

Create a test component to verify client imports work:

```typescript
// components/TestAuth.tsx
'use client'
import { useSession } from '@/auth/client/main'

export function TestAuth() {
  const { data: session } = useSession()
  return <div>User: {session?.user?.email || 'Not logged in'}</div>
}
```

### 3. Run Type Check

```bash
npm run build
# or
npx tsc --noEmit
```

## Automated Migration Script

You can create a script to help with bulk updates:

```bash
#!/bin/bash
# migrate-imports.sh

# Server imports
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' \
  "s|from '@/lib/better-auth'|from '@/auth/server/main'|g"

# Client imports  
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' \
  "s|from '@/lib/better-auth-client'|from '@/auth/client/main'|g"

# Portal server
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' \
  "s|from '@/lib/portal-better-auth'|from '@/auth/server/portal'|g"

# Portal client
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' \
  "s|from '@/lib/portal-better-auth-client'|from '@/auth/client/portal'|g"

echo "✅ Import migration complete!"
echo "⚠️  Please review changes and test thoroughly"
```

**Usage:**
```bash
chmod +x migrate-imports.sh
./migrate-imports.sh
git diff # Review changes
npm run build # Test
```

## Rollback Plan

If you need to rollback:

1. The old files still exist - they weren't deleted
2. Your git history has the original state
3. Simply revert the import changes:

```bash
git checkout -- src/
```

## Benefits of New Structure

✅ **Better CLI Integration** - Generate types, run migrations
✅ **Cleaner Organization** - Dedicated auth directory
✅ **Shared Utilities** - DRY principle (database, email, helpers)
✅ **Clearer Intent** - Separate server/client, main/portal
✅ **Easier Testing** - Mock individual modules
✅ **Better Documentation** - Everything in one place

## Questions?

Check these files:
- [SETUP_COMPLETE.md](./SETUP_COMPLETE.md) - Setup overview
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Common patterns
- [README.md](./README.md) - General documentation

## Common Issues

### "Cannot find module '@/auth/...'"

**Solution:** Check `tsconfig.json` has:
```json
{
  "paths": {
    "@/auth/*": ["./auth/*"]
  }
}
```

### "Module has no exported member 'auth'"

**Solution:** Check you're importing from the right location:
- Server: `@/auth/server/main` or `@/auth/server/portal`
- Client: `@/auth/client/main` or `@/auth/client/portal`

### Type errors after migration

**Solution:** Regenerate types:
```bash
npx @better-auth/cli generate
npm run build
```

### Old and new imports mixed

This is OK! Both work simultaneously. Migrate gradually.
