-- Enhanced search_index for field-aware embeddings
-- Run after initial search_index table exists

-- Add field embeddings support
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

-- Add embedding metadata
ALTER TABLE search_index ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE search_index ADD COLUMN IF NOT EXISTS embedding_model TEXT;
ALTER TABLE search_index ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMPTZ;

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_search_index_embedding ON search_index 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Index for field-specific searches
CREATE INDEX IF NOT EXISTS idx_search_index_indexed_fields ON search_index 
  USING gin (indexed_fields);
