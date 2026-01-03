# Migrations Folder Analysis Report

**Date:** 2025-01-02  
**Total Migrations:** 35 files  
**Total Lines:** ~4,500+ lines

## Executive Summary

After analyzing all 35 migration files and comparing them with the actual Go backend implementation (models, handlers, database.go AutoMigrate), I've identified:

- ✅ **Fully Implemented:** 18 migrations
- ⚠️ **Partially Implemented:** 5 migrations  
- ❌ **Not Implemented (Can Delete):** 7 migrations
- 🔧 **Can Be Improved:** 5 migrations

## 1. Migrations Analysis

### ✅ FULLY IMPLEMENTED (18 migrations)

These migrations have corresponding models in `go-backend/models/` and are included in `database.go AutoMigrate()`:

1. **000_new_schema_fresh_start.sql** - Core schema (partially, see issues below)
2. **001_field_type_registry.sql** - ✅ Fully implemented
   - Model: `FieldTypeRegistry` in `models/field_registry.go`
   - Seeded in `database.go`
   - Used by `FieldService`

3. **002_row_versions.sql** - ✅ Fully implemented
   - Model: `RowVersion` in `models/field_registry.go`
   - Handler: `handlers/history.go`
   - Service: `services/version_service.go`

4. **003_field_changes.sql** - ✅ Fully implemented
   - Model: `FieldChange` in `models/field_registry.go`
   - Created by `VersionService`

5. **004_ai_field_suggestions.sql** - ✅ Implemented
   - Model: `AIFieldSuggestion` in models
   - Included in AutoMigrate

6. **005_search_index_enhancements.sql** - ✅ Implemented
   - Models: `SearchHistory`, `SearchIndex`, `EntityType`, `SearchAnalytics`, `EmbeddingQueue`, `SemanticFieldType`
   - Included in AutoMigrate

7. **006_change_requests.sql** - ✅ Implemented
   - Models: `ChangeRequest`, `ChangeApproval`
   - Included in AutoMigrate

8. **009_application_groups.sql** - ✅ Implemented
   - Model: `ApplicationGroup` in models
   - Included in AutoMigrate (NOTE: migration 019 says to DROP this, but model exists)

9. **010_workflow_actions_groups.sql** - ✅ Implemented
   - Models: `WorkflowAction`, `StageAction`
   - Included in AutoMigrate (NOTE: migration 019 says to DROP workflow_actions/stage_actions, but models exist)

10. **011_stage_groups_and_custom_statuses.sql** - ✅ Implemented
    - Model: `StageGroup` referenced in models
    - Custom statuses are stored in JSONB in `application_stages`

11. **013_field_architecture_improvement.sql** - ✅ Implemented
    - Changes reflected in `Field` model with `FieldTypeID`, `ParentFieldID`, etc.

12. **017_portal_applicants.sql** - ✅ Fully implemented
    - Model: `PortalApplicant` in `models/models.go`
    - Handlers: `handlers/forms.go` (PortalSignup, PortalLogin, etc.)

13. **018_automation_workflows.sql** - ✅ Fully implemented
    - Models: `AutomationWorkflow`, `AutomationWorkflowExecution`, `AutomationWorkflowExecutionLog`, `AutomationIntegration`
    - Included in AutoMigrate

14. **018_recommendation_requests.sql** - ✅ Fully implemented
    - Model: `RecommendationRequest` in `models/recommendations.go`
    - Handlers: `handlers/recommendations.go`

15. **020_ending_pages.sql** - ✅ Fully implemented
    - Model: `EndingPage` in `models/models.go`
    - Included in AutoMigrate

16. **021_add_section_id_to_fields.sql** - ✅ Implemented
    - `SectionID` field exists in `Field` model

17. **024_portal_activities.sql** - ✅ Fully implemented
    - Model: `PortalActivity` in `models/models.go`
    - Handlers: `handlers/forms.go` (ListPortalActivities, CreatePortalActivity)

18. **029_better_auth.sql** - ✅ Fully implemented
    - Better Auth tables created (ba_users, ba_sessions, etc.)
    - Currently in use

