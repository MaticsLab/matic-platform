# Field Types Reference

This document describes all available field types in Matic forms and tables, including their JSON structure for storage and configuration.

---

## Categories

Field types are organized into 4 categories:

| Category | Description |
|----------|-------------|
| `primitive` | Basic input types (text, numbers, dates, etc.) |
| `container` | Fields that contain other fields (groups, repeaters) |
| `layout` | Visual/structural elements (headings, dividers) |
| `special` | Complex field types with custom logic |

---

## Primitive Fields

### `text` - Short Text
Single line text input.

```json
{
  "id": "text",
  "category": "primitive",
  "label": "Short Text",
  "icon": "type",
  "storage_schema": {
    "type": "string",
    "maxLength": 500
  },
  "default_config": {
    "maxLength": 500,
    "minLength": 0,
    "placeholder": ""
  }
}
```

**Stored Value Example:**
```json
"John Doe"
```

---

### `textarea` - Long Text
Multi-line text area.

```json
{
  "id": "textarea",
  "category": "primitive",
  "label": "Long Text",
  "icon": "align-left",
  "storage_schema": {
    "type": "string"
  },
  "default_config": {
    "rows": 3,
    "maxLength": 10000,
    "placeholder": ""
  }
}
```

**Stored Value Example:**
```json
"This is a longer description that spans multiple lines..."
```

---

### `number` - Number
Numeric input with formatting options.

```json
{
  "id": "number",
  "category": "primitive",
  "label": "Number",
  "icon": "hash",
  "storage_schema": {
    "type": "number"
  },
  "default_config": {
    "max": null,
    "min": null,
    "format": "decimal",
    "precision": 2,
    "placeholder": "0"
  }
}
```

**Stored Value Example:**
```json
42.5
```

---

### `percent` - Percentage
Percentage value (0-100).

```json
{
  "id": "percent",
  "category": "primitive",
  "label": "Percentage",
  "icon": "Percent",
  "input_schema": {
    "step": 0.01,
    "type": "number"
  },
  "storage_schema": {
    "type": "number",
    "maximum": 100,
    "minimum": 0
  },
  "config_schema": {
    "type": "object",
    "properties": {
      "max": { "type": "number" },
      "min": { "type": "number" },
      "decimals": { "type": "integer", "default": 0 }
    }
  },
  "default_config": {
    "max": 100,
    "min": 0,
    "decimals": 0
  }
}
```

**Stored Value Example:**
```json
75.5
```

---

### `email` - Email
Email address input with validation.

```json
{
  "id": "email",
  "category": "primitive",
  "label": "Email",
  "icon": "mail",
  "storage_schema": {
    "type": "string",
    "format": "email"
  },
  "default_config": {
    "placeholder": "email@example.com"
  }
}
```

**Stored Value Example:**
```json
"user@example.com"
```

---

### `phone` - Phone
Phone number input.

```json
{
  "id": "phone",
  "category": "primitive",
  "label": "Phone",
  "icon": "phone",
  "storage_schema": {
    "type": "string",
    "pattern": "^[+]?[0-9\\-\\s()]+$"
  },
  "default_config": {
    "format": "us",
    "placeholder": "(555) 123-4567"
  }
}
```

**Stored Value Example:**
```json
"+1 (555) 123-4567"
```

---

### `url` - URL
Web address input.

```json
{
  "id": "url",
  "category": "primitive",
  "label": "URL",
  "icon": "link",
  "storage_schema": {
    "type": "string",
    "format": "uri"
  },
  "default_config": {
    "placeholder": "https://",
    "requireHttps": false
  }
}
```

**Stored Value Example:**
```json
"https://www.example.com"
```

---

### `date` - Date
Date picker (without time).

```json
{
  "id": "date",
  "category": "primitive",
  "label": "Date",
  "icon": "calendar",
  "storage_schema": {
    "type": "string",
    "format": "date"
  },
  "default_config": {
    "format": "YYYY-MM-DD",
    "maxDate": null,
    "minDate": null
  }
}
```

**Stored Value Example:**
```json
"2026-01-27"
```

---

### `datetime` - Date & Time
Date and time picker.

```json
{
  "id": "datetime",
  "category": "primitive",
  "label": "Date & Time",
  "icon": "clock",
  "storage_schema": {
    "type": "string",
    "format": "date-time"
  },
  "default_config": {
    "format": "YYYY-MM-DDTHH:mm",
    "timezone": "local"
  }
}
```

