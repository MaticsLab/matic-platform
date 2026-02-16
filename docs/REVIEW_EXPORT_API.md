# Review Export API - Phase 1 Complete

## Overview

The Review Export API provides comprehensive submission data for review workspaces with optimized performance and flexible CSV export capabilities.

## Backend Implementation

### Model: `ReviewSubmissionExport`

Location: `go-backend/models/review_export.go`

Comprehensive data structure that aggregates:
- Form submission core data
- Applicant information (from Better Auth)
- Form data (JSONB flattened)
- Recommendation requests and their statuses
- Workflow/review information (when available)

### Handler: `GetReviewExportData`

Location: `go-backend/handlers/review_export.go`

**Endpoint:** `GET /api/v1/review-export`

**Query Parameters:**
- `workspace_id` (required) - UUID of the workspace
- `form_id` (optional) - Filter by specific form
- `status` (optional) - Filter by submission status (draft, submitted, in_progress)
- `submitted_after` (optional) - ISO datetime filter
- `submitted_before` (optional) - ISO datetime filter

**Response:**
```json
{
  "data": [
    {
      "submission_id": "uuid",
      "form_id": "uuid",
      "form_name": "Logan Scholarship Application",
      "status": "submitted",
      "submitted_at": "2026-02-15T10:30:00Z",
      "applicant_id": "ba_user_id",
      "applicant_email": "applicant@example.com",
      "applicant_name": "Jane Doe",
      "form_data": {
        "first_name": "Jane",
        "last_name": "Doe",
        "gpa": "3.8",
        "essay": "My essay text..."
      },
      "completion_percentage": 100,
      "recommendations_count": 3,
      "recommendations_pending": 1,
      "recommendations_submitted": 2,
      "recommendation_details": [
        {
          "id": "uuid",
          "recommender_name": "Dr. Smith",
          "recommender_email": "smith@university.edu",
          "status": "submitted",
          "submitted_at": "2026-02-14T15:20:00Z"
        }
      ]
    }
  ],
  "count": 1,
  "filters": {
    "workspace_id": "uuid",
    "form_id": "uuid",
    "status": "submitted"
  }
}
```

### Performance Optimizations

1. **Single Query with JOINs**: Fetches most data in one optimized query
2. **Batch Recommendation Fetch**: Gets all recommendations in one query using `IN` clause
3. **In-Memory Grouping**: Groups recommendations by submission_id in Go, not database
4. **JSONB Handling**: Efficiently parses form_data JSONB only once per submission

## Frontend Implementation

### API Client

Location: `src/lib/api/review-export-client.ts`

**Methods:**

```typescript
// Get structured data
const response = await reviewExportClient.getExportData({
  workspace_id: 'uuid',
  form_id: 'uuid', // optional
  status: 'submitted', // optional
})

// Export to CSV string
const csv = await reviewExportClient.exportToCSV({
  workspace_id: 'uuid',
})

// Download CSV file directly
await reviewExportClient.downloadCSV(
  { workspace_id: 'uuid' },
  'custom-filename.csv' // optional
)
```

### React Component

Location: `src/components/ReviewWorkspace/ReviewExportButton.tsx`

**Usage:**

```tsx
import { ReviewExportButton } from '@/components/ReviewWorkspace/ReviewExportButton'

function ReviewWorkspacePage({ workspaceId, formId }) {
  return (
    <div>
      <ReviewExportButton
        workspaceId={workspaceId}
        formId={formId} // optional
        status="submitted" // optional
      />
    </div>
  )
}
```

## CSV Export Format

The CSV export automatically flattens nested data:

### Standard Columns (Always Present)
- Submission ID
- Form Name
- Applicant Name
- Applicant Email
- Status
- Submitted At
- Started At
- Completion %
- Recommendations Total
- Recommendations Pending
- Recommendations Submitted

