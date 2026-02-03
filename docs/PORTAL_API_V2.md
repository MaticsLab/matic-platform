# Portal API v2 - Unified Forms Schema

## Overview
New portal endpoints that use the unified forms schema (`form_submissions` + `form_responses` tables) instead of the legacy `application_submissions` table.

## Migration Status
✅ **Completed**: Database migration to unified schema (27 users, 489 field responses)  
✅ **Completed**: New portal handlers created  
✅ **Completed**: Routes registered  
🚧 **Pending**: Frontend portal component updates

## Endpoints

### 1. Get or Create Draft Submission
**POST** `/api/v1/portal/v2/forms/:form_id/submissions`

Creates a new draft submission or returns existing draft for the authenticated user.

**Auth**: Required (`PortalAuthMiddlewareV2`)

**Response**:
```json
{
  "id": "uuid",
  "form_id": "uuid",
  "user_id": "text-id",
  "status": "draft",
  "data": {},
  "created_at": "2026-02-02T..."
}
```

**Errors**:
- `404`: Form not found
- `400`: Form not published or deadline passed
- `409`: User already has draft or submitted application

---

### 2. Get Submission with Responses
**GET** `/api/v1/portal/v2/submissions/:id`

Fetches submission with all field responses converted to JSONB-like format for frontend compatibility.

**Auth**: Required (user must own the submission)

**Response**:
```json
{
  "id": "uuid",
  "form_id": "uuid",
  "user_id": "text-id",
  "status": "draft|submitted|under_review|approved|rejected",
  "data": {
    "field_key_1": "text value",
    "field_key_2": 42,
    "field_key_3": true,
    "field_key_4": {"json": "object"}
  },
  "submitted_at": "2026-02-02T...",
  "created_at": "2026-02-02T..."
}
```

**Errors**:
- `404`: Submission not found
- `403`: Submission belongs to different user

---

### 3. Update Submission Responses
**PUT** `/api/v1/portal/v2/submissions/:id`

Updates field responses for a submission. Automatically detects value types and stores in appropriate columns.

**Auth**: Required (user must own the submission)

**Request Body**:
```json
{
  "data": {
    "field_key_1": "new value",
    "field_key_2": 123,
    "field_key_3": {"nested": "json"}
  }
}
```

**Response**:
```json
{
  "id": "uuid",
  "updated_count": 3,
  "message": "Submission updated successfully"
}
```

**Type Detection**:
- `string` → `value_text`
- `number` → `value_number`
- `boolean` → `value_boolean`
- `object/array` → `value_json`

**Errors**:
- `404`: Submission not found
- `403`: Submission belongs to different user
- `400`: Submission already submitted (cannot edit)

---

## Schema Mapping

### Old Schema (JSONB)
```
table_rows: {
  id: uuid,
  data_table_id: uuid,
  data: jsonb,  // All fields in one JSONB column
  created_by: uuid
}
```

### New Schema (Normalized)
```
form_submissions: {
  id: uuid,
  form_id: uuid,
  user_id: text,
  status: text,
  submitted_at: timestamp
}

form_responses: {
  id: uuid,
  submission_id: uuid,
  field_id: uuid,
  field_key: text,
  value_type: text,
  value_text: text,      // For text fields
  value_number: numeric, // For numbers
  value_boolean: boolean,// For checkboxes
  value_json: jsonb      // For arrays/objects
}
```

## Benefits
1. **Type Safety**: Proper column types for different data types
2. **Queryability**: Can query/filter by specific field values
3. **Validation**: Database constraints enforce data integrity
4. **Performance**: Indexed columns for faster queries
5. **History**: Separate table for tracking changes (future)

## Backwards Compatibility
- Old handlers in `portal_dashboard.go` still use `table_rows`
- Legacy routes commented out but not deleted
- `submissions.go` renamed to `submissions.go.deprecated`
- Portal can use both old and new endpoints during transition

## Next Steps
1. ✅ Routes registered in `router.go`
2. ⏳ Update `GetApplicantDashboard` to use new schema
3. ⏳ Update frontend components to call new endpoints
4. ⏳ Test with real user data
5. ⏳ Remove legacy `table_rows` queries
6. ⏳ Add field response history tracking
