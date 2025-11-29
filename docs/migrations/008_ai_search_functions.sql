-- AI Search Functions for Matic Platform
-- These functions power the OmniSearch with full-text, fuzzy, and semantic (vector) search
-- Requires: pg_trgm, pgvector extensions

-- ============================================================
-- ENABLE EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- For fuzzy/trigram matching
CREATE EXTENSION IF NOT EXISTS vector;        -- For semantic embeddings (pgvector)

-- ============================================================
-- ENSURE REQUIRED COLUMNS EXIST
-- ============================================================

-- Add search_vector column for full-text search if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'search_index' AND column_name = 'search_vector') THEN
        ALTER TABLE search_index ADD COLUMN search_vector tsvector;
    END IF;
END $$;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_search_index_search_vector 
  ON search_index USING gin (search_vector);

-- Create trigram indexes for fuzzy search
CREATE INDEX IF NOT EXISTS idx_search_index_title_trgm 
  ON search_index USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_search_index_content_trgm 
  ON search_index USING gin (content gin_trgm_ops);

-- ============================================================
-- TRIGGER: AUTO-UPDATE SEARCH VECTOR
-- ============================================================

CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.subtitle, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS search_index_vector_update ON search_index;
CREATE TRIGGER search_index_vector_update
    BEFORE INSERT OR UPDATE OF title, subtitle, content
    ON search_index
    FOR EACH ROW
    EXECUTE FUNCTION update_search_vector();

-- ============================================================
-- FUNCTION: smart_search
-- Full-text search with ranking, click-boosting, and entity weights
-- ============================================================

CREATE OR REPLACE FUNCTION smart_search(
    p_workspace_id UUID,
    p_query TEXT,
    p_filters JSONB DEFAULT '{}',
    p_limit INT DEFAULT 50
)
RETURNS TABLE (
    entity_id UUID,
    entity_type TEXT,
    table_id UUID,
    title TEXT,
    subtitle TEXT,
    content_snippet TEXT,
    hub_type TEXT,
    data_entity_type TEXT,
    tags TEXT[],
    score FLOAT,
    metadata JSONB
) AS $$
DECLARE
    v_tsquery tsquery;
    v_hub_type TEXT;
    v_entity_type TEXT;
    v_table_id UUID;
BEGIN
    -- Build tsquery from search terms
    v_tsquery := plainto_tsquery('english', p_query);
    
    -- Extract filters
    v_hub_type := p_filters->>'hub_type';
    v_entity_type := p_filters->>'entity_type';
    IF p_filters->>'table_id' IS NOT NULL THEN
        v_table_id := (p_filters->>'table_id')::UUID;
    END IF;
    
    RETURN QUERY
    SELECT 
        si.entity_id,
        si.entity_type,
        si.table_id,
        si.title,
        si.subtitle,
        -- Generate content snippet with highlights
        CASE 
            WHEN si.content IS NOT NULL AND si.content != '' THEN
                ts_headline('english', si.content, v_tsquery, 
                    'MaxWords=30, MinWords=15, StartSel=<mark>, StopSel=</mark>')
            ELSE si.subtitle
        END AS content_snippet,
        si.hub_type,
        si.data_entity_type,
        si.tags,
        -- Calculate score with multiple factors
        (
            ts_rank_cd(si.search_vector, v_tsquery, 32) * 10 +          -- Base relevance
            COALESCE(si.importance_score, 1.0) +                        -- Importance score
            (COALESCE(si.search_click_count, 0)::FLOAT / 100) +        -- Click rate boost
            CASE si.data_entity_type
                WHEN 'person' THEN 0.2
                WHEN 'application' THEN 0.1
                ELSE 0
            END +                                                        -- Entity type boost
            CASE 
                WHEN si.title ILIKE '%' || p_query || '%' THEN 2.0     -- Exact title match
                WHEN si.subtitle ILIKE '%' || p_query || '%' THEN 1.0  -- Exact subtitle match
                ELSE 0
            END
        ) AS score,
        si.metadata
    FROM search_index si
    WHERE 
        si.workspace_id = p_workspace_id
        AND si.search_vector @@ v_tsquery
        AND (v_hub_type IS NULL OR si.hub_type = v_hub_type)
        AND (v_entity_type IS NULL OR si.entity_type = v_entity_type)
        AND (v_table_id IS NULL OR si.table_id = v_table_id)
    ORDER BY score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: smart_search_fuzzy
