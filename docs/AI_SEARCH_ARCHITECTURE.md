# AI-Optimized Schema Architecture

## Executive Summary

This document outlines the architectural improvements to make the Matic Platform database more AI-searchable and easier to retrieve data from.

---

## 🎯 Goals Achieved

1. **Fast Full-Text Search**: PostgreSQL `tsvector` with GIN indexes
2. **Semantic Understanding**: Entity types and semantic field classifications
3. **Relevance Learning**: Search analytics with click-rate boosting
4. **AI Context**: Helper functions that return AI-friendly JSON
5. **Standardized Metadata**: Documented schema for consistent JSONB fields

---

## 📊 New Tables

### `search_index`
Denormalized search index for fast queries:
```sql
- entity_id, entity_type (row, table, form)
- title, subtitle, content (searchable text)
- search_vector (tsvector for full-text)
- hub_type, data_entity_type (filtering)
- tags[] (custom filtering)
- importance_score (ranking)
- view_count, search_click_count (learning)
```

### `entity_types`
Semantic classification of what rows represent:
```
person    → Students, applicants, staff (1.2x boost)
application → Submitted applications (1.1x boost)
event     → Activities, meetings (1.0x boost)
document  → Files, attachments (0.9x boost)
task      → To-do items (0.9x boost)
```

### `search_analytics`
Search behavior tracking:
```sql
- query, query_tokens (pattern analysis)
- clicked_result_id, clicked_result_position
- time_to_click_ms (relevance signal)
```

### `metadata_schema`
Documentation of expected JSONB fields:
```
row_status → "active" | "archived" | "draft"
row_workflow → UUID of assigned workflow
row_tags → ["priority", "scholarship"]
```

---

## 🔧 New Columns

### `data_tables`
- `entity_type` - What kind of data (person, event, etc.)
- `search_vector` - Full-text search tsvector

### `table_fields`
- `semantic_type` - Field meaning (email, phone, status)
- `is_searchable` - Include in search index
- `is_display_field` - Primary display column
- `search_weight` - Ranking importance (1.0 = normal)
- `sample_values` - Example values for AI context

### `workspaces`
- `ai_description` - Natural language summary for AI
- `data_summary` - Stats JSON for quick context

---

## 🚀 Key Functions

### `smart_search(workspace_id, query, filters, limit)`
AI-optimized search with:
- Full-text matching (tsvector)
- Weighted ranking (title > subtitle > content)
- Click-rate boosting
- Entity type weighting
- Content snippet highlighting

### `smart_search_fuzzy(workspace_id, query, filters, limit)`
Fallback fuzzy search using trigram similarity for typos.

### `get_table_schema_for_ai(table_id)`
Returns table structure in AI-friendly JSON:
```json
{
  "table_name": "Applications",
  "entity_type": "application",
  "fields": [
    {"name": "applicant_name", "semantic_type": "name", "is_display_field": true},
    {"name": "email", "semantic_type": "email"}
  ]
}
```

### `get_workspace_summary_for_ai(workspace_id)`
Returns workspace context for AI:
```json
{
  "workspace_name": "Fall 2025 Scholarships",
  "ai_description": "Scholarship review workflow with 3 stages...",
  "tables": [...],
  "statistics": {"table_count": 5, "total_rows": 1234}
}
```

---

## 📈 How It Improves AI Search

### Before
```
Query: "john scholarship"
Method: LIKE '%john%' on JSONB data
Issues: Slow, no ranking, searches all fields equally
```

### After
```
Query: "john scholarship"
Method: 
1. tsvector @@ plainto_tsquery
2. Weighted ranking (name fields > content)
3. Entity boost (person 1.2x)
4. Click-rate boost from analytics
5. Fuzzy fallback with pg_trgm

Result: Fast, ranked, learns from user behavior
```

---

## 🔄 Migration Order

1. **Run 005_module_registry.sql first** - Drops unused tables, adds hub_type
2. **Run 006_ai_search_architecture.sql** - Adds all AI features
3. **Run `rebuild_search_index()`** - Indexes existing data

---

## 🎮 Usage Examples

### Search from Go Backend
```go
// Use smart_search function
var results []SearchResult
db.Raw(`
    SELECT * FROM smart_search(?, ?, ?::jsonb, ?)
`, workspaceID, query, filters, limit).Scan(&results)
```

### Get AI Context
```go
// Get table schema for AI prompt
var schema datatypes.JSON
db.Raw(`SELECT get_table_schema_for_ai(?)`, tableID).Scan(&schema)

// Include in AI prompt:
// "Given this table structure: " + schema.String()
```

### Track Search Analytics
```go
// Log search query
db.Exec(`
    INSERT INTO search_analytics 
    (workspace_id, user_id, query, result_count, source)
    VALUES (?, ?, ?, ?, 'omnisearch')
`, workspaceID, userID, query, len(results))

// Log click
db.Exec(`
    UPDATE search_analytics 
    SET clicked_result_id = ?, clicked_result_position = ?, click_at = NOW()
    WHERE id = ?
`, resultID, position, analyticsID)
```

---

## 🔮 Future Enhancements

1. **Vector Embeddings** - Add pgvector for semantic similarity search
2. **Query Expansion** - Use analytics to suggest related terms
3. **Personalization** - User-specific ranking based on behavior
4. **Real-time Indexing** - Supabase realtime triggers for instant updates
5. **Cross-workspace Search** - Organization-level search with permissions
