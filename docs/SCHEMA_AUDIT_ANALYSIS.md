# Matic Platform - Current Schema Audit & Analysis
**Generated: December 11, 2025**

---

## Executive Summary

Your current Supabase schema is a **highly modular, extensible platform** designed for multi-tenant workspace management with:
- **47 active tables** totaling ~5.8 MB
- **Three primary hub types**: Activities, Applications, Data
- **Modular feature system**: Any module can be enabled/disabled per hub
- **Enterprise-ready**: Organizations → Workspaces → Tables with role-based access
- **Advanced AI/Search**: Semantic search, embeddings, analytics-driven ranking

**Status**: Over-engineered for your current UI, but solid foundation for growth.

---

## 1. Architecture Overview

### 1.1 Multi-Tenancy Hierarchy
```
organizations (tenant container)
  ├─ organization_members (roles: owner, admin, member)
  └─ workspaces (project/space)
       ├─ workspace_members (roles: owner, editor, viewer)
       └─ data_tables (hub instances)
            ├─ table_fields (columns/schema)
            ├─ table_rows (data records)
            ├─ table_views (UI representations)
            ├─ hub_module_configs (enabled features)
            └─ [module-specific tables]
```

### 1.2 Three Hub Types (Modular System)
| Hub Type | Purpose | Default Modules |
|----------|---------|-----------------|
| **data** | General CRUD tables | tables, views |
| **applications** | Application review workflows | tables, views, forms, review_workflow, rubrics |
| **activities** | Event/attendance management | tables, views, pulse, attendance |

**Key Pattern**: `data_tables` table has `hub_type` stored in JSON `settings` column, enabling runtime type detection.

---

## 2. Functional Layer Analysis

### 2.1 Core Data Storage (10 tables - 1%)
| Table | Purpose | Rows | Key Pattern |
|-------|---------|------|-------------|
| **organizations** | Tenant containers | ~1-10 | Multi-tenant root |
| **workspaces** | Projects within orgs | ~10-100 | Org → Workspace |
| **data_tables** | Hub definitions | ~10-100 | Workspace → Table |
| **table_fields** | Column schemas | ~100-1K | Table → Field (FK to field_type_registry) |
| **table_rows** | Actual data | ~1K-1M | `data: JSONB` keyed by field.name |
| **table_views** | Query/display configs | ~100-500 | Saved grid/kanban/gallery/form layouts |
| **table_links** | Table relationships | ~10-100 | source_table → target_table |
| **table_row_links** | Row connections | ~100-1K | Uses table_links to connect rows |
| **table_files** | Attachments | ~500-5K | Row → File storage (S3 metadata) |
| **portal_applicants** | Form submissions | ~1K-100K | form_id → submission_data (JSONB) |

**Storage Pattern**:
- Real data lives in **JSONB columns** (`table_rows.data`, `portal_applicants.submission_data`)
- Values are keyed by `field.name` (snake_case)
- Validation happens via `field_type_registry.storage_schema` (JSON Schema)

---

### 2.2 Module/Feature System (5 tables - 10%)
Enables **dynamic feature enablement** per hub instance.

| Table | Purpose | Rows | Relationship |
|-------|---------|------|--------------|
| **module_definitions** | Feature catalog | ~30-50 | Global registry |
| **hub_module_configs** | Per-table module settings | ~50-500 | data_table → module_definition |
| **module_field_configs** | Module field overrides | ~100-1K | module → field_type (customizations) |
| **sub_modules** | Child modules/tabs | ~50-200 | module → sub_modules (e.g., Events within Attendance) |
| **module_history_settings** | Per-module history config | ~10-100 | hub_module_config → history tracking rules |

**Example Use Case**: 
- User enables "review_workflow" module on applications hub
- System creates `hub_module_config` entry
- Review fields are auto-created or customized via `module_field_configs`
- History tracking enabled based on `module_history_settings`

---

### 2.3 Workflow/Review System (8 tables - 17%)
Complex multi-stage application review system.