-- Fallback fuzzy search using trigram similarity
-- ============================================================

CREATE OR REPLACE FUNCTION smart_search_fuzzy(
    p_workspace_id UUID,
    p_query TEXT,
    p_filters JSONB DEFAULT '{}',
    p_limit INT DEFAULT 50
)
RETURNS TABLE (
    entity_id UUID,
    entity_type TEXT,
    table_id UUID,
    title TEXT,
    subtitle TEXT,
    content_snippet TEXT,
    hub_type TEXT,
    data_entity_type TEXT,
    tags TEXT[],
    score FLOAT,
    metadata JSONB
) AS $$
DECLARE
    v_hub_type TEXT;
    v_entity_type TEXT;
    v_table_id UUID;
BEGIN
    -- Extract filters
    v_hub_type := p_filters->>'hub_type';
    v_entity_type := p_filters->>'entity_type';
    IF p_filters->>'table_id' IS NOT NULL THEN
        v_table_id := (p_filters->>'table_id')::UUID;
    END IF;
    
    RETURN QUERY
    SELECT 
        si.entity_id,
        si.entity_type,
        si.table_id,
        si.title,
        si.subtitle,
        LEFT(COALESCE(si.content, si.subtitle), 200) AS content_snippet,
        si.hub_type,
        si.data_entity_type,
        si.tags,
        -- Trigram similarity score
        (
            GREATEST(
                similarity(si.title, p_query),
                similarity(COALESCE(si.subtitle, ''), p_query) * 0.8,
                similarity(COALESCE(si.content, ''), p_query) * 0.6
            ) * 10 +
            COALESCE(si.importance_score, 1.0)
        ) AS score,
        si.metadata
    FROM search_index si
    WHERE 
        si.workspace_id = p_workspace_id
        AND (
            si.title % p_query OR
            si.subtitle % p_query OR
            si.content % p_query
        )
        AND (v_hub_type IS NULL OR si.hub_type = v_hub_type)
        AND (v_entity_type IS NULL OR si.entity_type = v_entity_type)
        AND (v_table_id IS NULL OR si.table_id = v_table_id)
    ORDER BY score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: hybrid_search
-- Combines keyword (full-text) + semantic (vector) search
-- ============================================================

CREATE OR REPLACE FUNCTION hybrid_search(
    p_workspace_id UUID,
    p_query TEXT,
    p_query_embedding vector(1536),
    p_filters JSONB DEFAULT '{}',
    p_limit INT DEFAULT 50,
    p_keyword_weight FLOAT DEFAULT 0.4,
    p_semantic_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
    entity_id UUID,
    entity_type TEXT,
    table_id UUID,
    title TEXT,
    subtitle TEXT,
    content_snippet TEXT,
    hub_type TEXT,
    data_entity_type TEXT,
    tags TEXT[],
    keyword_score FLOAT,
    semantic_score FLOAT,
    score FLOAT,
    metadata JSONB
) AS $$
DECLARE
    v_tsquery tsquery;
    v_hub_type TEXT;
    v_entity_type TEXT;
    v_table_id UUID;
    v_exclude_pii BOOLEAN;
