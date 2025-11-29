┌────────────────────────────────────────────────────────────────────────────┐
│                    REPEATER DATA STORAGE                                    │
└────────────────────────────────────────────────────────────────────────────┘

Field Definition (table_fields):
┌─────────────────────────────────────────────────────────────────────────┐
│ {                                                                        │
│   "id": "field-123",                                                     │
│   "name": "activities",                                                  │
│   "label": "Extracurricular Activities",                                 │
│   "type": "repeater",                        ← Links to registry         │
│   "field_type_id": "repeater",                                           │
│   "config": {                                                            │
│     "children": [                            ← Child field definitions   │
│       {"name": "activity_name", "type": "text", "label": "Activity"},    │
│       {"name": "role", "type": "select", "label": "Your Role",           │
│         "options": ["Leader", "Member", "Founder"]},                     │
│       {"name": "years", "type": "number", "label": "Years Involved"}     │
│     ],                                                                   │
│     "min_items": 0,                                                      │
│     "max_items": 10,                                                     │
│     "item_label": "Activity"                                             │
│   }                                                                      │
│ }                                                                        │
└─────────────────────────────────────────────────────────────────────────┘

Stored Data (table_rows.data):
┌─────────────────────────────────────────────────────────────────────────┐
│ {                                                                        │
│   "name": "John Smith",                                                  │
│   "email": "john@example.com",                                           │
│   "activities": [                            ← Repeater stored as array  │
│     {                                                                    │
│       "activity_name": "Chess Club",         ← Uses child field names    │
│       "role": "President",                                               │
│       "years": 3                                                         │
│     },                                                                   │
│     {                                                                    │
│       "activity_name": "Debate Team",                                    │
│       "role": "Member",                                                  │
│       "years": 2                                                         │
│     }                                                                    │
│   ]                                                                      │
│ }                                                                        │
└─────────────────────────────────────────────────────────────────────────┘

AI Embedding Strategy (from ai_schema):
┌─────────────────────────────────────────────────────────────────────────┐
│ Repeater ai_schema.embedding_strategy = "summarize_count"                │
│                                                                          │
│ Generated text for embedding:                                            │
│ "Extracurricular Activities: 2 items (Chess Club as President,           │
│  Debate Team as Member)"                                                 │
│                                                                          │
│ Alternative: "flatten_all" strategy would produce:                       │
│ "Activity: Chess Club, Role: President, Years: 3.                        │
│  Activity: Debate Team, Role: Member, Years: 2."                         │
└─────────────────────────────────────────────────────────────────────────┘

Field Change Tracking (for repeater edits):
┌─────────────────────────────────────────────────────────────────────────┐
│ User removes Chess Club, adds Science Olympiad                           │
│                                                                          │
│ field_changes records:                                                   │
│ [                                                                        │
│   {                                                                      │
│     "field_name": "activities",                                          │
│     "nested_path": ["0"],             ← First item removed               │
│     "change_action": "remove",                                           │
│     "old_value": {"activity_name": "Chess Club", ...}                    │
│   },                                                                     │
│   {                                                                      │
│     "field_name": "activities",                                          │
│     "nested_path": ["1"],             ← New item added at end            │
│     "change_action": "add",                                              │
│     "new_value": {"activity_name": "Science Olympiad", ...}              │
│   }                                                                      │
│ ]                                                                        │
└─────────────────────────────────────────────────────────────────────────┘