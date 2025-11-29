-- Enhanced search_index for field-aware embeddings
ALTER TABLE search_index ADD COLUMN IF NOT EXISTS field_embeddings JSONB DEFAULT '{}';
-- Structure:
-- {
--   "full_text": [0.1, 0.2, ...],  -- Embedding of entire row
--   "by_semantic_type": {
--     "name": [0.1, 0.2, ...],
--     "email": [0.1, 0.2, ...],
--     "description": [0.1, 0.2, ...]
--   }
-- }

-- Track which fields contribute to search
ALTER TABLE search_index ADD COLUMN IF NOT EXISTS indexed_fields JSONB DEFAULT '[]';
-- Structure:
-- [
--   {"field_id": "uuid", "field_name": "name", "contributed_text": "John Smith", "weight": 2.0},
--   {"field_id": "uuid", "field_name": "bio", "contributed_text": "Software engineer...", "weight": 1.5}
-- ]