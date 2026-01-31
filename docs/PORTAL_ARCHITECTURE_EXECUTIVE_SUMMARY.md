# Portal Architecture - Executive Summary
**Date:** January 31, 2026  
**Audience:** Technical Leadership

## Critical Issue Discovered 🔴

**The public portal is reading data from the WRONG table first.**

```
Current Priority:
1. ❌ portal_applicants (LEGACY, deprecated)
2. ✅ table_rows (PRIMARY, correct)

Result: Users may see stale data from the legacy system.
```

**Location:** `go-backend/handlers/forms.go:2277-2330` ([GetFormSubmission](../go-backend/handlers/forms.go#L2277-L2330))

---

## Architecture Overview

### What We Found

```
┌─────────────────────────────────────────────────────┐
│         APPLICATION SUBMISSION LIFECYCLE            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Signup    → ba_users + ba_accounts             │
│  2. Login     → ba_sessions                         │
│  3. Submit    → table_rows + row_versions +        │
│                 portal_applicants + app_submissions │
│                 (WRITES TO 4 TABLES!)              │
│  4. Load      → portal_applicants FIRST ❌          │
│                 (then table_rows as fallback)       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Data Duplication Problem

Every submission writes the same data to **3-4 tables**:

| Data | Table 1 | Table 2 | Table 3 | Table 4 |
|------|---------|---------|---------|---------|
| Submission Data | `table_rows.data` | `application_submissions.data` | `portal_applicants.submission_data` | - |
| Status | `table_rows.metadata` | `application_submissions.status` | - | - |
| Email | `table_rows.data` | `ba_users.email` | `portal_applicants.email` | - |
| Password | - | `ba_accounts.password` | `portal_applicants.password_hash` | - |

**Result:** High risk of data inconsistency and wasted storage.

---

## Impact Assessment

### 🔴 Critical Issues (Fix Immediately)

| Issue | Impact | Affected Users | Fix Complexity |
|-------|--------|----------------|----------------|
| Wrong read priority | Data inconsistency | All portal users | Easy (30 min) |
| Triple write on submit | Slow saves, transaction failures | All portal users | Medium (2 days) |
| Legacy table still used | Migration incomplete | All portal users | Medium (1 week) |

### ⚠️ High Priority Issues (Fix This Month)

| Issue | Impact | Fix Timeline |
|-------|--------|--------------|
| 9+ email lookup queries | Slow page loads | Week 2 |
| Race conditions on submit | Duplicate submissions | Week 2 |
| No session on signup | Poor UX | Week 3 |
| Missing database indexes | Query performance | Week 1 |

---

## Key Metrics

### Current State (Estimated)

```
📊 Performance
- Tables written per submission: 3-4
- Read queries per load: 2-10 (tries legacy first, then fallbacks)
- Submission save latency: TBD (needs measurement)

📊 Architecture
- Primary data storage: ✅ table_rows
- Legacy table reads: 100% (checked first!)
- Legacy table writes: 100% (still happening)
- Data duplication level: 3-4x

📊 Code Health
- Different email storage locations: 9+
- Query patterns for email lookup: 6-9 variants
- Active database tables for submissions: 4
- Deprecated but still-used tables: 2
```

### Target State (After Migration)

```
📊 Performance
- Tables written per submission: 1 (just table_rows)
- Read queries per load: 1 (single indexed query)
- Submission save latency: <500ms (p95)

📊 Architecture
- Primary data storage: ✅ table_rows
- Legacy table reads: 0%
- Legacy table writes: 0%
- Data duplication level: 1x (single source of truth)

📊 Code Health
- Email storage locations: 1 (standardized)
- Query patterns: 1 (simple indexed lookup)
- Active database tables: 2 (table_rows + ba_users)
- Deprecated tables: 0 (archived)
```

---

## Recommended Action Plan

### ⚡ Immediate (This Week)

1. **Fix Read Priority** - 30 minutes
   ```go
   // Change order in GetFormSubmission:
   // 1. Check table_rows FIRST
   // 2. Fallback to portal_applicants (for old data only)
   ```

2. **Add Database Indexes** - 1 hour
   ```sql
   CREATE INDEX idx_table_rows_applicant_email 
   ON table_rows USING gin ((data->>'_applicant_email'));
   
   CREATE INDEX idx_table_rows_ba_created_by 
   ON table_rows (ba_created_by);
   ```

3. **Stop Writing to Legacy Tables** - 2 days
   - Remove `portal_applicants` write from SubmitForm
   - Remove `application_submissions` write
   - Keep read fallback for existing data

**Impact:** Fixes critical bug, improves performance 50%+

### 🚀 Short-term (This Month)

4. **Standardize Email Storage** - 1 week
   - Migrate all emails to `data->>'_applicant_email'`
   - Update all queries to use single location
   - Remove 8 other email lookup patterns

5. **Complete Better Auth Migration** - 2 weeks
   - Link remaining table_rows to ba_users
   - Remove portal_applicants reads
   - Archive deprecated tables

6. **Add Caching Layer** - 1 week
   - Redis cache for active drafts
   - 15-minute TTL
   - Invalidate on save

**Impact:** Single source of truth, simpler codebase, better performance

### 🏗️ Long-term (Next Quarter)

7. **Extract Common Fields** - 2 weeks
   - Move email, status to table columns
   - Better query performance (indexed columns vs JSONB)
   - Simpler queries

8. **Event Sourcing (Optional)** - 4 weeks
   - Append-only event log
   - Perfect audit trail
   - Time-travel queries

**Impact:** Scalable architecture, perfect audit trail

---

## Cost-Benefit Analysis

### Time Investment
- **Quick Wins (Week 1):** 1-2 days
- **Phase 1 (Month 1):** 2 weeks
- **Complete Migration:** 6-8 weeks

### Benefits
- ✅ **Reliability:** Fix data inconsistency bug
- ✅ **Performance:** 50-70% faster loads (single query vs 2-10)
- ✅ **Maintainability:** Remove 500+ lines of legacy code
- ✅ **Scalability:** Single source of truth, easier to scale
- ✅ **Cost:** Reduce storage by 2-3x (remove duplication)

### Risks
- ⚠️ **Medium Risk:** Requires careful data migration
- ⚠️ **Downtime:** Can be done with zero-downtime migration
- ⚠️ **Rollback:** Keep read fallback during transition

---

## Questions & Answers

### Q: Why is portal_applicants checked first?
**A:** Historical reasons. When Better Auth was introduced, the read path wasn't updated properly. This is a bug that should be fixed immediately.

### Q: Can we just delete portal_applicants?
**A:** Not immediately. It contains historical data. Process:
1. Stop new writes (Week 1)
2. Migrate existing data (Week 2-3)
3. Remove reads (Week 4)
4. Archive table (Week 5)

### Q: What's the risk of NOT fixing this?
**A:** 
- Users see stale data if portal_applicants and table_rows diverge
- Slow performance due to multiple table queries
- High storage costs due to 3-4x duplication
- Complex codebase hard to maintain

### Q: What's application_submissions for?
**A:** Unclear purpose. It duplicates table_rows data. Recommendation: Remove it. Use table_rows + proper indexes instead.

---

## Approval Required

### Immediate Actions (No Approval Needed)
- [x] Fix read priority order (30 min, low risk)
- [x] Add database indexes (1 hour, low risk)

### Phase 1 Migration (Needs Approval)
- [ ] Stop writes to legacy tables (impacts all new submissions)
- [ ] Email standardization (requires data migration)
- [ ] Archive portal_applicants (permanent change)

**Recommended Decision:** Approve Phase 1 migration. Risk is low with proper testing and rollback plan.

---

## Next Steps

1. **Review this document** with technical team
2. **Approve Phase 1 migration** plan
3. **Schedule implementation** for next sprint
4. **Set up monitoring** for key metrics
5. **Create rollback plan** for each phase

---

## Contact

**Questions:** See detailed audit at [`PORTAL_APPLICATION_ARCHITECTURE_AUDIT.md`](PORTAL_APPLICATION_ARCHITECTURE_AUDIT.md)

**Implementation:** Engineering team will execute migration plan with weekly check-ins.
