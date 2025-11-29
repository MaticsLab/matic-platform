# Matic Platform - Database Schema Reference

> **Auto-generated from live Supabase database**  
> Last updated: November 2025

## Overview

This document provides a comprehensive reference for all 33 tables in the Matic Platform database.
The platform uses **Supabase PostgreSQL** with Row Level Security (RLS) policies.

### Architecture Summary

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                    ORGANIZATION LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  organizations ─────┬───── organization_members                 │
│                     │                                           │
│                     ▼                                           │
│              workspaces ────── workspace_members                │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│  data_tables ────┬───── table_fields (columns/fields)          │
│                  ├───── table_rows (actual data)               │
│                  ├───── table_views (saved views)              │
│                  └───── table_links → table_row_links          │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MODULE LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│  module_definitions ─── hub_module_configs ─── sub_modules     │
│         │                                                       │
│         └── module_field_configs ── module_history_settings    │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   WORKFLOW LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  review_workflows ── application_stages ── stage_reviewer_cfg  │
│         │                                                       │
│         ├── reviewer_types                                      │
│         └── rubrics                                            │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   HISTORY/AI LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  row_versions ── field_changes                                 │
│  change_approvals                                              │
│  ai_field_suggestions                                          │
│  batch_operations                                              │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SEARCH LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│  search_index (full-text + vector embeddings)                  │
│  search_analytics                                              │
│  embedding_queue ── embedding_stats                            │
│  entity_types ── semantic_field_types ── field_type_registry   │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

---

## Quick Reference: Table Names

**IMPORTANT**: The correct table names are:
- \`table_fields\` (NOT table_columns) - field/column definitions
- \`table_rows\` - actual row data
- \`table_views\` - saved views and forms
- \`data_tables\` - table metadata/definitions

---

## Table of Contents

### Organization & Access
1. organizations - Multi-tenant top-level container
2. organization_members - User-org membership with roles
3. workspaces - Projects within an organization  
4. workspace_members - User-workspace membership

### Core Data
5. data_tables - Table definitions/metadata
6. table_fields - Column/field schema (IMPORTANT: not table_columns)
7. table_rows - Actual data storage
8. table_views - Saved views, forms, kanban boards
9. table_links - Table-to-table relationships (schema)
10. table_row_links - Row-to-row connections (data)

### Module System
11. module_definitions - Available features registry
12. hub_module_configs - Per-table module enablement
13. module_field_configs - Module-to-field type mappings
14. module_history_settings - Per-module history config
15. sub_modules - Child modules (tabs) within hubs

### Workflow & Review
16. review_workflows - Multi-stage review processes
17. application_stages - Individual workflow stages
18. reviewer_types - Types of reviewers (roles)
19. rubrics - Scoring rubrics for reviews
20. stage_reviewer_configs - Stage-reviewer assignments

### History & Versioning
21. row_versions - Version history for rows
22. field_changes - Per-field change details
23. change_approvals - Pending approval requests
24. batch_operations - Bulk operation tracking

### AI & Suggestions
25. ai_field_suggestions - AI-generated data improvements

### Search & Indexing
26. search_index - Full-text + vector embeddings
27. search_analytics - Search query tracking
28. embedding_queue - AI embedding job queue
29. embedding_stats - Embedding coverage statistics (view)
30. entity_types - Semantic entity types
31. semantic_field_types - Semantic field types
32. field_type_registry - Universal field type registry
33. metadata_schema - Metadata structure definitions

---

## RLS Policy Summary

| Access Level | Tables |
|--------------|--------|
| **Public Read (anon)** | entity_types, semantic_field_types, field_type_registry, metadata_schema, module_definitions |
| **Guest Scanner (anon)** | workspaces, data_tables, table_fields, table_rows |
| **Workspace Member** | All workspace-scoped tables (read) |
| **Workspace Admin/Editor** | All workspace-scoped tables (write) |
| **Service Role Only** | embedding_queue |
| **No RLS (backend only)** | ai_field_suggestions, batch_operations, change_approvals, field_changes |

---

## Realtime-Enabled Tables

These tables have Supabase Realtime subscriptions enabled:
- data_tables, table_fields, table_rows, table_views
- search_index
- review_workflows, application_stages, reviewer_types, rubrics, stage_reviewer_configs
- hub_module_configs, sub_modules
- row_versions, change_approvals

---

## Key Functions

### Search
- \`hybrid_search\` - Combined text + vector search
- \`semantic_search\` - Vector-only search
- \`smart_search\` / \`smart_search_fuzzy\` - Fuzzy text search

### History
- \`create_row_version\` - Create version record
- \`get_row_history\` - Get row version history

### Indexing
- \`index_table_row\` - Index row for search
- \`queue_for_embedding\` - Queue for AI embedding

### Modules
- \`auto_enable_default_modules\` - Enable modules on table creation
- \`auto_create_module_fields\` - Create module fields

---

## Go Model to Table Mapping

| Go Model | Table Name |
|----------|------------|
| models.Organization | organizations |
| models.Workspace | workspaces |
| models.DataTable | data_tables |
| models.Field | table_fields |
| models.Row | table_rows |
| models.TableView | table_views |
| models.TableLink | table_links |
| models.RowLink | table_row_links |
| models.ReviewWorkflow | review_workflows |
| models.ApplicationStage | application_stages |
| models.ReviewerType | reviewer_types |
| models.Rubric | rubrics |
| models.SubModule | sub_modules |
| models.RowVersion | row_versions |

---

For detailed column-by-column documentation, query Supabase directly:
\`\`\`sql
\\d table_name
\`\`\`
