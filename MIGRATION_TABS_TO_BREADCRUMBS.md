# Migration Guide: Tabs → Breadcrumbs

## Overview
Replace the browser-style tab system with breadcrumb navigation for cleaner UI and better mobile support.

## What's Changing

### Before (Tab System)
- `WorkspaceTabProvider` - Manages multiple open tabs
- `TabManager` - Opens/closes tabs like a browser
- `TabNavigation` - Shows tab bar at top
- `TabContentRouter` - Routes based on active tab
- Complex state management for multiple views

### After (Breadcrumb System)
- `BreadcrumbProvider` - Tracks current page context
- `BreadcrumbBar` - Shows navigation path
- `useBreadcrumbs()` hook - Pages set their own breadcrumbs
- Standard Next.js routing
- Simpler, more predictable navigation

## Step-by-Step Migration

### 1. Update `/workspace/[slug]/page.tsx`

**Remove:**
```tsx
import { WorkspaceTabProvider } from '@/components/WorkspaceTabProvider'
import { TabContentRouter } from '@/components/TabContentRouter'
```

**Add:**
```tsx
import { BreadcrumbProvider } from '@/components/BreadcrumbProvider'
import { BreadcrumbBar } from '@/components/BreadcrumbBar'
```

**Replace:**
```tsx
<WorkspaceTabProvider workspaceId={workspaceId}>
  <NavigationLayout workspaceSlug={slug}>
    <TabContentRouter />
  </NavigationLayout>
</WorkspaceTabProvider>
```

**With:**
```tsx
<BreadcrumbProvider workspaceSlug={slug}>
  <NavigationLayout workspaceSlug={slug}>
    <BreadcrumbBar />
    {children}
  </NavigationLayout>
</BreadcrumbProvider>
```

### 2. Update NavigationLayout

**Remove:**
```tsx
import { TabNavigation } from './TabNavigation'
import { useTabContext } from './WorkspaceTabProvider'
```

**Remove TabNavigation component:**
```tsx
<TabNavigation />  // Delete this line
```

### 3. Update Individual Pages

Each page should set its own breadcrumbs. Example for a table page:

```tsx
'use client'

import { useBreadcrumbs } from '@/hooks/useBreadcrumbs'
import { Database } from 'lucide-react'

export function TablePage({ tableId, tableName }) {
  // Set breadcrumbs for this page
  useBreadcrumbs([
    { label: 'Tables', href: `/workspace/${workspaceSlug}/tables` },
    { label: tableName, href: `/workspace/${workspaceSlug}/tables/${tableId}`, icon: Database }
  ], {
    actions: (
      <>
        <Button onClick={handleExport}>Export</Button>
        <Button onClick={handleShare}>Share</Button>
      </>
    )
  })

  return <div>Table content...</div>
}
```

### 4. Navigation Pattern Changes

**Before (Tab system):**
```tsx
tabManager.openTable(tableId)  // Opens in new tab
```

**After (Standard routing):**
```tsx
router.push(`/workspace/${workspaceSlug}/tables/${tableId}`)  // Navigate to page
```

### 5. Files to Update

- [ ] `/workspace/[slug]/page.tsx` - Add BreadcrumbProvider
- [ ] `NavigationLayout.tsx` - Remove TabNavigation, add BreadcrumbBar
- [ ] `ApplicationsHub.tsx` - Use router.push instead of tabManager
- [ ] `TablesListPage.tsx` - Add breadcrumbs
- [ ] `CRM page` - Add breadcrumbs
- [ ] Each detail page - Add breadcrumbs

### 6. Files to Delete (after migration)

- `WorkspaceTabProvider.tsx`
- `TabManager` class in `lib/tab-manager.ts`
- `TabNavigation.tsx`
- `TabContentRouter.tsx`
- `TabActionBar.tsx`

## Example: Migrate Applications Hub

**Before:**
```tsx
// Opens application in new tab
tabManager.openApplication(application.id)
```

**After:**
```tsx
'use client'

import { useBreadcrumbs } from '@/hooks/useBreadcrumbs'
import { useRouter } from 'next/navigation'

function ApplicationsHub() {
  const router = useRouter()

  useBreadcrumbs([
    { label: 'Applications', href: `/workspace/${workspaceSlug}/applications` }
  ])

  const handleViewApplication = (appId: string) => {
    router.push(`/workspace/${workspaceSlug}/applications/${appId}`)
  }

  return // ... applications list
}
```

## Benefits

✅ Simpler codebase - no tab state management
✅ Better mobile experience
✅ Standard browser back/forward works
✅ Cleaner UI - no tab bar clutter
✅ Easier to understand navigation flow
✅ Better SEO - proper URLs for each page

## Testing Checklist

After migration, test:
- [ ] Navigation from sidebar works
- [ ] Breadcrumbs show correct path
- [ ] Browser back/forward works
- [ ] Deep links work (e.g., `/workspace/acme/tables/123`)
- [ ] Page actions appear in breadcrumb bar
- [ ] Mobile navigation works
