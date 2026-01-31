# Portal Application Architecture Audit
**Date:** January 31, 2026  
**Status:** Complete Analysis

## Executive Summary

This document provides a comprehensive audit of the Matic Platform's public portal application lifecycle, covering user signup, application creation, editing, submission, and retrieval. The audit reveals a **dual-system architecture** currently in transition from legacy `portal_applicants` to a modern Better Auth + unified data model.

---

## Table of Contents

1. [Current Architecture Overview](#current-architecture-overview)
2. [Complete API Audit](#complete-api-audit)
3. [Table Usage Analysis](#table-usage-analysis)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Issues & Concerns](#issues--concerns)
6. [Architecture Recommendations](#architecture-recommendations)
7. [Migration Path](#migration-path)

---

## Current Architecture Overview

### Authentication System

**Current:** Better Auth (Modern)
- **Tables:** `ba_users`, `ba_accounts`, `ba_sessions`
- **User Types:** `'staff'` (internal) | `'applicant'` (portal users)
- **Session Management:** Cookie-based with `matic-portal.session_token`

**Legacy:** `portal_applicants` table (Deprecated but still in use)
- Being phased out but still receives writes
- Contains duplicate data (email, password, submission_data)

### Application Data Storage

**Primary Storage:**
- `table_rows` - Main data repository for all submissions
- JSONB columns: `data`, `metadata`
- Links to `ba_users` via `ba_created_by`

**Parallel Systems:**
- `application_submissions` - New v2 submission tracking
- `portal_applicants` - Legacy system (still being written to)

---

## Complete API Audit

### 1. User Signup Flow

#### **Endpoint:** `POST /api/v1/portal/v2/signup`
**Handler:** [`portal_auth_v2.go:82-200`](../go-backend/handlers/portal_auth_v2.go#L82-L200)

**Request:**
```json
{
  "form_id": "uuid",
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe"
}
```

**Tables Written:**
1. ✅ **`ba_users`** (Primary)
   - Creates user with `user_type='applicant'`
   - Stores `forms_applied` in `metadata` JSONB
   
2. ✅ **`ba_accounts`** (Primary)
   - Creates credential account with bcrypt password
   - Links to `ba_users.id`

**Data Flow:**
```
User Input → Validate → ba_users (INSERT) → ba_accounts (INSERT) → Return User ID
```

**Issues:**
- ⚠️ No automatic session creation on signup (requires separate login)
- ⚠️ Doesn't check for existing `portal_applicants` records

---

### 2. User Login Flow

#### **Endpoint:** `POST /api/v1/portal/v2/login`
**Handler:** [`portal_auth_v2.go:200-286`](../go-backend/handlers/portal_auth_v2.go#L200-L286)

**Request:**
```json
{
  "form_id": "uuid",
  "email": "user@example.com",
  "password": "password123"
}
```

**Tables Read:**
1. ✅ **`ba_users`** - Fetch user by email
2. ✅ **`ba_accounts`** - Verify password (scrypt hash)

**Tables Written:**
1. ✅ **`ba_sessions`** - Create new session (7-day expiry)

**Session Response:**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "name": "John Doe",
  "user_type": "applicant",
  "forms_applied": ["form_uuid_1"],
  "session_token": "token",
  "expires_at": "2026-02-07T..."
}
```

---

### 3. Application Creation (First Save)

#### **Endpoint:** `POST /api/v1/forms/:id/submit`
**Handler:** [`forms.go:1730-1950`](../go-backend/handlers/forms.go#L1730-L1950)

**Request:**
```json
{
  "data": {
    "_applicant_email": "user@example.com",
    "field1": "value1",
    "field2": "value2"
  },
  "email": "user@example.com",
  "save_draft": true
}
```

**Tables Written (NEW Submission):**

1. ✅ **`table_rows`** (Primary - Inside Transaction)
   ```sql
   INSERT INTO table_rows (table_id, data, metadata, ba_created_by)
   VALUES (form_id, data_jsonb, metadata_jsonb, user_id)
   ```
   - Metadata: `{"status": "draft", "created_at": "...", "draft_saved_at": "..."}`

2. ✅ **`row_versions`** (Version History - Inside Transaction)
   ```sql
   INSERT INTO row_versions (row_id, table_id, data, change_type, change_reason, ba_changed_by)
   VALUES (row_id, form_id, data_jsonb, 'create', 'Initial submission from portal', user_id)
   ```

3. ⚠️ **`application_submissions`** (Parallel System - Inside Transaction)
   - Only if `user_id` is present (authenticated)
   - Duplicate data storage

4. ⚠️ **`portal_applicants`** (Legacy - Inside Transaction)
   ```sql
   UPDATE portal_applicants 
   SET submission_data = data, row_id = row_id, updated_at = NOW()
   WHERE form_id = ANY(form_ids_array) AND email = email
   ```
   - Falls back to INSERT if no record exists
   - Searches ALL form views (table_id + view_ids)

5. ✅ **`embedding_queue`** (Async - Outside Transaction)
   - Queues for semantic search indexing

**Issues:**
- ⚠️ **Triple Write:** Data written to `table_rows`, `application_submissions`, AND `portal_applicants`
- ⚠️ **Race Conditions:** Advisory lock used but may fail after 10 retries
- ⚠️ **Complex Email Lookup:** Checks 6 different JSONB paths for email

---

### 4. Application Editing (Update Draft)

#### **Endpoint:** `POST /api/v1/forms/:id/submit`
**Handler:** [`forms.go:1520-1700`](../go-backend/handlers/forms.go#L1520-L1700)

**Same endpoint as creation, but with existing row detection**

**Tables Read:**
1. ✅ **`table_rows`** - Check for existing submission
   - Tries 6 different email location queries:
     ```sql
     "table_id = ? AND data->>'_applicant_email' = ?"
     "table_id = ? AND data->'personal'->>'personalEmail' = ?"
     "table_id = ? AND data->>'email' = ?"
     -- ... 3 more variants
     ```

**Tables Written (EXISTING Submission):**

1. ✅ **`table_rows`** (Update - Inside Transaction)
   ```sql
   UPDATE table_rows 
   SET data = new_data, metadata = updated_metadata, updated_at = NOW()
   WHERE id = existing_row_id
   ```
   - Draft save: Keeps current status or sets to "draft"
   - Full submit: Sets status to "submitted"

2. ✅ **`row_versions`** (Version History - Inside Transaction)
   - Creates new version with `change_type='update'`

3. ⚠️ **`portal_applicants`** (Legacy - Inside Transaction)
   - Same UPDATE/INSERT logic as creation
   - Still maintained for backwards compatibility

4. ✅ **`embedding_queue`** (Async)

**Issues:**
- ⚠️ **Status Confusion:** Code has explicit checks to enforce draft/submitted status, suggesting past bugs
- ⚠️ **allowEditsAfterSubmission Check:** Blocks edits if disabled, but check happens after finding existing row

---

### 5. Application Retrieval (Load Existing)

#### **Endpoint:** `GET /api/v1/forms/:id/submission?email=user@example.com`
**Handler:** [`forms.go:2277-2395`](../go-backend/handlers/forms.go#L2277-L2395)

**Tables Read (Priority Order):**

1. **PRIORITY 1:** `portal_applicants` (Legacy first!)
   ```sql
   SELECT * FROM portal_applicants 
   WHERE form_id = ANY(all_form_ids) AND email = ?
   ```
   - Searches table_id + all view_ids
   - If found, returns `submission_data` from this table
   - **Issue:** This gives priority to legacy table!

2. **PRIORITY 2:** `table_rows` (Fallback)
   - Only checked if NOT found in `portal_applicants`
   - Tries 9 different email location queries:
     ```sql
     "table_id = ? AND data->'personal'->>'personalEmail' = ?"
     "table_id = ? AND data->>'_applicant_email' = ?"
     "table_id = ? AND data->>'email' = ?"
     "table_id = ? AND data->>'Personal Email' = ?"
     "table_id = ? AND data->>'CPS email' = ?"
     "table_id = ? AND data->>'personalEmail' = ?"
     -- Plus 3 LOWER() variants
     ```

**Response:**
```json
{
  "id": "row_id or null",
  "data": { /* submission data */ },
  "metadata": { "status": "draft", ... },
  "created_at": "...",
  "updated_at": "..."
}
```

**Critical Issues:**
- 🔴 **WRONG PRIORITY:** `portal_applicants` checked FIRST (legacy table)
- 🔴 **Data Inconsistency Risk:** Could return stale data from `portal_applicants`
- ⚠️ **Performance:** 9+ queries attempted if not in legacy table
- ⚠️ **No Caching:** Every load hits database

---

### 6. List User Submissions

#### **Endpoint:** `GET /api/v1/portal/v2/submissions`
**Handler:** [`portal_auth_v2.go:287-359`](../go-backend/handlers/portal_auth_v2.go#L287-L359)

**Authentication:** Requires `PortalAuthMiddlewareV2()`

**Tables Read:**
1. ✅ **`ba_users.metadata`** - Get `forms_applied` array
2. ✅ **`table_rows`** - Fetch all submissions where `ba_created_by = user_id`

**Response:**
```json
{
  "forms_applied": ["form_id_1", "form_id_2"],
  "submissions": [
    {
      "id": "row_id",
      "table_id": "form_id",
      "data": { /* ... */ },
      "metadata": { "status": "submitted" },
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

**Issues:**
- ⚠️ Only returns rows with `ba_created_by` set (misses anonymous submissions)
- ⚠️ Doesn't check `application_submissions` table at all

---

### 7. Additional Endpoints

#### **Session Validation**
**Endpoint:** `GET /api/v1/portal/v2/me`
**Handler:** [`portal_auth_v2.go:311-359`](../go-backend/handlers/portal_auth_v2.go#L311-L359)
- Reads: `ba_users`, `ba_sessions`
- Returns user profile + forms_applied

#### **Sync Better Auth User**
**Endpoint:** `POST /api/v1/portal/sync-better-auth-applicant`
**Handler:** [`portal_auth_v2.go:460-589`](../go-backend/handlers/portal_auth_v2.go#L460-L589)
- Checks both v2 `forms` table and legacy `data_tables`
- Attempts to find existing submissions by email
- Used for linking Better Auth users to existing submissions

---

## Table Usage Analysis

### Tables by Usage Pattern

| Table | Purpose | Write Frequency | Read Frequency | Status |
|-------|---------|----------------|----------------|--------|
| `ba_users` | User accounts | Signup only | Every auth | ✅ Primary |
| `ba_accounts` | Credentials | Signup only | Login only | ✅ Primary |
| `ba_sessions` | Active sessions | Login/refresh | Every request | ✅ Primary |
| `table_rows` | Submission data | Every save | Frequent | ✅ Primary |
| `row_versions` | Version history | Every save | Rare | ✅ Good |
| `application_submissions` | Parallel tracking | Every save (if auth) | Rare | ⚠️ Redundant |
| `portal_applicants` | Legacy auth+data | Every save | **Priority 1** | 🔴 Deprecated |
| `embedding_queue` | Search indexing | Every save (async) | Worker only | ✅ Good |

### Data Duplication Matrix

```
User Email: ba_users.email, portal_applicants.email, table_rows.data->>'_applicant_email'
User Name: ba_users.name, portal_applicants.full_name
Password: ba_accounts.password, portal_applicants.password_hash
Submission Data: table_rows.data, application_submissions.data, portal_applicants.submission_data
Status: table_rows.metadata->>'status', application_submissions.status
```

**Redundancy Level:** 🔴 **HIGH** - Most data stored 2-3 times

---

## Data Flow Diagrams

### Current Architecture (Signup + First Submit)

```
┌─────────────┐
│   Browser   │
│  PublicPortal│
└──────┬──────┘
       │
       │ 1. POST /portal/v2/signup
       ▼
┌──────────────────────┐
│  Portal Auth Handler │
└──────┬───────────────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
   ba_users    ba_accounts
   (INSERT)     (INSERT)
       │
       │ 2. POST /forms/:id/submit (save_draft: true)
       ▼
┌──────────────────────┐
│   Form Handler       │
│  (Transaction)       │
└──────┬───────────────┘
       │
       ├──────────┬──────────┬────────────┐
       │          │          │            │
       ▼          ▼          ▼            ▼
   table_rows  row_versions  application_  portal_applicants
   (INSERT)    (INSERT)      submissions   (UPDATE/INSERT)
                             (INSERT)      
```

### Current Architecture (Load Existing)

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ GET /forms/:id/submission?email=x
       ▼
┌──────────────────────┐
│  Form Handler        │
└──────┬───────────────┘
       │
       │ PRIORITY 1 (Checked First!)
       ▼
   portal_applicants ─── Found? ──► Return submission_data
       │                             (Legacy Table!)
       │ Not Found
       │ PRIORITY 2
       ▼
   table_rows ────────── Found? ──► Return data + metadata
       │                             (Primary Table)
       │ Not Found
       ▼
   404 Error
```

**🔴 Critical Issue:** Legacy table checked BEFORE primary table!

---

## Issues & Concerns

### 🔴 Critical Issues

1. **Wrong Read Priority**
   - `portal_applicants` (legacy) checked BEFORE `table_rows` (primary)
   - Could serve stale data to users
   - **Location:** [`forms.go:2277-2330`](../go-backend/handlers/forms.go#L2277-L2330)

2. **Triple Write Problem**
   - Every submission writes to 3 tables: `table_rows`, `application_submissions`, `portal_applicants`
   - Increases transaction complexity and failure risk
   - **Location:** [`forms.go:1768-1890`](../go-backend/handlers/forms.go#L1768-L1890)

3. **Data Inconsistency Risk**
   - Multiple sources of truth for same data
   - No mechanism to keep them in sync
   - Updates to one table may not reflect in others

### ⚠️ High Priority Issues

4. **Complex Email Lookups**
   - 9+ different JSONB paths checked for email
   - Performance impact on every retrieval
   - Hard to maintain and debug
   - **Location:** [`forms.go:2318-2340`](../go-backend/handlers/forms.go#L2318-L2340)

5. **Race Condition Risks**
   - Advisory lock can fail after 10 retries
   - Concurrent submissions could create duplicates
   - **Location:** [`forms.go:1523-1541`](../go-backend/handlers/forms.go#L1523-L1541)

6. **Incomplete Migration**
   - Better Auth implemented but legacy tables still in use
   - New code writes to both systems
   - No clear migration completion plan

7. **Unused Parallel System**
   - `application_submissions` table written but rarely read
   - Purpose unclear vs `table_rows`
   - Adds overhead without clear benefit

### ⚠️ Medium Priority Issues

8. **No Automatic Session on Signup**
   - Users must login separately after signup
   - Poor UX: extra step required

9. **Metadata Status Enforcement**
   - Explicit validation suggests past bugs with status corruption
   - Code complexity to prevent draft/submitted confusion
   - **Location:** [`forms.go:1749-1766`](../go-backend/handlers/forms.go#L1749-L1766)

10. **Missing Indexes**
    - Email lookups scan JSONB without indexes
    - `table_rows.data->>'_applicant_email'` likely slow

11. **Anonymous Submissions Lost**
    - `ListUserSubmissions` only returns rows with `ba_created_by`
    - Pre-signup submissions orphaned

---

## Architecture Recommendations

### 🎯 Immediate Actions (Week 1)

#### 1. Fix Read Priority Order
**Problem:** Legacy table checked before primary  
**Solution:** Reverse lookup order in `GetFormSubmission`

```go
// CURRENT (WRONG):
// 1. Check portal_applicants
// 2. Fallback to table_rows

// SHOULD BE:
// 1. Check table_rows (PRIMARY)
// 2. Fallback to portal_applicants (only if migration incomplete)
```

**Files to Change:**
- [`go-backend/handlers/forms.go:2277-2395`](../go-backend/handlers/forms.go#L2277-L2395)

#### 2. Add Database Indexes
```sql
-- Email lookup optimization
CREATE INDEX IF NOT EXISTS idx_table_rows_applicant_email 
ON table_rows USING gin ((data->>'_applicant_email'));

CREATE INDEX IF NOT EXISTS idx_table_rows_personal_email 
ON table_rows USING gin ((data->'personal'->>'personalEmail'));

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_table_rows_status 
ON table_rows USING gin ((metadata->>'status'));

-- User submissions
CREATE INDEX IF NOT EXISTS idx_table_rows_ba_created_by 
ON table_rows (ba_created_by) WHERE ba_created_by IS NOT NULL;
```

#### 3. Stop Writing to `portal_applicants`
**Problem:** Triple write to deprecated table  
**Solution:** Remove `portal_applicants` write from `SubmitForm`

```go
// Remove lines 1826-1887 in forms.go
// Keep ONLY:
// 1. table_rows write
// 2. row_versions write
// 3. embedding_queue write
// Remove: portal_applicants write
// Remove: application_submissions write (for now)
```

**Migration Note:** Keep read fallback for existing data

---

### 🚀 Short-term Improvements (Month 1)

#### 4. Standardize Email Storage
**Problem:** Email stored in 9+ different locations  
**Solution:** Always use `data->>'_applicant_email'` for portal forms

**Implementation:**
- Migrate existing emails to standard location
- Update all queries to use single path
- Add validation to enforce standard

```sql
-- Migration query
UPDATE table_rows 
SET data = jsonb_set(
  data, 
  '{_applicant_email}', 
  to_jsonb(COALESCE(
    data->>'email',
    data->'personal'->>'personalEmail',
    data->>'Email'
  ))
)
WHERE table_id IN (SELECT id FROM data_tables WHERE type = 'form')
AND data ? 'email' OR data->'personal' ? 'personalEmail';
```

#### 5. Implement Submission Caching
**Problem:** Every load hits database  
**Solution:** Redis/in-memory cache for active drafts

```go
// Cache key: submission:{form_id}:{email}
// TTL: 15 minutes
// Invalidate on save
```

#### 6. Create Session on Signup
**Problem:** Extra login step after signup  
**Solution:** Return session token in signup response

```go
// In PortalSignupV2, after creating user:
session := createSession(userID)
return PortalUserResponse{
    ID: userID,
    Email: email,
    SessionToken: session.Token,
    ExpiresAt: session.ExpiresAt,
}
```

#### 7. Clarify `application_submissions` Purpose
**Options:**
A. **Remove entirely** - Use only `table_rows`
B. **Use as index** - Store minimal tracking data only
C. **Make primary** - Migrate away from `table_rows`

**Recommendation:** Option A (remove) - `table_rows` with proper indexes is sufficient

---

### 🏗️ Long-term Strategy (Quarter 1)

#### 8. Complete Better Auth Migration

**Phase 1: Data Migration** (Week 1-2)
```sql
-- Migrate remaining portal_applicants to ba_users
-- Link existing table_rows to ba_users via email matching
UPDATE table_rows tr
SET ba_created_by = bu.id
FROM ba_users bu
WHERE bu.email = tr.data->>'_applicant_email'
AND tr.ba_created_by IS NULL;
```

**Phase 2: Read Path** (Week 3)
- Remove `portal_applicants` reads
- Use only `table_rows` + `ba_users`

**Phase 3: Write Path** (Week 4)
- Remove `portal_applicants` writes
- Archive table for historical reference

**Phase 4: Cleanup** (Week 5-6)
- Drop unused tables
- Update documentation
- Remove legacy code paths

#### 9. Optimize Table Structure

**Current:**
```
table_rows:
  - data (JSONB) ← All form data
  - metadata (JSONB) ← Status, timestamps
```

**Proposal:** Extract common fields for performance
```sql
ALTER TABLE table_rows 
ADD COLUMN applicant_email VARCHAR(255),
ADD COLUMN status VARCHAR(50),
ADD COLUMN submitted_at TIMESTAMPTZ;

-- Create indexes
CREATE INDEX idx_table_rows_applicant_email ON table_rows(applicant_email);
CREATE INDEX idx_table_rows_status ON table_rows(status);
CREATE INDEX idx_table_rows_submitted_at ON table_rows(submitted_at);
```

**Benefits:**
- Faster queries (indexed columns vs JSONB)
- Better query planner estimates
- Simpler WHERE clauses

#### 10. Implement Event Sourcing (Optional)

**Current:** Overwrite data on each save  
**Proposed:** Append-only event log

```
table_row_events:
  - id (PK)
  - row_id (FK)
  - event_type (draft_saved, submitted, edited)
  - data_snapshot (JSONB)
  - user_id
  - timestamp

-- Rebuild current state:
SELECT data_snapshot 
FROM table_row_events 
WHERE row_id = ? 
ORDER BY timestamp DESC 
LIMIT 1;
```

**Benefits:**
- Perfect audit trail
- Time-travel queries
- Safer rollbacks

---

### 📊 Monitoring & Observability

#### 11. Add Metrics
```go
// Track key operations
metrics.Increment("portal.signup.success")
metrics.Increment("portal.submission.create")
metrics.Increment("portal.submission.update")
metrics.Histogram("portal.submission.save_duration", duration)

// Track data sources
metrics.Increment("portal.read.portal_applicants") // Should decrease over time
metrics.Increment("portal.read.table_rows")        // Should be 100%
```

#### 12. Add Structured Logging
```go
log.WithFields(log.Fields{
    "user_id": userID,
    "form_id": formID,
    "row_id": rowID,
    "action": "submission_save",
    "source": "portal_v2",
}).Info("Submission saved")
```

---

## Migration Path

### Phase 1: Stabilize (Week 1-2)
- [ ] Fix read priority order
- [ ] Add database indexes
- [ ] Stop new writes to `portal_applicants`
- [ ] Add metrics and monitoring

### Phase 2: Optimize (Week 3-4)
- [ ] Standardize email storage
- [ ] Implement caching
- [ ] Create session on signup
- [ ] Remove `application_submissions` writes

### Phase 3: Clean Up (Week 5-8)
- [ ] Migrate remaining `portal_applicants` data
- [ ] Remove legacy read paths
- [ ] Archive deprecated tables
- [ ] Extract common fields from JSONB

### Phase 4: Scale (Month 3)
- [ ] Implement read replicas
- [ ] Add connection pooling
- [ ] Consider event sourcing for audit trail
- [ ] Performance testing and optimization

---

## Metrics & Success Criteria

### Key Metrics to Track

| Metric | Current (Estimated) | Target | Timeline |
|--------|---------------------|--------|----------|
| Tables written per submission | 3-4 | 1 | Week 2 |
| Read queries per load | 2-10 | 1 | Week 4 |
| Submission save latency (p95) | TBD | <500ms | Month 1 |
| Cache hit rate | 0% | >80% | Month 1 |
| `portal_applicants` reads | 100% | 0% | Month 2 |
| Data consistency issues | TBD | 0 | Month 2 |

### Success Criteria

✅ **Phase 1 Complete When:**
- All new submissions use only `table_rows` + `ba_users`
- `portal_applicants` receives zero writes
- Read priority: `table_rows` first

✅ **Phase 2 Complete When:**
- Single email storage location
- Cache hit rate >80%
- `application_submissions` table unused

✅ **Phase 3 Complete When:**
- Zero reads from `portal_applicants`
- Table archived/dropped
- All legacy code removed

---

## Appendix

### Related Files
- [`go-backend/handlers/portal_auth_v2.go`](../go-backend/handlers/portal_auth_v2.go) - Portal authentication
- [`go-backend/handlers/forms.go`](../go-backend/handlers/forms.go) - Form submission
- [`go-backend/router/router.go`](../go-backend/router/router.go) - API routes
- [`supabase/migrations/20260126173611_remote_schema.sql`](../supabase/migrations/20260126173611_remote_schema.sql) - Database schema

### Database Schema
```sql
-- Primary Tables (Keep)
ba_users (id TEXT PK, email, name, user_type, metadata JSONB)
ba_accounts (id TEXT PK, user_id TEXT FK, password TEXT)
ba_sessions (id TEXT PK, user_id TEXT FK, token, expires_at)
table_rows (id UUID PK, table_id UUID FK, data JSONB, metadata JSONB, ba_created_by TEXT FK)
row_versions (id UUID PK, row_id UUID FK, data JSONB, change_type, ba_changed_by TEXT FK)

-- Secondary Tables (Keep)
embedding_queue (entity_id UUID, entity_type, status)

-- Deprecated Tables (Archive/Remove)
portal_applicants (id UUID PK, form_id UUID FK, email, submission_data JSONB, ba_user_id TEXT FK)
application_submissions (id UUID PK, user_id TEXT FK, form_id UUID FK, data JSONB, status)
```

---

## Conclusion

The current architecture suffers from **data duplication** and **incomplete migration** from legacy systems. The immediate priority is to:

1. **Fix the read priority bug** (portal_applicants checked first)
2. **Stop writing to deprecated tables**
3. **Complete the Better Auth migration**

By following this migration path, the platform will achieve:
- ✅ **Single source of truth** for submission data
- ✅ **Better performance** through proper indexing
- ✅ **Reduced complexity** by removing duplicate tables
- ✅ **Improved reliability** through consistent data flow

**Estimated Effort:** 6-8 weeks for complete migration  
**Risk Level:** Medium (requires careful data migration)  
**Impact:** High (improves performance, reliability, maintainability)
