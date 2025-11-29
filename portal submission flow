┌────────────────────────────────────────────────────────────────────────────┐
│                        PORTAL SUBMISSION FLOW                               │
└────────────────────────────────────────────────────────────────────────────┘

User fills portal form
        │
        ▼
┌─────────────────────┐
│ Frontend validates  │ ← Uses field_type_registry.input_schema
│ against input_schema│
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ POST /forms/:id/    │
│ submit              │
│ { data: {...} }     │
└─────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    GO BACKEND: FieldNormalizer                           │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Load table_fields with field_type_registry JOIN                       │
│ 2. For each field:                                                       │
│    - Validate against storage_schema                                     │
│    - Normalize value (trim strings, parse dates, flatten groups)         │
│    - Handle repeater: ensure array of objects with valid children        │
│ 3. Generate normalized data JSONB                                        │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CREATE ROW WITH VERSION                               │
├─────────────────────────────────────────────────────────────────────────┤
│ BEGIN TRANSACTION                                                        │
│                                                                          │
│ 1. INSERT into table_rows (data: normalized_data)                        │
│    RETURNING id → row_id                                                 │
│                                                                          │
│ 2. INSERT into row_versions (                                            │
│      row_id,                                                             │
│      version_number: 1,                                                  │
│      data: normalized_data,                                              │
│      change_type: 'create',                                              │
│      change_summary: 'Initial submission from portal',                   │
│      changed_by: user_id                                                 │
│    )                                                                     │
│    RETURNING id → version_id                                             │
│                                                                          │
│ 3. INSERT into field_changes (for each field with data)                  │
│      row_version_id: version_id,                                         │
│      field_name, field_type,                                             │
│      old_value: NULL,                                                    │
│      new_value: field_value,                                             │
│      change_action: 'add'                                                │
│                                                                          │
│ COMMIT                                                                   │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI INDEXING (Async)                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Queue row for embedding:                                              │
│    INSERT INTO embedding_queue (entity_id: row_id, entity_type: 'row')   │
│                                                                          │
│ 2. Background worker:                                                    │
│    - Load row with field_type_registry                                   │
│    - For each searchable field:                                          │
│      - Check ai_schema.embedding_strategy                                │
│      - Skip if 'skip' or privacy_level = 'pii'                           │
│      - Build embedding text based on strategy                            │
│    - Generate embedding via Cohere                                       │
│    - Update search_index with embedding + indexed_fields                 │
└─────────────────────────────────────────────────────────────────────────┘