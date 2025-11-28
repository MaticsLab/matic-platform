# Matic Platform - Database Schema Reference

> **Purpose**: This document provides an AI-friendly overview of the database schema, explaining table relationships, module ownership, and use cases to help AI assistants understand the data architecture.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ORGANIZATIONS                                   │
│  (Multi-tenant top level - companies/institutions)                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               WORKSPACES                                     │
│  (Projects/teams within an organization)                                    │
│  ai_description: Natural language summary for AI context                    │
└─────────────────────────────────────────────────────────────────────────────┘
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │  TABLES  │    │  SEARCH  │    │ MODULES  │
              │(data)    │    │ (index)  │    │(features)│
              └──────────┘    └──────────┘    └──────────┘
                    │               ▲
                    └───────────────┘ (triggers auto-index)
```

---

## 🤖 AI Search Architecture

The schema includes purpose-built features for AI-powered search and retrieval:

### Search Pipeline
```
User Query → smart_search() → search_index (tsvector + GIN)
                                    ↓
                             Ranked Results with:
                             - Full-text matching
                             - Fuzzy similarity
                             - Click-rate boosting
                             - Entity type weighting
```

### Key AI Features

| Feature | Table/Column | Purpose |
|---------|--------------|---------|
| **Full-Text Search** | `search_index.search_vector` | tsvector with weighted ranking (A=title, B=subtitle, C=content) |
| **Fuzzy Search** | `search_index.title` + pg_trgm | Trigram similarity for typo tolerance |
| **Entity Classification** | `data_tables.entity_type` | Semantic meaning (person, event, application) |
| **Semantic Fields** | `table_fields.semantic_type` | Field meaning (email, status, date) |
| **Search Learning** | `search_analytics` | Click tracking to improve relevance over time |
| **Result Boosting** | `search_index.importance_score` | Manual + automatic ranking signals |

### Entity Types
Rows are classified by what they represent:

| Entity Type | Description | Search Weight |
|-------------|-------------|---------------|
| `person` | Individual people (students, applicants) | 1.2x |
| `application` | Submitted applications for review | 1.1x |
| `event` | Activities, meetings, scheduled items | 1.0x |
| `document` | Files, attachments, records | 0.9x |
| `organization` | Companies, schools, groups | 1.0x |
| `task` | To-do items, action items | 0.9x |
| `generic` | Unclassified data | 0.5x |

---

## 📊 Table Categories

### 1. CORE INFRASTRUCTURE
Foundation tables that everything else builds upon.

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `organizations` | Multi-tenant root entity (companies/schools) | Has many `workspaces` |
| `organization_members` | Links users to organizations with roles | Many-to-many bridge |
| `workspaces` | Project containers (e.g., "Fall 2024 Scholarships") | Belongs to `organizations`, has many data tables |
| `workspace_members` | Granular workspace-level access control | Many-to-many bridge |

### 2. FORMS SYSTEM
For collecting data from external users (applicants, registrants).

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `forms` | Form definitions (e.g., "Scholarship Application Form") | Belongs to `workspace`, has many `form_fields` |
| `form_fields` | Individual form questions/inputs | Belongs to `forms` |
| `form_submissions` | Submitted form data from applicants | Belongs to `forms`, stored in JSONB |

### 3. DATA TABLES SYSTEM (Airtable-like)
For structured data storage and management.

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `data_tables` | User-created tables (e.g., "Applications", "Activities") | Belongs to `workspace`, has many `table_columns` |
| `table_columns` | Column definitions with types and validation | Belongs to `data_tables` |
| `table_rows` | Actual data records stored as JSONB | Belongs to `data_tables` |
| `table_views` | Saved views (grid, kanban, calendar) | Belongs to `data_tables` |
| `table_links` | Relationship definitions between tables | Links two `data_tables` |
| `table_row_links` | Actual row-to-row relationships | Belongs to `table_links` |

### 4. FORMS-TO-TABLES INTEGRATION
Connects form submissions to data tables.

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `form_table_connections` | Maps form fields to table columns | Links `forms` to `data_tables` |

### 5. REVIEW WORKFLOW SYSTEM
For scholarship/grant application review processes.

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `review_workflows` | Workflow container (e.g., "2024 Scholarship Review") | Belongs to `workspace` |
| `application_stages` | Review stages (e.g., "Initial Review", "Committee") | Belongs to `review_workflows` |
| `reviewer_types` | Reviewer roles (e.g., "Financial Reviewer") | Belongs to `workspace` |
| `rubrics` | Scoring criteria with categories | Belongs to `workspace` |
| `stage_reviewer_configs` | Links stages to reviewer types and rubrics | Bridge table |

### 6. COLLABORATION & REAL-TIME
For live collaboration features.

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `active_sessions` | Tracks who's viewing what for real-time presence | References `workspaces`, `forms` |
| `activity_logs` | Audit trail for all changes | References `workspaces`, `forms` |
| `table_comments` | Threaded comments on rows | Belongs to `table_rows` |
| `table_attachments` | File uploads in cells | Belongs to `table_rows` |

### 7. PULSE MODULE (Barcode Scanning)
For check-in/attendance tracking.

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `pulse_enabled_tables` | Tables with scanning enabled | References `data_tables` |
| `scan_history` | Record of all barcode scans | References `data_tables` |

### 8. MODULE SYSTEM
For controlling which features are available.

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `module_configs` | Module settings per workspace | Belongs to `workspace` |
| `module_instances` | Links modules to specific tables | Links `module_configs` to `data_tables` |

---

## 🔗 Key Relationships Diagram

```
organizations
     │
     ├──> organization_members ──> auth.users
     │
     └──> workspaces
              │
              ├──> workspace_members ──> auth.users
              │
              ├──> forms ──> form_fields
              │      │
              │      └──> form_submissions
              │
              ├──> data_tables ──> table_columns
              │      │                    │
              │      ├──> table_rows ─────┘ (data references columns)
              │      │      │
              │      │      ├──> table_comments
              │      │      └──> table_attachments
              │      │
              │      ├──> table_views
              │      │
              │      └──> table_links ──> table_row_links
              │
              ├──> review_workflows
              │      │
              │      └──> application_stages
              │             │
              │             └──> stage_reviewer_configs
              │                    │
              │                    ├──> reviewer_types
              │                    └──> rubrics
              │
              └──> module_configs ──> module_instances ──> data_tables
