# Submission Views System

## Overview

Modern, APITable-inspired multi-view submission management system with Grid, Kanban, Calendar, and Gallery views. Built with shadcn/ui components for a polished, professional interface.

## Features

### 🎯 Multiple View Types
- **Grid View**: Sortable, filterable table with inline actions and bulk operations
- **Kanban View**: Drag-and-drop cards organized by status columns
- **Calendar View**: Date-based visualization with daily submission details
- **Gallery View**: Card-based layout perfect for visual browsing

### ⚡ Advanced Features
- Real-time search across all submission fields
- Multi-field sorting (ascending/descending)
- Custom filters with multiple operators
- Column visibility controls
- Bulk selection and operations
- CSV export functionality
- Responsive design

### 🎨 UI/UX
- Clean, modern interface using shadcn/ui
- Smooth animations and transitions
- Drag-and-drop support in Kanban view
- Keyboard shortcuts support
- Loading states and error handling

## Architecture

```
src/components/SubmissionViews/
├── types.ts                 # TypeScript interfaces
├── ViewContainer.tsx        # Main orchestrator component
├── ViewToolbar.tsx          # View switcher and controls
├── GridView.tsx             # Table view with sorting
├── KanbanView.tsx           # Drag-drop board view
├── CalendarView.tsx         # Calendar view with date-fns
├── GalleryView.tsx          # Card grid view
└── index.ts                 # Public exports
```

## Usage

### Basic Implementation

```tsx
import { ViewContainer } from '@/components/SubmissionViews';

function MySubmissionsPage() {
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  return (
    <div className="h-screen flex flex-col">
      <ViewContainer
        workspaceId="workspace-123"
        formId="form-456"
        onSubmissionClick={setSelectedSubmission}
      />
      
      {/* Optional detail panel */}
      {selectedSubmission && (
        <SubmissionDetailPanel 
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
        />
      )}
    </div>
  );
}
```

### With Custom Filters

```tsx
<ViewContainer
  workspaceId={workspaceId}
  formId={formId}
  onSubmissionClick={handleClick}
  initialFilters={[
    { field: 'status', operator: 'equals', value: 'pending' }
  ]}
  initialView="kanban"
/>
```

## View-Specific Features

### Grid View
- Click column headers to sort
- Checkbox selection for bulk actions
- Row hover effects
- Inline action menus
- Dynamic field rendering based on type

### Kanban View
- Drag cards between status columns
- Real-time status updates via API
- Visual grouping by submission status
- Compact card layout with key info
- Configurable columns

### Calendar View
- Monthly view with navigation
- Daily submission counts
- Click dates to see details
- Sidebar with selected date submissions
- Color-coded status indicators

### Gallery View
- Card-based layout (responsive grid)
- Avatar generation from names
- Preview of key fields
- Progress indicators
- Document attachment badges

## Field Type Handling

The system intelligently renders different field types:

- **Email**: Clickable mailto links
- **Phone**: Clickable tel links
- **URL**: External links with safety
- **Boolean**: Checkmark/X symbols
- **Date/DateTime**: Localized formatting
- **Arrays**: Comma-separated display
- **Files**: File count indicators
- **Long text**: Automatic truncation with tooltips

## Styling & Theming

Built on shadcn/ui, fully compatible with your Tailwind theme:

```tsx
// Uses your existing design tokens
const STATUS_COLORS = {
  submitted: 'bg-blue-100 text-blue-800',
  'in-review': 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};
```

Customize by modifying the color mappings in each view component.

## Integration with Go Backend

The ViewContainer automatically handles:
- Loading form schema
- Fetching submissions with user data
- Status updates via PATCH endpoints
- Bulk operations
- Error handling with toast notifications

### Required API Endpoints

```
GET  /forms/:formId                           # Form details
GET  /forms/:formId/submissions               # List submissions
PATCH /forms/:formId/submissions/:id          # Update submission
POST /forms/:formId/submissions/bulk-delete   # Bulk delete
```

## Performance Considerations

- **Memoization**: useMemo for expensive computations
- **Virtual Scrolling**: Consider for 1000+ submissions
- **Lazy Loading**: Calendar view loads month-by-month
- **Debounced Search**: 300ms delay on search input
- **Optimistic Updates**: Immediate UI feedback

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (responsive)

## Dependencies

```json
{
  "date-fns": "^4.1.0",           // Date formatting
  "lucide-react": "^0.544.0",     // Icons
  "@radix-ui/*": "latest",        // shadcn primitives
  "sonner": "^2.0.7"              // Toast notifications
}
```

## Migration from Old System

Replaced `SubmissionTable` with `ViewContainer`:

**Before:**
```tsx
<SubmissionTable
  submissions={filteredSubmissions}
  onSelect={setSelected}
  fields={fields}
/>
```

**After:**
```tsx
<ViewContainer
  workspaceId={workspaceId}
  formId={formId}
  onSubmissionClick={setSelected}
/>
```

Benefits:
- Self-contained data loading
- Built-in filtering/sorting
- Multiple view types
- Better UX with modern patterns

## Future Enhancements

- [ ] Save view configurations per user
- [ ] Custom column ordering (Grid)
- [ ] Timeline view
- [ ] Pivot table view
- [ ] Advanced filter builder with AND/OR logic
- [ ] Real-time collaboration indicators
- [ ] Keyboard shortcuts
- [ ] Mobile-optimized gestures

## Contributing

When adding new views:

1. Create `NewView.tsx` in `src/components/SubmissionViews/`
2. Add view type to `types.ts`
3. Add icon to `ViewToolbar.tsx`
4. Add case in `ViewContainer.tsx` render section
5. Export from `index.ts`

## License

Part of Matic Platform - Internal use only