### Dynamic Form Field Columns
- Prefixed with "Form: " (e.g., "Form: first_name", "Form: gpa")
- Automatically includes all fields from all submissions
- Complex objects are JSON-stringified

### Dynamic Recommendation Columns
- "Rec 1 Name", "Rec 1 Email", "Rec 1 Status", "Rec 1 Submitted At"
- "Rec 2 Name", "Rec 2 Email", "Rec 2 Status", "Rec 2 Submitted At"
- Number of columns adapts to max recommendations across submissions

### Example CSV Output

```csv
Submission ID,Form Name,Applicant Name,Status,Form: first_name,Form: gpa,Rec 1 Name,Rec 1 Status
abc123,Logan Scholarship,Jane Doe,submitted,Jane,3.8,Dr. Smith,submitted
```

## Database Queries

### Main Query Structure

```sql
SELECT 
  fs.id as submission_id,
  fs.form_id,
  f.name as form_name,
  fs.status,
  fs.submitted_at,
  fs.user_id as applicant_id,
  COALESCE(u.email, '') as applicant_email,
  COALESCE(u.name, '') as applicant_name,
  fs.raw_data as form_data,
  fs.completion_percentage,
  fs.workflow_id,
  fs.assigned_reviewer_id
FROM form_submissions fs
LEFT JOIN forms f ON f.id = fs.form_id
LEFT JOIN ba_users u ON u.id = fs.user_id
WHERE f.workspace_id = ?
ORDER BY fs.created_at DESC
```

### Recommendations Batch Query

```sql
SELECT * 
FROM recommendation_requests 
WHERE submission_id IN (?, ?, ?) 
ORDER BY submission_id, created_at
```

## Testing

### Manual Test

```bash
# Start backend
cd go-backend && go run main.go

# Test endpoint
curl "http://localhost:8080/api/v1/review-export?workspace_id=YOUR_WORKSPACE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Integration Test

```typescript
// In your test file
import { reviewExportClient } from '@/lib/api/review-export-client'

test('exports submission data', async () => {
  const response = await reviewExportClient.getExportData({
    workspace_id: 'test-workspace-id',
  })
  
  expect(response.count).toBeGreaterThan(0)
  expect(response.data[0]).toHaveProperty('submission_id')
  expect(response.data[0]).toHaveProperty('form_data')
})
```

## Future Enhancements (Phase 2+)

### Week 2: Advanced Features
- [ ] Excel (.xlsx) export support
- [ ] Custom column selection
- [ ] Date range filters in UI
- [ ] Real-time export progress

### Week 3: Performance
- [ ] Database indexes for common queries
- [ ] Pagination for large datasets (>1000 submissions)
- [ ] Background job for very large exports
- [ ] Caching layer for repeated exports

### Week 4: Advanced Filtering
- [ ] Multi-status selection
- [ ] Reviewer assignment filters
- [ ] Recommendation status filters
- [ ] Custom field filters from form builder

## Migration Notes

- **No breaking changes**: All existing endpoints continue to work
- **Backward compatible**: Works alongside current data fetching
- **Performance**: Significantly faster than multiple API calls
- **Data integrity**: Reads from existing tables, no schema changes needed

## Support

For issues or questions:
1. Check the handler logs in `go-backend/handlers/review_export.go`
2. Verify workspace_id is valid UUID
3. Ensure user has access to the workspace
4. Check CORS settings if calling from frontend

## Deployment Checklist

- [x] Model created (`models/review_export.go`)
- [x] Handler implemented (`handlers/review_export.go`)
- [x] Routes registered (`router/router.go`)
- [x] TypeScript client created (`src/lib/api/review-export-client.ts`)
- [x] React component created (`src/components/ReviewWorkspace/ReviewExportButton.tsx`)
- [x] Go backend compiles successfully
- [ ] Test endpoint with real data
- [ ] Add to review workspace UI
- [ ] Deploy to staging
- [ ] Deploy to production