BEGIN
    -- Build tsquery from search terms
    v_tsquery := plainto_tsquery('english', p_query);
    
    -- Extract filters
    v_hub_type := p_filters->>'hub_type';
    v_entity_type := p_filters->>'entity_type';
    v_exclude_pii := COALESCE((p_filters->>'exclude_pii')::BOOLEAN, false);
    IF p_filters->>'table_id' IS NOT NULL THEN
        v_table_id := (p_filters->>'table_id')::UUID;
    END IF;
    
    RETURN QUERY
    SELECT 
        si.entity_id,
        si.entity_type,
        si.table_id,
        si.title,
        si.subtitle,
        -- Generate content snippet with highlights
        CASE 
            WHEN si.content IS NOT NULL AND si.content != '' THEN
                ts_headline('english', si.content, v_tsquery, 
                    'MaxWords=30, MinWords=15, StartSel=<mark>, StopSel=</mark>')
            ELSE si.subtitle
        END AS content_snippet,
        si.hub_type,
        si.data_entity_type,
        si.tags,
        -- Keyword score (normalized to 0-1)
        COALESCE(ts_rank_cd(si.search_vector, v_tsquery, 32), 0) AS keyword_score,
        -- Semantic score (cosine similarity, already 0-1)
        CASE 
            WHEN si.embedding IS NOT NULL THEN
                1 - (si.embedding <=> p_query_embedding)
            ELSE 0
        END AS semantic_score,
        -- Combined score
        (
            (COALESCE(ts_rank_cd(si.search_vector, v_tsquery, 32), 0) * p_keyword_weight) +
            (CASE 
                WHEN si.embedding IS NOT NULL THEN
                    (1 - (si.embedding <=> p_query_embedding)) * p_semantic_weight
                ELSE 0
            END) +
            (COALESCE(si.importance_score, 1.0) * 0.1) +
            (COALESCE(si.search_click_count, 0)::FLOAT / 1000)
        ) AS score,
        si.metadata
    FROM search_index si
    WHERE 
        si.workspace_id = p_workspace_id
        AND (
            si.search_vector @@ v_tsquery
            OR (si.embedding IS NOT NULL AND (1 - (si.embedding <=> p_query_embedding)) > 0.5)
        )
        AND (v_hub_type IS NULL OR si.hub_type = v_hub_type)
        AND (v_entity_type IS NULL OR si.entity_type = v_entity_type)
        AND (v_table_id IS NULL OR si.table_id = v_table_id)
        -- Exclude PII fields if requested (filter based on indexed_fields metadata)
        AND (
            NOT v_exclude_pii 
            OR NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(si.indexed_fields) AS f
                WHERE f->>'semantic_type' IN ('email', 'phone', 'ssn', 'address')
            )
        )
    ORDER BY score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: find_similar
-- Find similar items using vector embeddings
-- ============================================================

CREATE OR REPLACE FUNCTION find_similar(
    p_entity_id UUID,
    p_entity_type TEXT,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    entity_id UUID,
    entity_type TEXT,
    table_id UUID,
    title TEXT,
    subtitle TEXT,
    similarity FLOAT,
    metadata JSONB
) AS $$
DECLARE
    v_source_embedding vector(1536);
    v_workspace_id UUID;
BEGIN
    -- Get the source item's embedding
    SELECT si.embedding, si.workspace_id 
    INTO v_source_embedding, v_workspace_id
    FROM search_index si
    WHERE si.entity_id = p_entity_id AND si.entity_type = p_entity_type;
    
    IF v_source_embedding IS NULL THEN
        RETURN; -- No embedding found for source item
    END IF;
    
    RETURN QUERY
    SELECT 
        si.entity_id,
        si.entity_type,
        si.table_id,
        si.title,
        si.subtitle,
        -- Cosine similarity (1 - distance)
        1 - (si.embedding <=> v_source_embedding) AS similarity,
        si.metadata
    FROM search_index si
    WHERE 
        si.workspace_id = v_workspace_id
        AND si.embedding IS NOT NULL
        AND si.entity_id != p_entity_id  -- Exclude source item
    ORDER BY si.embedding <=> v_source_embedding ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: get_table_schema_for_ai
-- Returns table structure in AI-friendly JSON format
-- ============================================================

CREATE OR REPLACE FUNCTION get_table_schema_for_ai(p_table_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'table_id', dt.id,
        'table_name', dt.name,
        'entity_type', dt.entity_type,
        'description', dt.description,
        'fields', COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'name', tf.name,
                    'label', tf.label,
                    'type', tf.type,
                    'semantic_type', tf.semantic_type,
                    'is_searchable', tf.is_searchable,
                    'is_display_field', tf.is_display_field,
                    'search_weight', tf.search_weight,
                    'sample_values', tf.sample_values
                ) ORDER BY tf.position
            )
            FROM table_fields tf
            WHERE tf.table_id = dt.id),
            '[]'::JSONB
        ),
        'row_count', (SELECT COUNT(*) FROM table_rows tr WHERE tr.table_id = dt.id)
    )
    INTO v_result
    FROM data_tables dt
    WHERE dt.id = p_table_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: get_workspace_summary_for_ai
-- Returns workspace context for AI prompts
-- ============================================================