```

---

## 🎯 Hub Types & Module Availability

### Hub Type Definitions

| Hub Type | Primary Purpose | Available Modules |
|----------|-----------------|-------------------|
| **Activities Hub** | Event/activity management | Pulse (scanning), Calendar, Basic Tables |
| **Applications Hub** | Application review workflows | Forms, Review Workflows, Rubrics |
| **Data Hub** | General data management | Tables, Links, Views |

### Module Definitions

| Module | Description | Applicable Hub Types |
|--------|-------------|---------------------|
| `pulse_scanning` | Barcode check-in/attendance | Activities Hub |
| `review_workflows` | Multi-stage review with rubrics | Applications Hub |
| `forms` | Data collection forms | All |
| `tables` | Airtable-like data tables | All |
| `analytics` | Reporting and dashboards | All |

---

## 📝 JSONB Field Patterns

### `table_rows.data` Structure
```json
{
  "column_uuid_1": "value",
  "column_uuid_2": 123,
  "column_uuid_3": ["option1", "option2"],
  "column_uuid_4": {
    "name": "file.pdf",
    "url": "https://..."
  }
}
```

### `table_rows.metadata` Structure (for Applications)
```json
{
  "assigned_workflow_id": "uuid",
  "current_stage_id": "uuid",
  "assigned_reviewer_ids": ["uuid1", "uuid2"],
  "review_scores": [
    {
      "reviewer_id": "uuid",
      "stage_id": "uuid",
      "rubric_id": "uuid",
      "scores": { "category_id": 85 },
      "total_score": 85,
      "comments": { "overall": "Great application" },
      "status": "completed",
      "submitted_at": "2024-01-15T..."
    }
  ],
  "status": "pending_review",
  "custom_tags": ["scholarship", "priority"]
}
```

### `application_stages.logic_rules` Structure
```json
{
  "auto_advance": {
    "enabled": true,
    "conditions": [
      {
        "type": "score_threshold",
        "operator": ">=",
        "value": 70
      }
    ]
  },
  "auto_reject": {
    "enabled": true,
    "conditions": [
      {
        "type": "score_threshold",
        "operator": "<",
        "value": 50
      }
    ]
  }
}
```

### `rubrics.categories` Structure
```json
[
  {
    "id": "uuid",
    "name": "Academic Achievement",
    "description": "GPA and academic performance",
    "max_points": 25,
    "weight": 0.25,
    "criteria": [
      {
        "id": "uuid",
        "description": "Excellent (20-25 points)",
        "min_score": 20,
        "max_score": 25
      }
    ]
  }
]
```

---

## 🔍 Common Query Patterns

### Get all applications for a workflow
```sql
SELECT tr.* 
FROM table_rows tr
WHERE tr.metadata->>'assigned_workflow_id' = 'workflow_uuid'
  AND tr.is_archived = false;
```

### Get applications at a specific stage
```sql
SELECT tr.* 
FROM table_rows tr
WHERE tr.metadata->>'current_stage_id' = 'stage_uuid'
  AND tr.is_archived = false;
```

### Get unassigned applications (no workflow assigned)
```sql
SELECT tr.* 
FROM table_rows tr
WHERE (tr.metadata->>'assigned_workflow_id' IS NULL 
       OR tr.metadata->>'assigned_workflow_id' = '')
  AND tr.is_archived = false;
```

### Get reviewer's assigned applications
```sql
SELECT tr.* 
FROM table_rows tr
WHERE tr.metadata->'assigned_reviewer_ids' ? 'reviewer_uuid'
  AND tr.is_archived = false;
```

---

## ⚠️ Important Notes for AI Assistants

1. **Data Flow**: Frontend → Go Backend → PostgreSQL. Never query Supabase directly from frontend (except auth).

2. **JSONB Columns**: Use `datatypes.JSON` in Go GORM models, not `map[string]interface{}`.

3. **UUID Handling**: Go uses `uuid.UUID`, TypeScript uses `string`. JSON serialization handles conversion.

4. **Hub Identification**: Currently, hub type is determined by the presence of modules:
   - Has `review_workflows` → Applications Hub
   - Has `pulse_enabled_tables` → Activities Hub
   - Neither → Data Hub

5. **Form Submissions vs Table Rows**: 
   - `form_submissions` = raw form data as submitted
   - `table_rows` = processed data (often created from form submissions via `form_table_connections`)

6. **Review Scores Storage**: Stored in `table_rows.metadata.review_scores[]`, not a separate table.

---

## 🔮 Future Improvements

1. Add explicit `hub_type` column to `data_tables` for clearer type identification
2. Create `module_registry` table to define available modules per hub type
3. Add `hub_module_configs` for per-hub module settings
4. Consider extracting `review_scores` to a separate table for complex queries