**Stored Value Example:**
```json
"2026-01-27T14:30:00Z"
```

---

### `time` - Time
Time picker (no date).

```json
{
  "id": "time",
  "category": "primitive",
  "label": "Time",
  "icon": "clock",
  "storage_schema": {
    "type": "string",
    "format": "time"
  },
  "default_config": {
    "format": "HH:mm"
  }
}
```

**Stored Value Example:**
```json
"14:30"
```

---

### `select` - Dropdown
Single selection dropdown.

```json
{
  "id": "select",
  "category": "primitive",
  "label": "Dropdown",
  "icon": "chevron-down",
  "storage_schema": {
    "type": "string"
  },
  "default_config": {
    "options": [],
    "allowCustom": false,
    "placeholder": "Select..."
  }
}
```

**Config Example:**
```json
{
  "options": [
    { "value": "option1", "label": "Option 1" },
    { "value": "option2", "label": "Option 2" }
  ],
  "placeholder": "Choose an option..."
}
```

**Stored Value Example:**
```json
"option1"
```

---

### `multiselect` - Multi-Select
Multiple selection dropdown.

```json
{
  "id": "multiselect",
  "category": "primitive",
  "label": "Multi-Select",
  "icon": "list",
  "storage_schema": {
    "type": "array",
    "items": { "type": "string" }
  },
  "default_config": {
    "options": [],
    "placeholder": "Select multiple...",
    "maxSelections": null
  }
}
```

**Stored Value Example:**
```json
["option1", "option3", "option5"]
```

---

### `radio` - Radio
Radio button group (single selection).

```json
{
  "id": "radio",
  "category": "primitive",
  "label": "Radio",
  "icon": "circle-dot",
  "storage_schema": {
    "type": "string"
  },
  "default_config": {
    "layout": "vertical",
    "options": []
  }
}
```

**Stored Value Example:**
```json
"yes"
```

---

### `checkbox` - Checkbox
Boolean checkbox.

```json
{
  "id": "checkbox",
  "category": "primitive",
  "label": "Checkbox",
  "icon": "check-square",
  "storage_schema": {
    "type": "boolean"
  },
  "default_config": {
    "label": "Yes",
    "defaultValue": false
  }
}
```

**Stored Value Example:**
```json
true
```

---

### `address` - Address
Structured address input with optional geocoding.

```json
{
  "id": "address",
  "category": "primitive",
  "label": "Address",
  "storage_schema": {
    "type": "object",
    "required": ["full_address"],
    "properties": {
      "city": { "type": "string" },
      "state": { "type": "string" },
      "country": { "type": "string" },
      "latitude": { "type": "number" },
      "longitude": { "type": "number" },
      "place_name": { "type": "string" },
      "postal_code": { "type": "string" },
      "country_code": { "type": "string" },
      "full_address": { "type": "string" },
      "street_address": { "type": "string" }
    }
  },
  "default_config": {
    "placeholder": "Enter address...",
    "requireGeocode": false
  }
}
```

**Stored Value Example:**
```json
{
  "full_address": "123 Main St, San Francisco, CA 94102",
  "street_address": "123 Main St",
  "city": "San Francisco",
  "state": "CA",
  "postal_code": "94102",
  "country": "United States",
  "country_code": "US",
  "latitude": 37.7749,
  "longitude": -122.4194
}
```

---

## Container Fields

### `group` - Field Group
Groups related fields together.

```json
{
  "id": "group",
  "category": "container",
  "label": "Field Group",
  "icon": "folder",
  "is_container": true,
  "storage_schema": {
    "type": "object",
    "additionalProperties": true
  },
  "default_config": {
    "children": [],
    "collapsible": false,
    "defaultCollapsed": false
  }
}
```