CREATE OR REPLACE FUNCTION get_workspace_summary_for_ai(p_workspace_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'workspace_id', w.id,
        'workspace_name', w.name,
        'ai_description', w.ai_description,
        'tables', COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'id', dt.id,
                    'name', dt.name,
                    'entity_type', dt.entity_type,
                    'row_count', (SELECT COUNT(*) FROM table_rows tr WHERE tr.table_id = dt.id)
                )
            )
            FROM data_tables dt
            WHERE dt.workspace_id = w.id),
            '[]'::JSONB
        ),
        'statistics', jsonb_build_object(
            'table_count', (SELECT COUNT(*) FROM data_tables dt WHERE dt.workspace_id = w.id),
            'total_rows', (SELECT SUM(cnt) FROM (SELECT COUNT(*) as cnt FROM table_rows tr JOIN data_tables dt ON tr.table_id = dt.id WHERE dt.workspace_id = w.id) sub),
            'total_forms', (SELECT COUNT(*) FROM forms f WHERE f.workspace_id = w.id)
        )
    )
    INTO v_result
    FROM workspaces w
    WHERE w.id = p_workspace_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: rebuild_search_index
-- Rebuilds the search index for a workspace or all workspaces
-- ============================================================

CREATE OR REPLACE FUNCTION rebuild_search_index(p_workspace_id UUID DEFAULT NULL)
RETURNS INT AS $$
DECLARE
    v_count INT := 0;
    v_row RECORD;
BEGIN
    -- Index all table rows
    FOR v_row IN 
        SELECT 
            tr.id AS entity_id,
            'row' AS entity_type,
            tr.table_id,
            dt.workspace_id,
            COALESCE(
                (SELECT tr.data->>tf.name 
                 FROM table_fields tf 
                 WHERE tf.table_id = tr.table_id AND tf.is_display_field = true 
                 LIMIT 1),
                'Row ' || tr.id::TEXT
            ) AS title,
            dt.name AS subtitle,
            LEFT(tr.data::TEXT, 1000) AS content,
            COALESCE(dt.hub_type, 'data') AS hub_type,
            dt.entity_type AS data_entity_type,
            ARRAY[]::TEXT[] AS tags,
            tr.data AS metadata
        FROM table_rows tr
        JOIN data_tables dt ON tr.table_id = dt.id
        WHERE p_workspace_id IS NULL OR dt.workspace_id = p_workspace_id
    LOOP
        INSERT INTO search_index (
            entity_id, entity_type, table_id, workspace_id, 
            title, subtitle, content, hub_type, data_entity_type, 
            tags, metadata, last_indexed_at
        )
        VALUES (
            v_row.entity_id, v_row.entity_type, v_row.table_id, v_row.workspace_id,
            v_row.title, v_row.subtitle, v_row.content, v_row.hub_type, v_row.data_entity_type,
            v_row.tags, v_row.metadata, NOW()
        )
        ON CONFLICT (entity_id, entity_type) DO UPDATE SET
            title = EXCLUDED.title,
            subtitle = EXCLUDED.subtitle,
            content = EXCLUDED.content,
            hub_type = EXCLUDED.hub_type,
            data_entity_type = EXCLUDED.data_entity_type,
            metadata = EXCLUDED.metadata,
            last_indexed_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    -- Index all tables
    FOR v_row IN
        SELECT 
            dt.id AS entity_id,
            'table' AS entity_type,
            dt.id AS table_id,
            dt.workspace_id,
            dt.name AS title,
            dt.description AS subtitle,
            '' AS content,
            COALESCE(dt.hub_type, 'data') AS hub_type,
            dt.entity_type AS data_entity_type,
            ARRAY[]::TEXT[] AS tags,
            '{}'::JSONB AS metadata
        FROM data_tables dt
        WHERE p_workspace_id IS NULL OR dt.workspace_id = p_workspace_id
    LOOP
        INSERT INTO search_index (
            entity_id, entity_type, table_id, workspace_id,
            title, subtitle, content, hub_type, data_entity_type,
            tags, metadata, last_indexed_at
        )
        VALUES (
            v_row.entity_id, v_row.entity_type, v_row.table_id, v_row.workspace_id,
            v_row.title, v_row.subtitle, v_row.content, v_row.hub_type, v_row.data_entity_type,
            v_row.tags, v_row.metadata, NOW()
        )
        ON CONFLICT (entity_id, entity_type) DO UPDATE SET
            title = EXCLUDED.title,
            subtitle = EXCLUDED.subtitle,
            content = EXCLUDED.content,
            last_indexed_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    -- Index all forms
    FOR v_row IN
        SELECT 
            f.id AS entity_id,
            'form' AS entity_type,
            f.table_id,
            f.workspace_id,
            f.name AS title,
            f.description AS subtitle,
            '' AS content,
            'forms' AS hub_type,
            'form' AS data_entity_type,
            ARRAY[]::TEXT[] AS tags,
            '{}'::JSONB AS metadata
        FROM forms f
        WHERE p_workspace_id IS NULL OR f.workspace_id = p_workspace_id
    LOOP
        INSERT INTO search_index (
            entity_id, entity_type, table_id, workspace_id,
            title, subtitle, content, hub_type, data_entity_type,
            tags, metadata, last_indexed_at
        )
        VALUES (
            v_row.entity_id, v_row.entity_type, v_row.table_id, v_row.workspace_id,
            v_row.title, v_row.subtitle, v_row.content, v_row.hub_type, v_row.data_entity_type,
            v_row.tags, v_row.metadata, NOW()
        )
        ON CONFLICT (entity_id, entity_type) DO UPDATE SET
            title = EXCLUDED.title,
            subtitle = EXCLUDED.subtitle,
            content = EXCLUDED.content,
            last_indexed_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: queue_for_embedding