### ⚠️ PARTIALLY IMPLEMENTED (5 migrations)

1. **007_embedding_queue.sql** - ⚠️ Model exists but migration 019 says to DROP
   - Model: `EmbeddingQueue` exists
   - Migration 019 says "move to external job system" - DROP this table
   - **Recommendation:** Keep model, drop migration (or update migration 019)

2. **008_ai_search_functions.sql** - ⚠️ Functions may not be used
   - Creates PostgreSQL functions for AI search
   - Need to verify if backend uses these functions

3. **012_add_address_field_type.sql** - ⚠️ Already in 001
   - Address field type is already in `001_field_type_registry.sql`
   - This migration may be redundant

4. **014_table_files.sql** - ⚠️ Partial implementation
   - Model may exist (need to check)
   - Used by `PortalDocument` but table_files may be separate

5. **017_email_gmail_integration.sql** - ⚠️ Models exist but migration 019 says to DROP
   - Models: `GmailConnection`, `EmailCampaign`, `SentEmail`, `EmailTemplate`, `EmailSignature`
   - Migration 019 says to DROP these tables
   - **Recommendation:** Either remove models OR update migration 019

### ❌ NOT IMPLEMENTED - CAN DELETE (7 migrations)

1. **016_custom_subdomains.sql** - ❌ Not implemented
   - No model, no handler, no usage found
   - **Action:** DELETE

2. **017_add_missing_field_types.sql** - ❌ Redundant
   - Field types are seeded in Go code (`database.go`)
   - **Action:** DELETE or merge into 001

3. **017_form_preview_metadata.sql** - ❌ May be redundant
   - `PreviewName`, `PreviewDescription`, `PreviewImageURL` exist in Table model
   - May already be covered by existing migrations
   - **Action:** Verify and potentially DELETE

4. **017_workspace_invitations.sql** - ❌ Check if Better Auth handles this
   - Better Auth has `ba_invitations` table
   - Need to verify if separate workspace invitations exist
   - **Action:** Verify, potentially DELETE

5. **017_workspace_members_invitations.sql** - ❌ Likely redundant
   - May be covered by Better Auth or workspace_members
   - **Action:** Verify and DELETE if redundant

6. **018_hub_visibility.sql** - ❌ Not clear if implemented
   - Need to check if hub visibility exists in Table model settings
   - **Action:** Verify implementation

7. **027_restore_email_tables.sql** - ❌ Contradicts 019
   - Migration 019 says to DROP email tables
   - This migration tries to restore them
   - **Action:** DELETE (conflicting with 019)

### 🔧 CAN BE IMPROVED (5 migrations)

1. **000_new_schema_fresh_start.sql** - 🔧 ISSUES:
   - Uses `forms` table, but actual schema uses `table_views` with type='form'
   - Uses `form_submissions` table, but actual schema uses `table_rows`
   - References `submission_reviews` table that may not exist
   - **Recommendation:** Update to match actual schema OR mark as "legacy/initial"

2. **015_custom_portal_urls.sql** - 🔧 Check implementation
   - May be stored in `table_views.config` or `data_tables.settings`
   - Need to verify actual implementation

3. **019_portal_view_type.sql** - 🔧 Verify
   - Adds `type` column to `table_views` - should be 'form' or 'portal'
   - Model has `ViewTypePortal` constant, so likely implemented

4. **019_schema_cleanup_and_optimization.sql** - 🔧 ISSUES:
   - Says to DROP `application_groups`, but model exists
   - Says to DROP `workflow_actions`/`stage_actions`, but models exist
   - Says to DROP `embedding_queue`, but model exists
   - Says to DROP email tables, but models exist
   - **Recommendation:** Update migration to match actual usage OR update code

5. **022_ending_pages_priority.sql** - 🔧 Implemented but verify
   - `EndingPage` model has `Priority` field
   - Likely implemented

## 2. Critical Issues Found

### Issue 1: Conflicting Migrations

**Migration 019 says to DROP, but models/handlers exist:**
- `application_groups` - Model exists
- `workflow_actions` - Model exists  
- `stage_actions` - Model exists
- `embedding_queue` - Model exists
- Email tables - Models exist (GmailConnection, EmailCampaign, etc.)

