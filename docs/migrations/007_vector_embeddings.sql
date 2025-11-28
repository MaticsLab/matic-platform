-- =====================================================
-- MIGRATION 007: VECTOR EMBEDDINGS FOR SEMANTIC SEARCH
-- =====================================================
-- This migration adds pgvector support for semantic similarity search.
-- Enables AI-powered search that understands meaning, not just keywords.
--
-- Key Features:
-- 1. pgvector extension for vector storage
-- 2. Embedding column on search_index
-- 3. Semantic search functions
-- 4. Hybrid search (keyword + semantic)
-- 5. Embedding generation tracking
--
-- Prerequisites:
-- - Supabase project with pgvector enabled (available on all plans)
-- - External embedding service (OpenAI, Cohere, etc.)
-- =====================================================

-- =====================================================
-- PHASE 1: ENABLE PGVECTOR EXTENSION
-- =====================================================

-- Enable vector extension (already available on Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- PHASE 2: ADD EMBEDDING COLUMN TO SEARCH_INDEX
-- =====================================================

-- Add embedding column for semantic vectors
-- Using 1536 dimensions for OpenAI ada-002 compatibility
-- Can also use 384 (MiniLM), 768 (BERT), or 3072 (text-embedding-3-large)
ALTER TABLE search_index
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model TEXT,          -- 'openai/text-embedding-ada-002'
ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMPTZ;

COMMENT ON COLUMN search_index.embedding IS 
'Vector embedding for semantic similarity search (1536 dims for OpenAI ada-002)';
COMMENT ON COLUMN search_index.embedding_model IS 
'Model used to generate embedding (for cache invalidation on model change)';

-- Create HNSW index for fast approximate nearest neighbor search
-- HNSW is faster than IVFFlat for most use cases
CREATE INDEX IF NOT EXISTS idx_search_index_embedding 
ON search_index 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Alternative: IVFFlat index (better for larger datasets, requires training)
-- CREATE INDEX IF NOT EXISTS idx_search_index_embedding_ivf
-- ON search_index
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- =====================================================
-- PHASE 3: EMBEDDING GENERATION QUEUE
-- =====================================================

-- Track which items need embeddings generated
CREATE TABLE IF NOT EXISTS embedding_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL,
    entity_type TEXT NOT NULL,       -- 'row', 'table', 'workspace'
    content_hash TEXT,               -- SHA256 of content (skip if unchanged)
    priority INTEGER DEFAULT 0,      -- Higher = process first
    status TEXT DEFAULT 'pending',   -- pending, processing, completed, failed
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    
    UNIQUE(entity_id, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_embedding_queue_status 
ON embedding_queue(status, priority DESC, created_at);

COMMENT ON TABLE embedding_queue IS 
'Queue for async embedding generation. External service polls this table.';

-- Trigger to queue new search index entries for embedding
CREATE OR REPLACE FUNCTION queue_for_embedding()
RETURNS TRIGGER AS $$
BEGIN
    -- Only queue if content changed or no embedding exists
    IF TG_OP = 'INSERT' OR 
       OLD.content IS DISTINCT FROM NEW.content OR 
       NEW.embedding IS NULL THEN
        
        INSERT INTO embedding_queue (entity_id, entity_type, content_hash, priority)
        VALUES (
            NEW.entity_id,
            NEW.entity_type,
            encode(sha256(COALESCE(NEW.content, '')::bytea), 'hex'),
            CASE 
                WHEN NEW.entity_type = 'table' THEN 10  -- Tables are higher priority
                WHEN NEW.entity_type = 'form' THEN 8
                ELSE 5
            END
        )
        ON CONFLICT (entity_id, entity_type) DO UPDATE SET
            content_hash = EXCLUDED.content_hash,
            status = 'pending',
            attempts = 0,
            error_message = NULL,
            created_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_queue_embedding ON search_index;
CREATE TRIGGER trigger_queue_embedding
    AFTER INSERT OR UPDATE ON search_index
    FOR EACH ROW
    EXECUTE FUNCTION queue_for_embedding();

-- =====================================================
-- PHASE 4: SEMANTIC SEARCH FUNCTION
-- =====================================================

-- Pure semantic search using vector similarity
CREATE OR REPLACE FUNCTION semantic_search(
    p_workspace_id UUID,
    p_embedding vector(1536),
    p_limit INTEGER DEFAULT 20,
    p_similarity_threshold REAL DEFAULT 0.7
) RETURNS TABLE (
    entity_id UUID,
    entity_type TEXT,
    table_id UUID,
    title TEXT,
    subtitle TEXT,
    hub_type TEXT,
    data_entity_type TEXT,
    similarity REAL,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        si.entity_id,
        si.entity_type,
        si.table_id,
        si.title,
        si.subtitle,
        si.hub_type,
        si.data_entity_type,
        (1 - (si.embedding <=> p_embedding))::REAL AS similarity,
        si.metadata
    FROM search_index si
    WHERE 
        si.workspace_id = p_workspace_id
        AND si.embedding IS NOT NULL
        AND (1 - (si.embedding <=> p_embedding)) >= p_similarity_threshold
    ORDER BY si.embedding <=> p_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 5: HYBRID SEARCH (KEYWORD + SEMANTIC)
-- =====================================================

-- Combine full-text search with semantic similarity
CREATE OR REPLACE FUNCTION hybrid_search(
    p_workspace_id UUID,
    p_query TEXT,
    p_embedding vector(1536) DEFAULT NULL,
    p_filters JSONB DEFAULT '{}',
    p_limit INTEGER DEFAULT 50,
    p_keyword_weight REAL DEFAULT 0.5,  -- Weight for keyword search (0-1)
    p_semantic_weight REAL DEFAULT 0.5  -- Weight for semantic search (0-1)
) RETURNS TABLE (
    entity_id UUID,
    entity_type TEXT,
    table_id UUID,
    title TEXT,
    subtitle TEXT,
    content_snippet TEXT,
    hub_type TEXT,
    data_entity_type TEXT,
    tags TEXT[],
    keyword_score REAL,
    semantic_score REAL,
    combined_score REAL,
    metadata JSONB
) AS $$
DECLARE
    v_query_tsquery tsquery;
    v_hub_type_filter TEXT;
BEGIN
    -- Parse query
    v_query_tsquery := plainto_tsquery('english', p_query);
    v_hub_type_filter := p_filters->>'hub_type';
    
    RETURN QUERY
    WITH keyword_results AS (
        SELECT 
            si.entity_id,
            si.entity_type,
            si.table_id,
            si.title,
            si.subtitle,
            si.content,
            si.search_vector,
            si.embedding,
            si.hub_type,
            si.data_entity_type,
            si.tags,
            si.metadata,
            ts_rank_cd(si.search_vector, v_query_tsquery, 32) AS kw_score
        FROM search_index si
        WHERE 
            si.workspace_id = p_workspace_id
            AND si.search_vector @@ v_query_tsquery
            AND (v_hub_type_filter IS NULL OR si.hub_type = v_hub_type_filter)
    ),
    scored_results AS (
        SELECT 
            kr.*,
            -- Normalize keyword score to 0-1 range
            (kr.kw_score / GREATEST(MAX(kr.kw_score) OVER(), 0.001))::REAL AS norm_keyword_score,
            -- Calculate semantic score if embedding provided
            CASE 
                WHEN p_embedding IS NOT NULL AND kr.embedding IS NOT NULL 
                THEN (1 - (kr.embedding <=> p_embedding))::REAL
                ELSE 0
            END AS sem_score
        FROM keyword_results kr
    )
    SELECT 
        sr.entity_id,
        sr.entity_type,
        sr.table_id,
        sr.title,
        sr.subtitle,
        ts_headline('english', sr.content, v_query_tsquery, 
            'MaxWords=30, MinWords=15, StartSel=<mark>, StopSel=</mark>')::TEXT AS content_snippet,
        sr.hub_type,
        sr.data_entity_type,
        sr.tags,
        sr.norm_keyword_score AS keyword_score,
        sr.sem_score AS semantic_score,
        (
            (sr.norm_keyword_score * p_keyword_weight) + 
            (sr.sem_score * p_semantic_weight)
        )::REAL AS combined_score,
        sr.metadata
    FROM scored_results sr
    ORDER BY combined_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 6: SIMILAR ITEMS FUNCTION
-- =====================================================

-- Find similar items to a given entity
CREATE OR REPLACE FUNCTION find_similar(
    p_entity_id UUID,
    p_entity_type TEXT,
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    entity_id UUID,
    entity_type TEXT,
    table_id UUID,
    title TEXT,
    subtitle TEXT,
    similarity REAL,
    metadata JSONB
) AS $$
DECLARE
    v_embedding vector(1536);
    v_workspace_id UUID;
BEGIN
    -- Get the source item's embedding
    SELECT si.embedding, si.workspace_id 
    INTO v_embedding, v_workspace_id
    FROM search_index si
    WHERE si.entity_id = p_entity_id AND si.entity_type = p_entity_type;
    
    IF v_embedding IS NULL THEN
        RETURN;  -- No embedding, can't find similar
    END IF;
    
    RETURN QUERY
    SELECT 
        si.entity_id,
        si.entity_type,
        si.table_id,
        si.title,
        si.subtitle,
        (1 - (si.embedding <=> v_embedding))::REAL AS similarity,
        si.metadata
    FROM search_index si
    WHERE 
        si.workspace_id = v_workspace_id
        AND si.embedding IS NOT NULL
        AND NOT (si.entity_id = p_entity_id AND si.entity_type = p_entity_type)  -- Exclude self
    ORDER BY si.embedding <=> v_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 7: BATCH UPDATE EMBEDDINGS
-- =====================================================

-- Function to update embeddings in batch (called by external service)
CREATE OR REPLACE FUNCTION update_embeddings(
    p_updates JSONB  -- Array of {entity_id, entity_type, embedding, model}
) RETURNS INTEGER AS $$
DECLARE
    v_update RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_update IN SELECT * FROM jsonb_to_recordset(p_updates) AS x(
        entity_id UUID, 
        entity_type TEXT, 
        embedding REAL[], 
        model TEXT
    )
    LOOP
        UPDATE search_index
        SET 
            embedding = v_update.embedding::vector,
            embedding_model = v_update.model,
            embedding_created_at = NOW()
        WHERE entity_id = v_update.entity_id 
          AND entity_type = v_update.entity_type;
        
        -- Mark as completed in queue
        UPDATE embedding_queue
        SET status = 'completed', processed_at = NOW()
        WHERE entity_id = v_update.entity_id 
          AND entity_type = v_update.entity_type;
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 8: EMBEDDING STATS VIEW
-- =====================================================

CREATE OR REPLACE VIEW embedding_stats AS
SELECT 
    si.workspace_id,
    COUNT(*) AS total_items,
    COUNT(si.embedding) AS items_with_embeddings,
    ROUND(100.0 * COUNT(si.embedding) / NULLIF(COUNT(*), 0), 1) AS coverage_pct,
    COUNT(*) FILTER (WHERE eq.status = 'pending') AS pending_embeddings,
    COUNT(*) FILTER (WHERE eq.status = 'failed') AS failed_embeddings,
    MAX(si.embedding_created_at) AS last_embedding_at
FROM search_index si
LEFT JOIN embedding_queue eq ON si.entity_id = eq.entity_id AND si.entity_type = eq.entity_type
GROUP BY si.workspace_id;

COMMENT ON VIEW embedding_stats IS 
'Overview of embedding coverage per workspace';

-- =====================================================
-- PHASE 9: SEMANTIC FIELD TYPE REGISTRY
-- =====================================================

-- Registry of semantic field types (for AI field detection)
CREATE TABLE IF NOT EXISTS semantic_field_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    patterns TEXT[] DEFAULT '{}',        -- Regex patterns to detect this type
    sample_values JSONB DEFAULT '[]',    -- Example values
    embedding_weight REAL DEFAULT 1.0,   -- How much to weight in embeddings
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO semantic_field_types (id, name, description, patterns, sample_values, embedding_weight)
VALUES
    ('name', 'Name', 'Person or entity name', 
     ARRAY['name$', '^name', 'full_?name', 'first_?name', 'last_?name']::TEXT[],
     '["John Smith", "Jane Doe", "Alex Johnson"]', 2.0),
    
    ('email', 'Email Address', 'Email contact information',
     ARRAY['email', 'e_?mail', 'mail']::TEXT[],
     '["john@example.com", "jane.doe@company.org"]', 1.5),
    
    ('phone', 'Phone Number', 'Telephone contact',
     ARRAY['phone', 'tel', 'mobile', 'cell']::TEXT[],
     '["(555) 123-4567", "+1-555-234-5678"]', 1.0),
    
    ('status', 'Status', 'State or status indicator',
     ARRAY['status', 'state', 'stage']::TEXT[],
     '["active", "pending", "approved", "rejected"]', 1.5),
    
    ('date', 'Date', 'Date or datetime value',
     ARRAY['date', 'created', 'updated', 'time', '_at$', '_on$']::TEXT[],
     '["2024-01-15", "2024-12-25T10:30:00Z"]', 0.5),
    
    ('money', 'Currency/Money', 'Monetary values',
     ARRAY['price', 'cost', 'amount', 'total', 'fee', 'salary', 'budget']::TEXT[],
     '["$1,234.56", "10000", "25.99"]', 1.0),
    
    ('address', 'Address', 'Physical address',
     ARRAY['address', 'street', 'city', 'state', 'zip', 'postal', 'country']::TEXT[],
     '["123 Main St", "New York, NY 10001"]', 0.8),
    
    ('id', 'Identifier', 'Unique identifier or code',
     ARRAY['^id$', '_id$', 'code', 'number', 'uuid']::TEXT[],
     '["ABC-12345", "stu_001", "uuid-xxx"]', 0.3),
    
    ('url', 'URL/Link', 'Web address or link',
     ARRAY['url', 'link', 'website', 'href']::TEXT[],
     '["https://example.com", "www.company.org"]', 0.5),
    
    ('boolean', 'Yes/No', 'Boolean or checkbox value',
     ARRAY['is_', 'has_', 'can_', 'enable', 'active', 'visible']::TEXT[],
     '["true", "false", "yes", "no"]', 0.3),
    
    ('score', 'Score/Rating', 'Numeric score or rating',
     ARRAY['score', 'rating', 'grade', 'points', 'rank']::TEXT[],
     '["4.5", "85", "A+"]', 1.2),
    
    ('description', 'Description/Text', 'Long-form text content',
     ARRAY['description', 'bio', 'about', 'notes', 'comment', 'summary']::TEXT[],
     '["Lorem ipsum...", "This is a detailed description..."]', 1.5)
ON CONFLICT (id) DO UPDATE SET
    patterns = EXCLUDED.patterns,
    sample_values = EXCLUDED.sample_values,
    embedding_weight = EXCLUDED.embedding_weight;

-- Function to auto-detect semantic type from field name
CREATE OR REPLACE FUNCTION detect_semantic_type(p_field_name TEXT)
RETURNS TEXT AS $$
DECLARE
    v_type RECORD;
    v_pattern TEXT;
BEGIN
    FOR v_type IN SELECT * FROM semantic_field_types
    LOOP
        FOREACH v_pattern IN ARRAY v_type.patterns
        LOOP
            IF LOWER(p_field_name) ~ v_pattern THEN
                RETURN v_type.id;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN 'text';  -- Default type
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 10: AUTO-DETECT SEMANTIC TYPES FOR EXISTING FIELDS
-- =====================================================

-- Update existing fields without semantic types
UPDATE table_fields
SET semantic_type = detect_semantic_type(name)
WHERE semantic_type IS NULL;

-- Trigger to auto-detect on new fields
CREATE OR REPLACE FUNCTION auto_detect_semantic_type()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.semantic_type IS NULL THEN
        NEW.semantic_type := detect_semantic_type(NEW.name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_semantic_type ON table_fields;
CREATE TRIGGER trigger_auto_semantic_type
    BEFORE INSERT ON table_fields
    FOR EACH ROW
    EXECUTE FUNCTION auto_detect_semantic_type();

-- =====================================================
-- PHASE 11: RLS POLICIES
-- =====================================================

ALTER TABLE embedding_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_field_types ENABLE ROW LEVEL SECURITY;

-- Embedding queue - service access only (authenticated via service role)
CREATE POLICY "Service can manage embedding queue" ON embedding_queue
    FOR ALL USING (auth.role() = 'service_role');

-- Semantic field types are public read
CREATE POLICY "Anyone can view semantic field types" ON semantic_field_types
    FOR SELECT USING (TRUE);

-- =====================================================
-- PHASE 12: COMMENTS
-- =====================================================

COMMENT ON TABLE embedding_queue IS 'Queue for async embedding generation by external service';
COMMENT ON TABLE semantic_field_types IS 'Registry of semantic field types for AI detection';
COMMENT ON FUNCTION semantic_search IS 'Pure vector similarity search using embeddings';
COMMENT ON FUNCTION hybrid_search IS 'Combined keyword + semantic search with configurable weights';
COMMENT ON FUNCTION find_similar IS 'Find items similar to a given entity using embeddings';
COMMENT ON FUNCTION update_embeddings IS 'Batch update embeddings from external service';
COMMENT ON FUNCTION detect_semantic_type IS 'Auto-detect semantic type from field name patterns';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check pgvector is installed
-- SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check embedding coverage
-- SELECT * FROM embedding_stats;

-- Check pending embeddings
-- SELECT * FROM embedding_queue WHERE status = 'pending' ORDER BY priority DESC LIMIT 10;

-- Test semantic search (requires pre-computed embedding)
-- SELECT * FROM semantic_search('workspace-uuid', '[0.1, 0.2, ...]'::vector);

-- Test hybrid search
-- SELECT * FROM hybrid_search('workspace-uuid', 'search query', '[0.1, 0.2, ...]'::vector);

-- Find similar items
-- SELECT * FROM find_similar('entity-uuid', 'row');

-- Check semantic field type detection
-- SELECT detect_semantic_type('first_name');  -- Should return 'name'
-- SELECT detect_semantic_type('email_address');  -- Should return 'email'