-- Queue an entity for embedding generation
-- ============================================================

CREATE OR REPLACE FUNCTION queue_for_embedding(
    p_entity_id UUID,
    p_entity_type TEXT,
    p_priority INT DEFAULT 5
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO embedding_queue (entity_id, entity_type, priority, status)
    VALUES (p_entity_id, p_entity_type, p_priority, 'pending')
    ON CONFLICT (entity_id, entity_type) DO UPDATE SET
        priority = GREATEST(embedding_queue.priority, EXCLUDED.priority),
        status = 'pending',
        created_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER: Auto-queue new rows for embedding
-- ============================================================

CREATE OR REPLACE FUNCTION auto_queue_row_for_embedding()
RETURNS TRIGGER AS $$
BEGIN
    -- Queue for search index
    INSERT INTO search_index (
        entity_id, entity_type, table_id, workspace_id,
        title, subtitle, content, last_indexed_at
    )
    SELECT 
        NEW.id,
        'row',
        NEW.table_id,
        dt.workspace_id,
        COALESCE(
            (SELECT NEW.data->>tf.name 
             FROM table_fields tf 
             WHERE tf.table_id = NEW.table_id AND tf.is_display_field = true 
             LIMIT 1),
            'Row ' || NEW.id::TEXT
        ),
        dt.name,
        LEFT(NEW.data::TEXT, 1000),
        NOW()
    FROM data_tables dt
    WHERE dt.id = NEW.table_id
    ON CONFLICT (entity_id, entity_type) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        last_indexed_at = NOW();
    
    -- Queue for embedding generation
    PERFORM queue_for_embedding(NEW.id, 'row', 5);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_index_row ON table_rows;
CREATE TRIGGER auto_index_row
    AFTER INSERT OR UPDATE ON table_rows
    FOR EACH ROW
    EXECUTE FUNCTION auto_queue_row_for_embedding();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON FUNCTION smart_search IS 'AI-optimized full-text search with ranking, click-boosting, and entity weights';
COMMENT ON FUNCTION smart_search_fuzzy IS 'Fallback fuzzy search using trigram similarity for typos';
COMMENT ON FUNCTION hybrid_search IS 'Combined keyword + semantic (vector) search for best results';
COMMENT ON FUNCTION find_similar IS 'Find similar items using vector embeddings';
COMMENT ON FUNCTION get_table_schema_for_ai IS 'Returns table structure in AI-friendly JSON format';
COMMENT ON FUNCTION get_workspace_summary_for_ai IS 'Returns workspace context for AI prompts';
COMMENT ON FUNCTION rebuild_search_index IS 'Rebuilds the search index for a workspace or all workspaces';
COMMENT ON FUNCTION queue_for_embedding IS 'Queue an entity for embedding generation';