**Stored Value Example:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "middle_name": "William"
}
```

---

### `repeater` - Repeater
Add multiple items with the same structure.

```json
{
  "id": "repeater",
  "category": "container",
  "label": "Repeater",
  "icon": "list-plus",
  "is_container": true,
  "storage_schema": {
    "type": "array",
    "items": {
      "type": "object",
      "additionalProperties": true
    }
  },
  "default_config": {
    "children": [],
    "maxItems": null,
    "minItems": 0,
    "itemLabel": "Item",
    "addButtonLabel": "Add Item"
  }
}
```

**Config Example (with child fields):**
```json
{
  "children": [
    { "id": "org_name", "type": "text", "label": "Organization Name" },
    { "id": "role", "type": "text", "label": "Role/Title" },
    { "id": "start_date", "type": "date", "label": "Start Date" },
    { "id": "end_date", "type": "date", "label": "End Date" }
  ],
  "minItems": 1,
  "maxItems": 10,
  "itemLabel": "Activity",
  "addButtonLabel": "Add Activity"
}
```

**Stored Value Example:**
```json
[
  {
    "org_name": "Tech Corp",
    "role": "Software Engineer",
    "start_date": "2020-01-15",
    "end_date": "2023-06-30"
  },
  {
    "org_name": "Startup Inc",
    "role": "Lead Developer",
    "start_date": "2023-07-01",
    "end_date": null
  }
]
```

---

## Layout Fields

Layout fields are visual elements that do not store data.

### `heading` - Heading
Section heading text.

```json
{
  "id": "heading",
  "category": "layout",
  "label": "Heading",
  "icon": "heading",
  "storage_schema": {
    "type": "null"
  },
  "default_config": {
    "level": 2
  }
}
```

**Config Example:**
```json
{
  "level": 2,
  "text": "Personal Information"
}
```

---

### `paragraph` - Paragraph
Descriptive text block.

```json
{
  "id": "paragraph",
  "category": "layout",
  "label": "Paragraph",
  "icon": "text",
  "storage_schema": {
    "type": "null"
  },
  "default_config": {
    "text": ""
  }
}
```

**Config Example:**
```json
{
  "text": "Please fill out the following information accurately."
}
```

---

### `divider` - Divider
Horizontal line divider.

```json
{
  "id": "divider",
  "category": "layout",
  "label": "Divider",
  "icon": "minus",
  "storage_schema": {
    "type": "null"
  },
  "default_config": {
    "style": "solid",
    "spacing": "normal"
  }
}
```

---

### `section` - Section
Visual section divider with title (can contain child fields).

```json
{
  "id": "section",
  "category": "layout",
  "label": "Section",
  "icon": "layout",
  "is_container": true,
  "storage_schema": {
    "type": "null"
  },
  "default_config": {
    "children": [],
    "collapsible": true
  }
}
```

---

### `callout` - Callout Box
Highlighted information box.

```json
{
  "id": "callout",
  "category": "layout",
  "label": "Callout Box",
  "storage_schema": {
    "type": "null"
  },
  "default_config": {
    "icon": "lightbulb",
    "color": "blue"
  }
}
```

**Config Example:**
```json
{
  "icon": "alert-triangle",
  "color": "yellow",
  "text": "Important: Make sure to save your work frequently."
}
```

---

## Special Fields

### `file` - File Upload
File attachment.

```json
{
  "id": "file",
  "category": "special",
  "label": "File Upload",
  "icon": "paperclip",
  "storage_schema": {
    "type": "object",
    "properties": {
      "url": { "type": "string" },
      "name": { "type": "string" },
      "size": { "type": "number" },
      "mime_type": { "type": "string" }
    }
  },
  "default_config": {
    "accept": "*/*",
    "maxSize": 10485760,
    "maxFiles": 5,
    "multiple": false
  }
}
```

**Stored Value Example (single file):**
```json
{
  "url": "https://storage.example.com/files/abc123.pdf",
  "name": "resume.pdf",
  "size": 245678,
  "mime_type": "application/pdf"
}
```

**Stored Value Example (multiple files):**
```json
[
  {
    "url": "https://storage.example.com/files/doc1.pdf",
    "name": "transcript.pdf",
    "size": 123456,
    "mime_type": "application/pdf"
  },
  {
    "url": "https://storage.example.com/files/doc2.pdf",
    "name": "recommendation.pdf",
    "size": 234567,
    "mime_type": "application/pdf"
  }
]
```

---

### `image` - Image
Image upload with preview.

```json
{
  "id": "image",
  "category": "special",
  "label": "Image",
  "icon": "image",
  "storage_schema": {
    "type": "object",
    "properties": {
      "url": { "type": "string" },
      "name": { "type": "string" },
      "size": { "type": "number" },
      "width": { "type": "number" },
      "height": { "type": "number" }
    }
  },
  "default_config": {
    "accept": "image/*",
    "maxSize": 5242880,
    "maxFiles": 5,
    "multiple": false
  }
}
```

**Stored Value Example:**
```json
{
  "url": "https://storage.example.com/images/photo.jpg",
  "name": "profile_photo.jpg",
  "size": 156789,
  "width": 800,
  "height": 600
}
```

---

### `signature` - Signature
Digital signature capture.

```json
{
  "id": "signature",
  "category": "special",
  "label": "Signature",
  "icon": "pen-tool",
  "storage_schema": {
    "type": "string",
    "contentEncoding": "base64"
  },
  "default_config": {
    "width": 400,
    "height": 200,
    "penColor": "#000000"
  }
}
```

**Stored Value Example:**
```json
"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
```

---

### `rating` - Rating
Star rating input (0-5).

```json
{
  "id": "rating",
  "category": "special",
  "label": "Rating",
  "icon": "star",
  "storage_schema": {
    "type": "number",
    "maximum": 5,
    "minimum": 0
  },
  "default_config": {
    "allowHalf": false,
    "maxRating": 5
  }
}
```

**Stored Value Example:**
```json
4.5
```

---

### `rank` - Ranking
Drag to rank items in order.

```json
{
  "id": "rank",
  "category": "special",
  "label": "Ranking",
  "icon": "arrow-up-down",
  "storage_schema": {
    "type": "array",
    "items": { "type": "string" }
  },
  "default_config": {
    "options": [],
    "maxSelections": null
  }
}
```

**Config Example:**
```json
{
  "options": ["First Choice", "Second Choice", "Third Choice", "Fourth Choice"]
}
```

**Stored Value Example:**
```json
["Third Choice", "First Choice", "Fourth Choice", "Second Choice"]
```

---

### `item_list` - Item List
Dynamic list of items.

```json
{
  "id": "item_list",
  "category": "special",
  "label": "Item List",
  "icon": "list",
  "storage_schema": {
    "type": "array",
    "items": { "type": "string" }
  },
  "default_config": {
    "items": [],
    "maxItems": null,
    "minItems": 0
  }
}
```

**Stored Value Example:**
```json
["Item 1", "Item 2", "Item 3"]
```

---

### `link` - Link
Table link/reference field (foreign key).

```json
{
  "id": "link",
  "category": "special",
  "label": "Link",
  "storage_schema": {
    "type": "string",
    "format": "uuid"
  },
  "config_schema": {
    "display_field": "string",
    "linked_table_id": "string"
  },
  "default_config": {
    "displayField": null,
    "allowMultiple": false,
    "linkedTableId": null
  }
}
```

**Config Example:**
```json
{
  "linkedTableId": "abc123-def456-789",
  "displayField": "name",
  "allowMultiple": false
}
```

**Stored Value Example:**
```json
"row-uuid-12345-67890"
```

---

### `lookup` - Lookup
Lookup value from linked records.

```json
{
  "id": "lookup",
  "category": "special",
  "label": "Lookup",
  "storage_schema": {
    "type": "any"
  },
  "config_schema": {
    "lookup_field": "string",
    "link_field_id": "string"
  },
  "default_config": {
    "sourceFieldId": null,
    "linkedTableField": null
  }
}
```

---

### `rollup` - Rollup
Aggregated data from linked records.

```json
{
  "id": "rollup",
  "category": "special",
  "label": "Rollup",
  "storage_schema": {
    "type": "any"
  },
  "config_schema": {
    "function": "string",
    "rollup_field": "string",
    "link_field_id": "string"
  },
  "default_config": {
    "sourceFieldId": null,
    "aggregateFunction": "count"
  }
}
```

**Aggregate Functions:**
- `count` - Count of linked records
- `sum` - Sum of numeric field
- `avg` - Average of numeric field
- `min` - Minimum value
- `max` - Maximum value

---

### `formula` - Formula
Calculated formula field.

```json
{
  "id": "formula",
  "category": "special",
  "label": "Formula",
  "input_schema": {
    "type": "string"
  },
  "storage_schema": {
    "type": "any"
  },
  "config_schema": {
    "formula": "string",
    "output_type": "string"
  },
  "default_config": {
    "formula": "",
    "returnType": "text"
  }
}
```

---

### `recommendation` - Letter of Recommendation
Request and collect recommendations from external contacts.

```json
{
  "id": "recommendation",
  "category": "special",
  "label": "Letter of Recommendation",
  "storage_schema": {
    "type": "object",
    "properties": {
      "submission_id": { "type": "string" }
    }
  },
  "default_config": {
    "questions": [
      {
        "id": "relationship",
        "type": "text",
        "label": "How do you know the applicant?",
        "required": true
      },
      {
        "id": "recommendation",
        "type": "textarea",
        "label": "Please provide your recommendation",
        "required": true,
        "max_length": 5000
      }
    ],
    "instructions": "Please add your recommenders below...",
    "deadline_days": 14,
    "max_recommenders": 3,
    "min_recommenders": 1,
    "allow_applicant_edit": true,
    "show_status_to_applicant": true,
    "show_responses_to_applicant": false
  }
}
```

**Stored Value Example:**
```json
{
  "recommenders": [
    {
      "id": "rec-123",
      "name": "Dr. Smith",
      "email": "smith@university.edu",
      "status": "completed",
      "submitted_at": "2026-01-15T10:30:00Z"
    }
  ]
}
```

---

### `stage_status` - Stage Status
Application stage status tracking.

```json
{
  "id": "stage_status",
  "category": "special",
  "label": "Stage Status",
  "input_schema": {
    "enum": ["pending", "in_review", "approved", "rejected", "waitlisted"],
    "type": "string"
  },
  "storage_schema": {
    "type": "object",
    "properties": {
      "status": { "type": "string" },
      "moved_at": { "type": "string" },
      "moved_by": { "type": "string" },
      "stage_id": { "type": "string" }
    }
  },
  "config_schema": {
    "allowed_statuses": ["pending", "in_review", "approved", "rejected", "waitlisted"]
  },
  "default_config": {
    "stages": [],
    "defaultStage": null
  }
}
```

**Stored Value Example:**
```json
{
  "status": "in_review",
  "stage_id": "stage-456",
  "moved_at": "2026-01-20T14:00:00Z",
  "moved_by": "user-789"
}
```

---

### `reviewer_assignment` - Reviewer Assignment
Assigned reviewers for an application.

```json
{
  "id": "reviewer_assignment",
  "category": "special",
  "label": "Reviewer Assignment",
  "input_schema": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "role": { "type": "string" },
        "reviewer_id": { "type": "string" }
      }
    }
  },
  "storage_schema": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "assigned_at": { "type": "string" },
        "reviewer_id": { "type": "string" },
        "completed_at": { "type": "string" },
        "reviewer_type_id": { "type": "string" }
      }
    }
  },
  "config_schema": {
    "max_reviewers": 5,
    "required_reviewer_types": []
  },
  "default_config": {
    "maxReviewers": 3,
    "assignmentMode": "manual"
  }
}
```

**Stored Value Example:**
```json
[
  {
    "reviewer_id": "user-123",
    "reviewer_type_id": "faculty-reviewer",
    "assigned_at": "2026-01-10T09:00:00Z",
    "completed_at": "2026-01-15T11:30:00Z"
  },
  {
    "reviewer_id": "user-456",
    "reviewer_type_id": "committee-member",
    "assigned_at": "2026-01-10T09:00:00Z",
    "completed_at": null
  }
]
```

---

### `review_score` - Review Score
Rubric-based review score.

```json
{
  "id": "review_score",
  "category": "special",
  "label": "Review Score",
  "input_schema": {
    "type": "object",
    "properties": {
      "score": { "type": "number" },
      "max_score": { "type": "number" },
      "rubric_id": { "type": "string" }
    }
  },
  "storage_schema": {
    "type": "object",
    "properties": {
      "score": { "type": "number" },
      "max_score": { "type": "number" },
      "rubric_id": { "type": "string" },
      "criteria_scores": { "type": "object" }
    }
  },
  "config_schema": {
    "weight": 1,
    "rubric_id": "string"
  },
  "default_config": {
    "criteria": [],
    "maxScore": 5
  }
}
```

**Stored Value Example:**
```json
{
  "score": 4.2,
  "max_score": 5,
  "rubric_id": "rubric-123",
  "criteria_scores": {
    "academic_achievement": 4.5,
    "leadership": 4.0,
    "community_service": 4.0
  }
}
```

---

### `rubric_response` - Rubric Response
Response to a rubric criteria.

```json
{
  "id": "rubric_response",
  "category": "special",
  "label": "Rubric Response",
  "input_schema": {
    "type": "object",
    "properties": {
      "score": { "type": "number" },
      "comment": { "type": "string" },
      "criteria_id": { "type": "string" }
    }
  },
  "storage_schema": {
    "type": "object",
    "properties": {
      "score": { "type": "number" },
      "comment": { "type": "string" },
      "max_score": { "type": "number" },
      "scored_at": { "type": "string" },
      "scored_by": { "type": "string" },
      "criteria_id": { "type": "string" }
    }
  },
  "config_schema": {
    "show_comments": true,
    "require_comments_for_low_scores": true
  },
  "default_config": {
    "rubricId": null
  }
}
```

---

### `attendance_status` - Attendance Status
Attendance tracking status.

```json
{
  "id": "attendance_status",
  "category": "special",
  "label": "Attendance Status",
  "input_schema": {
    "enum": ["present", "absent", "late", "excused"],
    "type": "string"
  },
  "storage_schema": {
    "type": "object",
    "properties": {
      "status": { "type": "string" },
      "check_in_time": { "type": "string" },
      "check_out_time": { "type": "string" },
      "duration_minutes": { "type": "number" }
    }
  },
  "config_schema": {
    "late_threshold_minutes": 15,
    "auto_calculate_duration": true
  },
  "default_config": {
    "options": ["present", "absent", "tardy", "excused"],
    "field_type": "select"
  }
}
```

**Stored Value Example:**
```json
{
  "status": "present",
  "check_in_time": "2026-01-27T09:02:00Z",
  "check_out_time": "2026-01-27T17:05:00Z",
  "duration_minutes": 483
}
```

---

### `scan_result` - Scan Result
Barcode/QR scan result for check-in.

```json
{
  "id": "scan_result",
  "category": "special",
  "label": "Scan Result",
  "input_schema": {
    "type": "object",
    "properties": {
      "barcode": { "type": "string" },
      "scan_type": { "enum": ["check_in", "check_out"], "type": "string" }
    }
  },
  "storage_schema": {
    "type": "object",
    "properties": {
      "barcode": { "type": "string" },
      "scan_type": { "type": "string" },
      "scanned_at": { "type": "string", "format": "date-time" },
      "scanner_id": { "type": "string" }
    }
  },
  "config_schema": {
    "allowed_scan_types": ["check_in", "check_out"],
    "auto_checkout_hours": 8
  },
  "default_config": {
    "scanType": "document",
    "showConfidence": true
  }
}
```

---

### `calendar_event` - Calendar Event
Linked calendar event.

```json
{
  "id": "calendar_event",
  "category": "special",
  "label": "Calendar Event",
  "input_schema": {
    "type": "object",
    "properties": {
      "end": { "type": "string" },
      "start": { "type": "string" },
      "title": { "type": "string" }
    }
  },
  "storage_schema": {
    "type": "object",
    "properties": {
      "end": { "type": "string" },
      "start": { "type": "string" },
      "title": { "type": "string" },
      "provider": { "type": "string" },
      "synced_at": { "type": "string" },
      "external_id": { "type": "string" }
    }
  },
  "config_schema": {
    "provider": "google",
    "sync_enabled": true
  },
  "default_config": {
    "showTime": true,
    "showLocation": false
  }
}
```

**Stored Value Example:**
```json
{
  "title": "Interview - John Doe",
  "start": "2026-01-28T14:00:00Z",
  "end": "2026-01-28T15:00:00Z",
  "provider": "google",
  "external_id": "google-event-abc123",
  "synced_at": "2026-01-27T10:00:00Z"
}
```

---

## Field Configuration

Every field has a `config` JSON object that can override default settings. Common config options:

```json
{
  "label": "Custom Label",
  "placeholder": "Enter value...",
  "helpText": "Additional instructions for the user",
  "required": true,
  "hidden": false,
  "readOnly": false,
  "defaultValue": null,
  "validation": {
    "required": true,
    "minLength": 1,
    "maxLength": 100,
    "pattern": "^[A-Za-z]+$",
    "customMessage": "Please enter a valid value"
  },
  "conditional": {
    "field": "other_field_id",
    "operator": "equals",
    "value": "show_this_field"
  }
}
```

---

## Validation Rules

Fields can have validation rules defined in their config:

| Rule | Applies To | Description |
|------|-----------|-------------|
| `required` | All | Field must have a value |
| `minLength` | text, textarea | Minimum character count |
| `maxLength` | text, textarea | Maximum character count |
| `min` | number, percent | Minimum numeric value |
| `max` | number, percent | Maximum numeric value |
| `pattern` | text, email, phone | Regex pattern to match |
| `minItems` | repeater, multiselect | Minimum items required |
| `maxItems` | repeater, multiselect | Maximum items allowed |
| `minDate` | date, datetime | Earliest allowed date |
| `maxDate` | date, datetime | Latest allowed date |
