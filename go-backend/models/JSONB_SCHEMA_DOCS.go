// JSONB Schema Documentation for Matic Platform Models
// =====================================================
// This file documents all JSONB column structures across the platform
// Reference this when working with JSONB fields to understand expected schema

package models

/*
===============================================================================
TABLE: organizations
COLUMN: settings JSONB
===============================================================================

Expected Structure:
{
  "brand_color": "#10B981",                    // Hex color for org branding
  "default_timezone": "America/Chicago",       // IANA timezone string
  "features": {
    "sso_enabled": true,                       // Single sign-on enabled
    "audit_logs_retention_days": 365,          // How long to keep audit logs
    "custom_domains_enabled": false            // Allow custom portal domains
  },
  "billing": {
    "payment_method": "stripe",                 // Payment provider
    "subscription_id": "sub_1234..."            // External subscription ID
  }
}

===============================================================================
TABLE: organization_members
COLUMN: permissions JSONB
===============================================================================

Expected Structure:
{
  "can_create_workspaces": true,               // Can create new workspaces
  "can_manage_billing": false,                 // Can update payment methods
  "can_invite_members": true,                  // Can invite org members
  "can_delete_workspaces": false,              // Can delete any workspace
  "can_view_audit_logs": false                 // Can see org-level audit trail
}

===============================================================================
TABLE: workspaces
COLUMN: settings JSONB
===============================================================================

Expected Structure:
{
  "portal_enabled": true,                       // Allow external portals
  "portal_theme": {
    "primary_color": "#10B981",                 // Portal theme color
    "logo_url": "https://...",                  // Portal logo
    "custom_css": ".header { ... }"             // Optional custom styling
  },
  "default_permissions": {
    "can_create_tables": false,                 // Default member permission
    "can_delete_rows": false                    // Default member permission
  },
  "ai_features": {
    "auto_suggestions_enabled": true,           // Enable AI field suggestions
    "semantic_search_enabled": false            // Enable AI-powered search
  }
}

COLUMN: data_summary JSONB (AI-generated)
Expected Structure:
{
  "total_tables": 15,                           // Count of data tables
  "total_rows": 5420,                           // Total rows across all tables
  "most_used_hub_type": "applications",         // Most common hub type
  "active_workflows": 3,                        // Review workflows in use
  "last_activity_at": "2025-12-11T10:30:00Z"    // Most recent row update
}

===============================================================================
TABLE: workspace_members
COLUMN: permissions JSONB
===============================================================================

Expected Structure:
{
  "can_create_tables": true,                    // Can create data tables
  "can_delete_rows": false,                     // Can delete rows
  "can_manage_members": false,                  // Can add/remove workspace members
  "can_export_data": true,                      // Can export CSV/JSON
  "can_manage_workflows": false,                // Can create/edit review workflows
  "can_see_pii_fields": ["ssn", "dob"]          // Array of PII fields visible to this user
}

===============================================================================
TABLE: data_tables
COLUMN: settings JSONB
===============================================================================

Expected Structure:
{
  "hub_type": "applications",                   // "data", "applications", or "activities"
  "approval_settings": {
    "require_approval": true,                   // Require approval for row edits
    "approvers": ["user_uuid_1", "user_uuid_2"], // User IDs who can approve
    "auto_approve_fields": ["notes", "tags"]    // Fields that don't need approval
  },
  "ai_settings": {
    "enable_suggestions": true,                 // Allow AI field suggestions
    "auto_apply_high_confidence": false,        // Auto-apply suggestions >95% confidence
    "excluded_fields": ["sensitive_data"]       // Fields to exclude from AI
  },
  "history_settings": {
    "track_changes": true,                      // Enable row_versions
    "require_change_reason": false,             // Require reason for edits
    "retention_days": 365                       // Keep history for X days
  },
  "validation_rules": {
    "require_unique": ["email", "student_id"],  // Fields that must be unique
    "conditional_required": {                    // Fields required based on conditions
      "scholarship_type": {
        "when": {"field": "applying_for_scholarship", "equals": true},
        "required": ["gpa", "essay"]
      }
    }
  }
}

COLUMN: history_settings JSONB (deprecated, use settings.history_settings)
COLUMN: approval_settings JSONB (deprecated, use settings.approval_settings)
COLUMN: ai_settings JSONB (deprecated, use settings.ai_settings)
COLUMN: import_metadata JSONB
Expected Structure:
{
  "source": "csv",                              // Import source: csv, excel, google_sheets
  "original_filename": "students.csv",          // Original file name
  "imported_at": "2025-12-11T10:00:00Z",        // When imported
  "imported_by": "user_uuid",                   // Who imported
  "row_count": 150,                             // Rows imported
  "field_mappings": {                           // How CSV columns mapped to fields
    "First Name": "first_name",
    "Email Address": "email"
  },
  "skipped_rows": [5, 23, 47],                  // Row numbers skipped due to errors
  "errors": [                                    // Import errors
    {"row": 5, "error": "Invalid email format"}
  ]
}

===============================================================================
TABLE: table_fields
COLUMN: config JSONB
===============================================================================

Expected Structure (varies by field_type_id):

FOR text, textarea:
{
  "placeholder": "Enter text here...",          // Placeholder text
  "default_value": "",                          // Default value for new rows
  "min_length": 0,                              // Minimum character length
  "max_length": 500,                            // Maximum character length
  "pattern": "^[A-Za-z0-9]+$",                  // Regex validation pattern
  "multiline": false                            // Allow line breaks (textarea only)
}

FOR email:
{
  "placeholder": "email@example.com",
  "allow_multiple": false,                      // Allow comma-separated emails
  "require_verification": false                 // Send verification email
}

FOR select, multi_select:
{
  "options": [
    {"value": "opt1", "label": "Option 1", "color": "#10B981"},
    {"value": "opt2", "label": "Option 2", "color": "#3B82F6"}
  ],
  "allow_custom": false,                        // Allow users to add options
  "default_value": "opt1"                       // Default selection
}

FOR number, currency:
{
  "min": 0,                                     // Minimum value
  "max": 1000000,                               // Maximum value
  "precision": 2,                               // Decimal places
  "currency_code": "USD",                       // ISO 4217 currency code (currency only)
  "format": "comma"                             // Number formatting: comma, space, none
}

FOR date, datetime:
{
  "default_to_now": false,                      // Auto-fill with current date/time
  "min_date": "2025-01-01",                     // Earliest allowed date
  "max_date": "2025-12-31",                     // Latest allowed date
  "time_format": "12h"                          // 12h or 24h (datetime only)
}

FOR checkbox, toggle:
{
  "default_value": false,                       // Default checked state
  "label_when_true": "Yes",                     // Label for checked state
  "label_when_false": "No"                      // Label for unchecked state
}

FOR file, image:
{
  "max_file_size_mb": 10,                       // Max file size in MB
  "allowed_extensions": [".pdf", ".docx"],      // Allowed file types
  "max_files": 5,                               // Max files per field
  "storage_provider": "supabase"                // Where files stored: supabase, s3, cloudinary
}

FOR linked_record:
{
  "linked_table_id": "uuid...",                 // Target table UUID
  "display_field": "name",                      // Field to show from linked table
  "allow_multiple": false,                      // Allow multiple links
  "cascade_delete": false                       // Delete links when row deleted
}

FOR repeater (nested repeating groups):
{
  "children": [                                 // Nested field definitions
    {"type": "text", "name": "item_name", "label": "Item Name"},
    {"type": "number", "name": "quantity", "label": "Quantity"}
  ],
  "min_items": 1,                               // Minimum repeating items
  "max_items": 10,                              // Maximum repeating items
  "collapsible": true                           // Allow collapse/expand in UI
}

COLUMN: validation JSONB
Expected Structure:
{
  "required": true,                             // Field is required
  "custom_rules": [                             // Custom validation rules
    {
      "type": "regex",
      "pattern": "^[A-Z]{2}\\d{6}$",
      "message": "Must be 2 letters + 6 digits"
    },
    {
      "type": "conditional",
      "when": {"field": "status", "equals": "approved"},
      "then": {"required": true}
    }
  ]
}

COLUMN: sample_values JSONB (for AI/search)
Expected Structure:
["example1@email.com", "test@example.org", "user@domain.com"]
// Array of sample values to help AI understand field content

===============================================================================
TABLE: table_rows
COLUMN: data JSONB
===============================================================================

Expected Structure (keys match table_fields.name):
{
  "first_name": "John",                         // Text field
  "email": "john@example.com",                  // Email field
  "age": 25,                                    // Number field
  "is_active": true,                            // Checkbox field
  "tags": ["tag1", "tag2"],                     // Multi-select field
  "avatar": {                                    // File field
    "url": "https://...",
    "filename": "avatar.jpg",
    "size": 45231,
    "mime_type": "image/jpeg"
  },
  "linked_contacts": ["uuid1", "uuid2"],        // Linked record field
  "address": {                                   // Address field
    "street": "123 Main St",
    "city": "Chicago",
    "state": "IL",
    "zip": "60601"
  },
  "expenses": [                                  // Repeater field
    {"item_name": "Hotel", "amount": 150.00},
    {"item_name": "Flight", "amount": 450.00}
  ]
}

COLUMN: metadata JSONB
Expected Structure:
{
  "row_status": "active",                       // active, archived, draft
  "row_workflow": "workflow_uuid",              // Assigned workflow UUID
  "row_tags": ["priority", "scholarship"],      // Custom tags
  "row_score": 85.5,                            // Workflow score
  "row_assigned_to": ["user_uuid1"],            // Assigned reviewers
  "import_id": "batch_uuid",                    // Batch import ID
  "external_id": "legacy_id_123"                // External system ID
}

COLUMN: tags JSONB
Expected Structure:
["urgent", "follow_up", "needs_review"]         // Simple array of tag strings

===============================================================================
TABLE: table_views
COLUMN: filters JSONB
===============================================================================

Expected Structure:
{
  "match": "all",                               // all (AND) or any (OR)
  "conditions": [
    {
      "field": "status",
      "operator": "equals",                     // equals, not_equals, contains, gt, lt, etc.
      "value": "approved"
    },
    {
      "field": "score",
      "operator": "greater_than",
      "value": 75
    }
  ]
}

COLUMN: sorts JSONB
Expected Structure:
[
  {"field": "created_at", "direction": "desc"},  // Sort by created date descending
  {"field": "name", "direction": "asc"}          // Then by name ascending
]

COLUMN: grouping JSONB
Expected Structure:
{
  "field": "status",                             // Group rows by this field
  "collapsed_by_default": false,                 // Start groups expanded/collapsed
  "show_counts": true                            // Show row count per group
}

COLUMN: settings JSONB
Expected Structure:
{
  "row_height": "medium",                        // small, medium, large
  "show_row_numbers": true,                      // Show row numbers in grid
  "wrap_text": false,                            // Wrap long text in cells
  "freeze_first_column": false                   // Freeze first column when scrolling
}

COLUMN: config JSONB (for forms/portals)
Expected Structure:
{
  "title": "Application Form",                   // Form title
  "description": "Complete this application...",  // Form description
  "submit_button_text": "Submit Application",    // Custom button text
  "success_message": "Thank you for applying!",  // Message after submission
  "redirect_url": "https://...",                 // Redirect after submission
  "allow_multiple_submissions": false,           // Allow same email to submit multiple times
  "collect_email": true,                         // Require email address
  "send_confirmation_email": true,               // Send email to submitter
  "auto_create_row": true,                       // Create table row from submission
  "notification_emails": ["admin@example.com"],  // Notify these emails on submission
  "blocks": [                                     // Form blocks (portal editor)
    {
      "id": "block_uuid",
      "type": "heading",
      "content": {"text": "Personal Information", "level": 2}
    },
    {
      "id": "block_uuid2",
      "type": "field",
      "fieldId": "field_uuid",
      "required": true
    }
  ]
}

===============================================================================
TABLE: portal_applicants
COLUMN: submission_data JSONB
===============================================================================

Expected Structure (keys match form field names):
{
  "first_name": "Jane",
  "email": "jane@example.com",
  "phone": "555-0123",
  "essay": "I am applying because...",
  "gpa": 3.8,
  "activities": ["Soccer", "Debate Team"],
  "transcript": {
    "url": "https://...",
    "filename": "transcript.pdf",
    "size": 234561
  }
}

===============================================================================
TABLE: application_stages
COLUMN: hidden_pii_fields JSONB
===============================================================================

Expected Structure:
["ssn", "date_of_birth", "home_address", "parent_income"]
// Array of field names to hide from reviewers at this stage

COLUMN: custom_statuses JSONB
Expected Structure:
[
  {
    "value": "waitlist",
    "label": "Waitlisted",
    "color": "#FFA500",
    "actions": [                                  // Optional actions when status set
      {"type": "send_email", "template_id": "waitlist_notification"}
    ]
  },
  {
    "value": "interview",
    "label": "Interview Scheduled",
    "color": "#3B82F6"
  }
]

COLUMN: custom_tags JSONB
Expected Structure:
[
  {
    "value": "scholarship",
    "label": "Scholarship Candidate",
    "color": "#10B981"
  },
  {
    "value": "priority",
    "label": "Priority Review",
    "color": "#EF4444"
  }
]

COLUMN: logic_rules JSONB (automation rules)
Expected Structure:
[
  {
    "condition": {
      "field": "total_score",
      "operator": "greater_than",
      "value": 85
    },
    "action": "advance_to_stage",
    "target_stage_id": "next_stage_uuid"
  },
  {
    "condition": {
      "field": "gpa",
      "operator": "less_than",
      "value": 2.5
    },
    "action": "reject",
    "rejection_reason": "GPA below minimum requirement"
  }
]

COLUMN: status_actions JSONB
Expected Structure:
{
  "approved": [
    {"type": "send_email", "template_id": "acceptance_letter"},
    {"type": "add_tag", "tag": "accepted"}
  ],
  "rejected": [
    {"type": "send_email", "template_id": "rejection_letter"},
    {"type": "archive_row"}
  ]
}

===============================================================================
TABLE: rubrics
COLUMN: categories JSONB
===============================================================================

Expected Structure:
[
  {
    "id": "academic",
    "name": "Academic Achievement",
    "weight": 0.4,                                // Weight in overall score (0-1)
    "criteria": [
      {
        "id": "gpa",
        "name": "GPA",
        "description": "Grade point average",
        "max_score": 10,
        "scoring_guide": {
          "10": "GPA 4.0",
          "8-9": "GPA 3.5-3.99",
          "5-7": "GPA 3.0-3.49",
          "0-4": "GPA < 3.0"
        }
      }
    ]
  },
  {
    "id": "leadership",
    "name": "Leadership Experience",
    "weight": 0.3,
    "criteria": [...]
  }
]

===============================================================================
TABLE: field_type_registry
COLUMN: storage_schema JSONB (JSON Schema)
===============================================================================

Expected Structure:
{
  "type": "string",                              // JSON Schema type
  "format": "email",                             // JSON Schema format
  "minLength": 5,
  "maxLength": 255,
  "pattern": "^[^@]+@[^@]+\\.[^@]+$"            // Email validation regex
}

COLUMN: input_schema JSONB (JSON Schema for UI)
Expected Structure:
{
  "type": "object",
  "properties": {
    "placeholder": {"type": "string"},
    "allow_multiple": {"type": "boolean", "default": false}
  }
}

COLUMN: config_schema JSONB (JSON Schema for field config)
Expected Structure:
{
  "type": "object",
  "properties": {
    "options": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "value": {"type": "string"},
          "label": {"type": "string"},
          "color": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"}
        },
        "required": ["value", "label"]
      }
    }
  }
}

COLUMN: ai_schema JSONB
Expected Structure:
{
  "should_embed": true,                          // Include in AI embeddings
  "privacy_level": "public",                     // public, private, pii
  "boost_factor": 1.2,                           // Search ranking boost (0.1-2.0)
  "sample_extraction_prompt": "Extract email addresses from text"
}

COLUMN: default_config JSONB
Expected Structure: (default config values for new field instances)
{
  "placeholder": "Enter email address",
  "allow_multiple": false,
  "max_length": 255
}

===============================================================================
TABLE: row_versions
COLUMN: data JSONB
===============================================================================

Expected Structure: (snapshot of table_rows.data at this version)
{
  "first_name": "John",
  "email": "john@example.com",
  // ... full row data at this point in time
}

COLUMN: metadata JSONB
Expected Structure:
{
  "user_agent": "Mozilla/5.0...",               // Browser/client info
  "ip_address": "192.168.1.1",                  // User IP (if tracking enabled)
  "change_summary": "Updated 3 fields",         // Human-readable summary
  "fields_changed": ["email", "phone", "address"] // List of changed fields
}

===============================================================================
TABLE: field_changes
COLUMN: old_value JSONB
COLUMN: new_value JSONB
===============================================================================

Expected Structure: (any valid JSON value based on field type)
"john@example.com"                              // String value
150                                             // Number value
true                                            // Boolean value
["tag1", "tag2"]                                // Array value
{"street": "123 Main", "city": "Chicago"}      // Object value
null                                            // Null value

===============================================================================
TABLE: change_requests
COLUMN: current_data JSONB
COLUMN: proposed_data JSONB
===============================================================================

Expected Structure: (full row data before/after)
{
  "first_name": "John",
  "email": "john@example.com",
  "status": "pending",
  // ... full row state
}

===============================================================================
TABLE: search_index
COLUMN: indexed_fields JSONB
===============================================================================

Expected Structure:
{
  "name": "John Doe",                            // Indexed field values
  "email": "john@example.com",
  "bio": "Software engineer with 5 years..."
}

COLUMN: field_embeddings JSONB
Expected Structure:
{
  "name": [0.123, -0.456, ...],                 // 384-dim vector embedding
  "bio": [0.789, -0.234, ...]                   // 384-dim vector embedding
}

COLUMN: metadata JSONB
Expected Structure:
{
  "entity_type": "application",                  // Entity type for ranking
  "priority": 5,                                 // Search priority (1-10)
  "last_accessed_at": "2025-12-11T10:00:00Z",   // For popularity boosting
  "click_count": 15                              // Total clicks on this result
}

===============================================================================
TABLE: search_analytics
COLUMN: filters JSONB
===============================================================================

Expected Structure:
{
  "workspace_id": "uuid...",                     // Filter context
  "table_id": "uuid...",
  "date_range": "last_30_days"
}

===============================================================================

USAGE NOTES:
===========

1. Always validate JSONB data against these schemas before inserting
2. Use JSON Schema validation where defined (field_type_registry schemas)
3. Null values are valid for all optional JSONB fields
4. Empty objects {} are preferred over null for settings/config fields
5. Use snake_case for all JSONB keys
6. Include timestamps in ISO 8601 format: "2025-12-11T10:00:00Z"
7. Use UUIDs as strings, not objects
8. Arrays can be empty [] but should not be null unless explicitly allowed
9. Colors should be hex format: "#10B981" (not "rgb(16, 185, 129)")
10. File objects should always include: url, filename, size, mime_type

*/