| Table | Purpose | Rows | Relationship |
|-------|---------|------|--------------|
| **review_workflows** | Workflow definitions | ~10-100 | Workspace → workflow (sequence of stages) |
| **application_stages** | Workflow stages | ~50-500 | review_workflow → stage (with hidden PII, custom statuses, logic rules) |
| **application_groups** | Stage groupings | ~20-200 | review_workflow → group (logical batches of stages) |
| **stage_groups** | Row-stage assignments | ~100-1K | row → stage (tracks row's current position in workflow) |
| **reviewer_types** | Reviewer roles | ~5-20 | workspace → type (e.g., "Academic", "Industry") |
| **rubrics** | Scoring frameworks | ~10-50 | workspace → rubric (categories with scores) |
| **stage_reviewer_configs** | Stage-reviewer assignments | ~50-500 | stage → reviewer_type → rubric (who reviews what, using which rubric) |
| **custom_statuses** | Stage-specific status options | ~50-200 | stage → custom status (override default "pending/approved/rejected") |

**Key Feature**: JSONB columns store complex config:
- `application_stages.hidden_pii_fields` - field visibility rules
- `application_stages.logic_rules` - automated advancement rules
- `stage_reviewer_configs.field_visibility_config` - role-based field access

---

### 2.4 Field Type System (4 tables - 8%)
**Centralized field type registry** with schema validation.

| Table | Purpose | Rows | Relationship |
|-------|---------|------|--------------|
| **field_type_registry** | Field type definitions | ~40-100 | Global: text, email, select, repeater, etc. |
| **semantic_field_types** | AI categorization | ~30-50 | field_type → semantic category (for AI search) |
| **entity_types** | Data entity categories | ~10-30 | workspace → entity (e.g., "application", "participant") |
| **metadata_schema** | JSONB field documentation | ~10-30 | registry → expected_fields (what metadata keys are valid) |

**Field Type Registry Pattern**:
```json
{
  "id": "email",
  "input_schema": { /* JSON Schema for form */ },
  "storage_schema": { /* JSON Schema for validation */ },
  "config_schema": { /* JSON Schema for instance config */ },
  "ai_schema": { /* Embedding strategy */ }
}
```

---

### 2.5 Change Tracking & Versioning (4 tables - 8%)
Audit trail and row version history.

| Table | Purpose | Rows | Relationship |
|-------|---------|------|--------------|
| **row_versions** | Row snapshots | ~10K-1M | row → version (with batch_operation, changed_by) |
| **field_changes** | Field-level diffs | ~50K-10M | row_version → field (old_value, new_value JSONB) |
| **batch_operations** | Bulk update groups | ~100-1K | table → batch (transaction-like grouping) |
| **change_requests** | Change approval workflow | ~500-5K | row → change_request (pending changes for review) |

**Audit Pattern**:
- Every row update creates `row_versions` entry
- Each field change logged in `field_changes`
- `change_requests` optional: if approval_required, waits before committing

---

### 2.6 Email & Communication (5 tables - 10%)
Email sending infrastructure for notifications.

| Table | Purpose | Rows | Relationship |
|-------|---------|------|--------------|
| **email_templates** | Message templates | ~10-50 | workspace → template |
| **email_campaigns** | Bulk send groups | ~10-100 | template → campaign |
| **email_signatures** | Sender signatures | ~10-100 | workspace → signature |
| **sent_emails** | Delivery tracking | ~1K-100K | template → sent_email (status, recipient) |
| **gmail_connections** | OAuth integrations | ~10-100 | workspace → gmail (scopes, allowed_users) |

---

### 2.7 AI & Search System (6 tables - 13%)
Advanced semantic search with embeddings.

| Table | Purpose | Rows | Relationship |
|-------|---------|------|--------------|
| **search_index** | Full-text index | ~100-10K | table → indexed (tsvector + field embeddings) |
| **search_analytics** | Usage tracking | ~1K-10K | workspace → click-rate (boost ranking) |
| **embedding_queue** | Async processing | ~10-1K | pending embeddings (batch async job) |
| **ai_field_suggestions** | ML-generated field values | ~100-10K | row → field (with confidence, reviewed_by) |
| **field_changes** | (covered above) | | Part of audit trail |
| **semantic_field_types** | (covered above) | | Field type categorization |

**Search Pattern**:
1. Keyword search via `tsvector @@ plainto_tsquery`
2. Entity boosting (e.g., person fields 1.2x)
3. Click-rate boosting from `search_analytics`
4. Fuzzy fallback via `pg_trgm`
5. Semantic embeddings for "smart search"

---

### 2.8 Tags & Automations (3 tables - 6%)
Workflow automation and tagging.

| Table | Purpose | Rows | Relationship |
|-------|---------|------|--------------|
| **custom_tags** | Stage-specific tags | ~50-200 | stage → tag (e.g., "scholarship", "priority") |
| **tag_automations** | Auto-tag rules | ~20-100 | review_workflow → automation (IF logic_rule THEN add_tag) |
| **workflow_actions** | Stage transition actions | ~50-500 | workflow → action (auto-advance, notify, email) |

---

### 2.9 Admin & Invitations (2 tables - 4%)
Access management.

| Table | Purpose | Rows | Relationship |
|-------|---------|------|--------------|
| **organization_members** | Org-level users | ~10-1K | org → user (with permissions JSONB) |
| **workspace_members** | Workspace-level users | ~10-1K | workspace → user (with roles: owner, editor, viewer) |
| **workspace_invitations** | Pending access | ~10-100 | workspace → invitation (email-based) |

---

### 2.10 Analytics & Admin (2 tables - 4%)
Observability.

| Table | Purpose | Rows | Relationship |
|-------|---------|------|--------------|
| **search_analytics** | (covered above) | | Click-rate tracking |
| **embedding_queue** | (covered above) | | Job queue |

---

## 3. Data Flow Patterns

### 3.1 Row CRUD Flow
```
Frontend: Create Row
  ↓
POST /api/v1/tables/{id}/rows
  ↓
Handler validates via field_type_registry.storage_schema
  ↓
Insert into table_rows { id, table_id, data: JSON, created_by, created_at }
  ↓
Create row_versions entry (if history enabled)
  ↓
Index for search (async via embedding_queue)
  ↓
Return row with updated_at
```

### 3.2 Form Submission Flow (Applications Hub)
```
Frontend: Submit Form
  ↓
POST /api/v1/forms/{id}/submit
  ↓
Create portal_applicants { form_id, submission_data: JSON, email, status: 'submitted' }
  ↓
IF auto_create_row: Create table_row with form submission as initial data
  ↓
Trigger workflow: Create stage_group entry (row at stage 0)
  ↓
Notify reviewers (via email_templates + sent_emails)
```

### 3.3 Change Request Flow
```
User: Edit Row
  ↓
Check change_requests settings on data_table
  ↓
IF approval_required:
  - Create change_requests { table_id, row_id, current_data, proposed_data, status: 'pending' }
  - Notify approvers
  - Wait for change_approvals entries
  - IF approved: Apply to table_rows
ELSE:
  - Apply directly to table_rows
  - Create row_versions + field_changes
```

### 3.4 Module Enablement Flow
```
User: Enable "review_workflow" on applications hub
  ↓
Create hub_module_config { table_id, module_id: 'review_workflow', is_enabled: true }
  ↓
Auto-create related tables/fields:
  - review_workflows entry
  - application_stages entries
  - stage_reviewer_configs
  ↓
Auto-create fields in table_fields for: workflow_status, assigned_stage, reviewers, rubric_scores
  ↓
Optionally populate field_changes history if not first-time
```

---

## 4. Architectural Strengths

### ✅ Strengths
1. **Multi-tenant design**: Org → Workspace → Table hierarchy is clean
2. **Modular features**: hub_module_configs enables/disables features independently
3. **Flexible data storage**: JSONB + field_type_registry allows unlimited field types
4. **Comprehensive audit**: row_versions + field_changes for compliance/debugging
5. **Advanced search**: tsvector + embeddings + analytics-driven ranking
6. **Role-based access**: workspace_members + organization_members with permissions JSONB
7. **Workflow system**: Multi-stage review with custom status, rubrics, logic rules
8. **Email infrastructure**: Built-in notification system with templates, campaigns, delivery tracking

---

## 5. Architectural Weaknesses

### ⚠️ Weaknesses
1. **Over-engineered for current UI**:
   - 47 tables when your portal only uses ~15
   - Workflow system (review_workflows, application_stages, rubrics) not visible in current UI
   - Activities hub modules (pulse, attendance) not in current codebase

2. **Data sprawl**:
   - JSONB columns make direct SQL queries harder
   - field_changes table grows unbounded (~10M rows possible)
   - embedding_queue can become bottleneck without proper async processing

3. **Module system complexity**:
   - sub_modules, module_history_settings only partially used
   - Auto-field-creation logic isn't documented/tested

4. **Email infrastructure unused**:
   - email_templates, email_campaigns, gmail_connections not integrated into portal
   - sent_emails table grows but no cleanup policy

5. **Search system incomplete**:
   - embedding_queue exists but async processor not fully implemented
   - search_analytics tracked but not used for ranking in current search

6. **Performance concerns**:
   - No explicit indexes on frequently-queried JSONB fields (table_rows.data)
   - Foreign key constraints can slow bulk operations
   - row_versions + field_changes N+1 queries on detail views

---

## 6. Current Usage by Hub Type

### Data Hub (Simple)
✅ Used:
- data_tables (hub_type: 'data')
- table_fields
- table_rows
- table_views
- table_links / table_row_links
- table_files
- search_index

❌ Not Used:
- review_workflows
- application_stages
- rubrics
- reviewer_types
- workflow_actions

### Applications Hub (Complex)
✅ Used:
- data_tables (hub_type: 'applications')
- table_fields
- table_rows
- portal_applicants
- review_workflows
- application_stages
- rubrics (partially)
- stage_reviewer_configs (partially)

❌ Not Used:
- sub_modules
- module_history_settings
- tag_automations
- workflow_actions
- application_groups

### Activities Hub (None)
❌ Not Used:
- All attendance/pulse modules
- sub_modules (Activities)

---

## 7. Migration Recommendations

### Option A: Keep As-Is (Current)
**Pros**: Full feature parity when you expand
**Cons**: 30 unused tables cluttering schema
**Best for**: Growth path already planned

### Option B: Simplify & Defer (Recommended for MVP)
**Drop**:
- email_campaigns, email_signatures, sent_emails (email infrastructure can be added later)
- tag_automations, workflow_actions (advanced automation)
- sub_modules, module_history_settings (sub-module system)
- All Activities hub tables (attendance, pulse modules)
- embedding_queue (AI can be async job system outside DB)

**Keep**:
- Core data (table_rows, table_fields, table_views, table_links)
- Review workflow (application_stages, rubrics) - core to applications hub
- Module system (module_definitions, hub_module_configs) - enables future features
- Change tracking (row_versions, field_changes) - audit trail
- Search basics (search_index) - without embeddings

**Result**: 15 tables instead of 47 (-68%)

### Option C: Hybrid (Modular but Cleaner)
**Keep all core tables**
**Move to separate schema**:
- `ai_` tables (embeddings, semantic search) → analytics schema
- `email_` tables (campaigns, tracking) → communications schema
- `activity_` tables (attendance, pulse) → future schema

**Result**: Cleaner public schema (25 tables), optional feature schemas

---

## 8. Schema Statistics

| Metric | Value |
|--------|-------|
| Total Tables | 47 |
| Total Size | 5.8 MB |
| Largest Tables | embedding_queue (104 KB), organizations (64 KB) |
| Foreign Key Relationships | 92 |
| JSONB Columns | 39 (85% of data stored as JSONB) |
| Recursive References | field_type_registry → itself, table_fields → itself |
| Multi-tenant Keys | Every table has workspace_id or organization_id FK |

---

## 9. Critical Paths (High Query Volume)

### Path 1: Table Data Retrieval
```
GET /api/v1/tables/{id}/rows
→ data_tables (1 query)
→ table_fields (1 query for schema)
→ table_rows (1 query, filters by table_id)
→ table_links (1 query if linked columns exist)
→ TOTAL: 4 queries
```
**Index needed**: `data_tables(id)`, `table_fields(table_id)`, `table_rows(table_id, created_at DESC)`

### Path 2: Form Submission
```
POST /api/v1/forms/{id}/submit
→ table_views (1 query - get form config)
→ table_fields (1 query - get schema)
→ [validation via field_type_registry] (in-memory)
→ portal_applicants (1 insert)
→ table_rows (1 insert if auto_create_row)
→ stage_groups (1 insert if workflow)
→ TOTAL: 5-6 queries
```
**Index needed**: `table_views(table_id, type: 'form')`, `field_type_registry(id)`

### Path 3: Workflow Review
```
GET /api/v1/workflows/{id}/stages
→ review_workflows (1 query)
→ application_stages (1 query)
→ stage_groups (1 query - rows in this stage)
→ stage_reviewer_configs (1 query)
→ reviewer_types (1 query)
→ rubrics (1 query)
→ TOTAL: 6 queries
```
**Index needed**: `review_workflows(workspace_id)`, `application_stages(review_workflow_id)`, `stage_groups(stage_id)`

---

## 10. Go Backend Implementation Status

### Implemented Handlers ✅
- `data_tables.go` - Full CRUD for tables
- `forms.go` - Form submission handling
- `workflows.go` - Review workflow operations
- `search.go` - Search with AI suggestions
- `table_links.go` - Relationship management
- `workspaces.go` - Workspace management

### Partially Implemented ⚠️
- `sub_modules.go` - Module enabling works, auto-field-creation incomplete
- `ai.go` - Field suggestions work, embedding async processor missing

### Not Implemented ❌
- Email campaign execution
- Activity/attendance tracking
- Tag automation rules
- Change approval workflows
- Analytics data aggregation

---

## 11. Frontend Component Status

### Portal Editor ✅
- Block-based editing (BlockEditorV2, BlockSettingsPanel)
- Form preview and submission
- No legacy field handling

### Data Tables ✅
- Grid, kanban, calendar views
- Inline editing
- Linked table columns

### Workflows ⚠️
- Application stages visible
- Rubric scoring incomplete
- Reviewer assignment incomplete

### Search ⚠️
- Basic keyword search works
- AI suggestions show but not integrated into UI
- Analytics tracking in place

---

## 12. Recommended Next Steps

1. **Audit Go handlers** for N+1 queries (add Preload for FK relationships)
2. **Index critical columns**: `table_rows(table_id)`, `table_fields(table_id)`, `portal_applicants(form_id)`
3. **Document JSONB structures** in code comments (field_type_registry schema, stage settings, etc.)
4. **Implement async job processor** for embedding_queue and search indexing
5. **Add change approval UI** if compliance is requirement (currently schema-ready but UI missing)
6. **Clean up unused modules** or defer implementation until needed (Activities, email campaigns)

---

## Conclusion

Your schema is **production-ready but over-engineered** for the current portal editor. It's designed for enterprise growth (multi-tenant, modular features, audit trails) but 60% of features aren't exposed in the UI.

**Immediate Action**: Decide on simplification path (Option A/B/C above) and refactor to match current feature set. This will reduce migration complexity and improve query performance.

**Long-term**: The modular architecture is valuable—keep it as foundation for future features. Just clean up unused tables and improve async processing.
