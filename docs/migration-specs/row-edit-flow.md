┌────────────────────────────────────────────────────────────────────────────┐
│                           ROW EDIT FLOW                                     │
└────────────────────────────────────────────────────────────────────────────┘

User edits row in table/review
        │
        ▼
┌─────────────────────┐
│ PATCH /tables/:id/  │
│ rows/:row_id        │
│ {                   │
│   data: {           │
│     email: "new@.." │
│   },                │
│   change_reason:    │  ← Optional
│   "Updated email"   │
│ }                   │
└─────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    GO BACKEND: UpdateRowWithHistory                      │
├─────────────────────────────────────────────────────────────────────────┤
│ BEGIN TRANSACTION                                                        │
│                                                                          │
│ 1. Load current row: SELECT * FROM table_rows WHERE id = row_id          │
│    → old_data                                                            │
│                                                                          │
│ 2. Load current version number:                                          │
│    SELECT MAX(version_number) FROM row_versions WHERE row_id = ?         │
│    → current_version                                                     │
│                                                                          │
│ 3. Compute diff:                                                         │
│    changed_fields = diff(old_data, new_data)                             │
│    → [{field: 'email', old: 'old@', new: 'new@'}]                        │
│                                                                          │
│ 4. Normalize new data (same as create)                                   │
│                                                                          │
│ 5. UPDATE table_rows SET data = merged_data                              │
│                                                                          │
│ 6. INSERT into row_versions (                                            │
│      row_id,                                                             │
│      version_number: current_version + 1,                                │
│      data: merged_data,  -- Full snapshot                                │
│      change_type: 'update',                                              │
│      change_reason: input.change_reason,                                 │
│      change_summary: auto_generate(changed_fields),                      │
│      changed_by: user_id                                                 │
│    )                                                                     │
│    RETURNING id → version_id                                             │
│                                                                          │
│ 7. INSERT into field_changes (for each changed field)                    │
│      row_version_id: version_id,                                         │
│      field_name, old_value, new_value,                                   │
│      change_action: 'update',                                            │
│      similarity_score: calculate_similarity(old, new)                    │
│                                                                          │
│ COMMIT                                                                   │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    RE-INDEX IF SEARCHABLE FIELD CHANGED                  │
├─────────────────────────────────────────────────────────────────────────┤
│ IF any changed_field.is_searchable:                                      │
│    UPDATE embedding_queue SET status = 'pending'                         │
│    WHERE entity_id = row_id                                              │
│    -- Or INSERT if not exists                                            │
└─────────────────────────────────────────────────────────────────────────┘