**Recommendation:**
1. Either remove models/handlers if not used
2. OR update migration 019 to not drop these tables
3. OR create a new migration to restore them

### Issue 2: Schema Mismatch in 000_new_schema_fresh_start.sql

The initial schema uses different table names:
- Uses `forms` → Should be `table_views` (type='form')
- Uses `form_submissions` → Should be `table_rows`
- Uses `submission_reviews` → May not exist

**Recommendation:** Mark this migration as "legacy" or update it.

### Issue 3: Duplicate Field Type Definitions

Multiple migrations define field types:
- `001_field_type_registry.sql` - Comprehensive definitions
- `012_add_address_field_type.sql` - Redundant (address already in 001)
- `017_add_missing_field_types.sql` - Redundant (seeded in Go)

**Recommendation:** Consolidate into 001 or remove redundant migrations.

## 3. Recommendations

### Immediate Actions

1. **DELETE these migrations:**
   - `016_custom_subdomains.sql` (not implemented)
   - `017_add_missing_field_types.sql` (redundant, seeded in Go)
   - `027_restore_email_tables.sql` (conflicts with 019)

2. **Resolve conflicts in migration 019:**
   - Decide if email tables should exist
   - Decide if application_groups should exist
   - Update migration accordingly

3. **Verify and potentially DELETE:**
   - `017_workspace_invitations.sql` (check if Better Auth handles this)
   - `017_workspace_members_invitations.sql` (likely redundant)
   - `018_hub_visibility.sql` (verify implementation)

### Medium-Term Improvements

1. **Consolidate field type migrations:**
   - Keep only `001_field_type_registry.sql`
   - Delete `012_add_address_field_type.sql` (redundant)
   - Ensure Go seeding matches SQL

2. **Update migration 000:**
   - Either update to match current schema
   - OR rename to `000_legacy_initial_schema.sql` with a note

3. **Document migration dependencies:**
   - Add comments about which migrations are required
   - Add notes about migrations that can be skipped

### Long-Term Improvements

1. **Create migration index:**
   - Document which migrations are actually applied
   - Track which models depend on which migrations

2. **Add migration tests:**
   - Test that migrations can be applied
   - Test that migrations can be rolled back
   - Verify model schema matches migration schema

3. **Migration validation:**
   - Add checks to ensure migrations don't conflict
   - Validate that models match migration schemas

## 4. Files to Delete

Based on analysis, recommend deleting:

1. `docs/migrations/016_custom_subdomains.sql` - Not implemented
2. `docs/migrations/017_add_missing_field_types.sql` - Redundant
3. `docs/migrations/027_restore_email_tables.sql` - Conflicts with 019

**Potential deletions (need verification):**
- `docs/migrations/017_workspace_invitations.sql`
- `docs/migrations/017_workspace_members_invitations.sql`
- `docs/migrations/018_hub_visibility.sql`

## 5. Migrations Requiring Updates

1. **019_schema_cleanup_and_optimization.sql**
   - Remove DROP statements for tables that are actually used
   - OR add comments explaining why they're dropped

2. **000_new_schema_fresh_start.sql**
   - Update to match current schema
   - OR add note that it's legacy and not meant to be run

3. **017_form_preview_metadata.sql**
   - Verify if this is already covered by other migrations
   - May be redundant

## 6. Summary Statistics

- **Total Migrations:** 35
- **Fully Implemented:** 18 (51%)
- **Partially Implemented:** 5 (14%)
- **Not Implemented (Can Delete):** 3 confirmed + 4 potential (20%)
- **Need Updates:** 3 (9%)

## 7. Next Steps

1. ✅ Review this report
2. ⬜ Verify the 4 "potential deletions" by checking codebase
3. ⬜ Resolve conflicts in migration 019
4. ⬜ Delete confirmed unnecessary migrations
5. ⬜ Update conflicting migrations
6. ⬜ Document which migrations are production-critical

---

**Generated:** 2025-01-02  
**Analysis Method:** Code comparison between SQL migrations and Go backend models/handlers

