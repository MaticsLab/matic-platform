# Review Workspace Migration: Tabs → Breadcrumbs

## What Changed

### Before (Tab System)
```
ApplicationsHub (Tab)
  └── ApplicationManager
      ├── Uses WorkspaceTabProvider
      ├── Uses setTabHeaderContent()
      ├── Uses setTabActions()
      └── Sub-tabs: Review | Workflows | Analytics
```

### After (Breadcrumb System)
```
Breadcrumbs: Applications > Form Name
  └── ApplicationManager
      ├── Uses useBreadcrumbs()
      ├── Sets page actions in breadcrumb bar
      └── Just shows review content (workflows/analytics can be separate routes if needed)
```

## Files to Replace

### 1. ApplicationManager.tsx

**Before:**
- Uses `useTabContext()`
- Has `setTabHeaderContent()` for tab navigation
- Has `setTabActions()` for buttons
- Manages sub-tabs (review, workflows, analytics)

**After:**
- Uses `useBreadcrumbs()`
- Sets breadcrumbs and actions
- Simplified - just shows review content
- Other tabs can be separate routes later

**To migrate:**
```bash
# Backup old file
mv src/components/ApplicationsHub/Applications/ApplicationManager.tsx \
   src/components/ApplicationsHub/Applications/ApplicationManager.OLD.tsx

# Use new breadcrumb version
mv src/components/ApplicationsHub/Applications/ApplicationManager.BREADCRUMB.tsx \
   src/components/ApplicationsHub/Applications/ApplicationManager.tsx
```

### 2. ReviewWorkspaceV2 (No changes needed)

The `Review/v2/index.tsx` and `SubmissionViewer.tsx` are already self-contained and don't use the tab system. They'll work as-is with the new breadcrumb navigation.

## How Navigation Works Now

### Before (Tab-based):
```tsx
// Click "View Application" opens new tab
tabManager.openApplication(applicationId)
```

### After (Route-based):
```tsx
// Click "View Application" navigates to route
router.push(`/workspace/${slug}/applications/${formId}`)
```

## Breadcrumb Structure

When viewing an application:

```
Home > Applications > "Summer Program 2024"
                          ↑ Form name
With actions: [Team] [⚙️]
```

When viewing a specific submission:

```
Home > Applications > "Summer Program 2024" > "John Doe"
                          ↑ Form name        ↑ Applicant name
```

## ApplicationsHub Changes

The ApplicationsHub component needs a small update to use router navigation:

**Before:**
```tsx
const handleViewApplication = (formId: string) => {
  tabManager?.openApplication(formId)
}
```

**After:**
```tsx
const handleViewApplication = (formId: string) => {
  router.push(`/workspace/${workspaceSlug}/applications/${formId}`)
}
```

## Testing Checklist

After migration:
- [ ] Click on application from list → navigates to review page
- [ ] Breadcrumbs show: Applications > Form Name
- [ ] Team button opens reviewers panel
- [ ] Settings button opens settings modal
- [ ] Browser back/forward works correctly
- [ ] Reviewers panel overlays correctly
- [ ] Search functionality still works
- [ ] Filters still work
- [ ] Submission selection works

## Removed Features (for simplification)

The old ApplicationManager had sub-tabs for:
- ✅ **Review** - Kept as main view
- ❌ **Workflows** - Removed (can add as separate route later)
- ❌ **Analytics** - Removed (can add as separate route later)

If you need Workflows/Analytics back, create separate pages:
- `/workspace/[slug]/applications/[formId]/workflows`
- `/workspace/[slug]/applications/[formId]/analytics`

## Benefits

✅ Simpler code - removed ~50 lines of tab management
✅ Better UX - clear navigation path
✅ Mobile-friendly - no horizontal tab scrolling
✅ Proper URLs - can share direct links
✅ Browser history - back button works naturally
