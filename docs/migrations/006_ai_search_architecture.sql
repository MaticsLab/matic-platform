-- =====================================================
-- MIGRATION 006: AI-OPTIMIZED SEARCH ARCHITECTURE
-- =====================================================
-- This migration adds features to make data easily retrievable
-- and distinguishable by AI search models.
--
-- Key Improvements:
-- 1. Full-text search with tsvector columns
-- 2. Entity type classification for rows
-- 3. Semantic labels and descriptions
-- 4. Materialized search index
-- 5. Search analytics for learning
-- 6. Standardized metadata schema
-- =====================================================

-- =====================================================
-- PHASE 1: ENABLE REQUIRED EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For fuzzy/similarity search
CREATE EXTENSION IF NOT EXISTS unaccent; -- For accent-insensitive search

-- =====================================================
-- PHASE 2: ENTITY TYPE SYSTEM
-- =====================================================
-- Classify rows by what they represent (person, event, document, etc.)
-- This helps AI understand the semantic meaning of data.

-- Entity type registry (what kinds of things can rows represent?)
CREATE TABLE IF NOT EXISTS entity_types (
    id TEXT PRIMARY KEY,  -- 'person', 'event', 'application', 'document', 'product', 'organization'
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    
    -- Schema hints for AI
    expected_fields JSONB DEFAULT '[]',  -- Fields typically found in this entity type
    display_template TEXT,               -- How to format for display: "{{first_name}} {{last_name}}"
    search_weight REAL DEFAULT 1.0,      -- Boost in search results
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed common entity types
INSERT INTO entity_types (id, name, description, icon, color, expected_fields, display_template, search_weight)
VALUES
    ('person', 'Person', 'Individual people (students, applicants, staff)', 'user', '#3B82F6',
     '["first_name", "last_name", "email", "phone", "date_of_birth"]',
     '{{first_name}} {{last_name}}', 1.2),
    
    ('application', 'Application', 'Submitted applications for review', 'file-text', '#10B981',
     '["applicant_name", "status", "submitted_at", "score"]',
     '{{applicant_name}} - {{status}}', 1.1),
    
    ('event', 'Event', 'Activities, meetings, or scheduled occurrences', 'calendar', '#F59E0B',
     '["name", "date", "time", "location", "attendees"]',
     '{{name}} on {{date}}', 1.0),
    
    ('document', 'Document', 'Files, attachments, or records', 'file', '#6366F1',
     '["title", "file_type", "uploaded_by", "uploaded_at"]',
     '{{title}}', 0.9),
    
    ('organization', 'Organization', 'Companies, schools, or groups', 'building', '#EC4899',
     '["name", "type", "address", "contact_email"]',
     '{{name}}', 1.0),
    
    ('product', 'Product', 'Items, inventory, or offerings', 'package', '#14B8A6',
     '["name", "sku", "price", "quantity"]',
     '{{name}} ({{sku}})', 0.8),
    
    ('task', 'Task', 'To-do items or action items', 'check-square', '#8B5CF6',
     '["title", "status", "due_date", "assigned_to"]',
     '{{title}}', 0.9),
    
    ('generic', 'Generic', 'Unclassified data rows', 'database', '#64748B',
     '[]', '{{id}}', 0.5)
ON CONFLICT (id) DO NOTHING;

-- Add entity_type to data_tables (what type of entities does this table hold?)
ALTER TABLE data_tables 
ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'generic' REFERENCES entity_types(id);

COMMENT ON COLUMN data_tables.entity_type IS 
'The type of entity stored in this table (person, event, application, etc.). Helps AI understand semantic meaning.';

-- =====================================================
-- PHASE 3: SEMANTIC COLUMN METADATA
-- =====================================================
-- Add rich metadata to columns so AI knows what data means.

-- Add semantic columns to table_fields
ALTER TABLE table_fields 
ADD COLUMN IF NOT EXISTS semantic_type TEXT,          -- 'name', 'email', 'phone', 'date', 'status', 'score', etc.
ADD COLUMN IF NOT EXISTS is_searchable BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_display_field BOOLEAN DEFAULT FALSE,  -- Primary display column
ADD COLUMN IF NOT EXISTS search_weight REAL DEFAULT 1.0,          -- Higher = more important in search
ADD COLUMN IF NOT EXISTS sample_values JSONB DEFAULT '[]';        -- For AI context: ["John", "Jane", "Bob"]

COMMENT ON COLUMN table_fields.semantic_type IS 
'Semantic meaning of this column (name, email, status, etc.). Helps AI understand data.';
COMMENT ON COLUMN table_fields.is_display_field IS 
'If true, this is the primary field to display when showing this row.';
COMMENT ON COLUMN table_fields.search_weight IS 
'Search ranking weight (1.0 = normal, 2.0 = double importance).';

-- Index for searchable fields
CREATE INDEX IF NOT EXISTS idx_table_fields_searchable 
ON table_fields(table_id, is_searchable) WHERE is_searchable = TRUE;

-- =====================================================
-- PHASE 4: FULL-TEXT SEARCH INFRASTRUCTURE
-- =====================================================
-- Add tsvector columns for efficient full-text search.

-- Add search vector to data_tables (for table names/descriptions)
ALTER TABLE data_tables 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_data_tables_search_vector 
ON data_tables USING GIN(search_vector);

-- Trigger to auto-update search vector
CREATE OR REPLACE FUNCTION update_data_tables_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.hub_type, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.entity_type, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_data_tables_search_vector ON data_tables;
CREATE TRIGGER trigger_data_tables_search_vector
    BEFORE INSERT OR UPDATE OF name, description, hub_type, entity_type
    ON data_tables
    FOR EACH ROW
    EXECUTE FUNCTION update_data_tables_search_vector();

-- Update existing data_tables
UPDATE data_tables SET search_vector = 
    setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(hub_type, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(entity_type, '')), 'C');

-- =====================================================
-- PHASE 5: ROW SEARCH INDEX (DENORMALIZED)
-- =====================================================
-- Create a denormalized search index for fast row searching.
-- This flattens JSONB data into searchable text.

CREATE TABLE IF NOT EXISTS search_index (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Source reference
    entity_id UUID NOT NULL,                    -- ID of the source row/table/etc
    entity_type TEXT NOT NULL,                  -- 'row', 'table', 'workspace', 'form'
    table_id UUID REFERENCES data_tables(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Searchable content
    title TEXT NOT NULL,                        -- Primary display text
    subtitle TEXT,                              -- Secondary text
    content TEXT,                               -- Full searchable content
    search_vector tsvector,                     -- Full-text search vector
    
    -- Classification
    hub_type TEXT,                              -- activities, applications, data
    data_entity_type TEXT,                      -- person, event, application, etc
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],        -- Custom tags for filtering
    
    -- Metadata for filtering/ranking
    status TEXT,                                -- active, archived, draft, etc
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_indexed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ranking signals
    view_count INTEGER DEFAULT 0,
    search_click_count INTEGER DEFAULT 0,
    importance_score REAL DEFAULT 1.0,
    
    -- Source data snapshot (for quick display without JOIN)
    metadata JSONB DEFAULT '{}',
    
    UNIQUE(entity_id, entity_type)
);

-- Indexes for fast searching
CREATE INDEX IF NOT EXISTS idx_search_index_vector ON search_index USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_search_index_workspace ON search_index(workspace_id);
CREATE INDEX IF NOT EXISTS idx_search_index_table ON search_index(table_id);
CREATE INDEX IF NOT EXISTS idx_search_index_type ON search_index(entity_type);
CREATE INDEX IF NOT EXISTS idx_search_index_hub ON search_index(hub_type);
CREATE INDEX IF NOT EXISTS idx_search_index_tags ON search_index USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_search_index_trgm ON search_index USING GIN(title gin_trgm_ops);

COMMENT ON TABLE search_index IS 
'Denormalized search index for fast full-text search across all entities. Updated via triggers.';

-- =====================================================
-- PHASE 6: FUNCTIONS TO INDEX ROW DATA
-- =====================================================

-- Function to extract searchable text from row JSONB data
CREATE OR REPLACE FUNCTION extract_row_searchable_text(
    p_row_data JSONB,
    p_fields JSONB  -- Array of field configs with semantic_type and search_weight
) RETURNS TABLE (
    title TEXT,
    subtitle TEXT,
    content TEXT,
    tags TEXT[]
) AS $$
DECLARE
    v_title TEXT := '';
    v_subtitle TEXT := '';
    v_content TEXT := '';
    v_tags TEXT[] := ARRAY[]::TEXT[];
    v_field RECORD;
    v_value TEXT;
BEGIN
    -- Build content from all fields
    FOR v_field IN 
        SELECT * FROM jsonb_to_recordset(p_fields) AS x(
            id TEXT, name TEXT, label TEXT, semantic_type TEXT, 
            is_display_field BOOLEAN, search_weight REAL
        )
    LOOP
        v_value := p_row_data->>v_field.id;
        
        IF v_value IS NOT NULL AND v_value != '' THEN
            -- Build title from display fields
            IF v_field.is_display_field THEN
                IF v_title = '' THEN
                    v_title := v_value;
                ELSE
                    v_title := v_title || ' ' || v_value;
                END IF;
            END IF;
            
            -- Build subtitle from name/email fields
            IF v_field.semantic_type IN ('email', 'phone', 'status') THEN
                IF v_subtitle = '' THEN
                    v_subtitle := v_value;
                ELSE
                    v_subtitle := v_subtitle || ' • ' || v_value;
                END IF;
            END IF;
            
            -- Add to searchable content
            v_content := v_content || ' ' || v_value;
            
            -- Extract tags from status/type fields
            IF v_field.semantic_type IN ('status', 'type', 'category', 'tag') THEN
                v_tags := array_append(v_tags, LOWER(v_value));
            END IF;
        END IF;
    END LOOP;
    
    -- Default title if none found
    IF v_title = '' THEN
        v_title := 'Untitled';
    END IF;
    
    RETURN QUERY SELECT v_title, v_subtitle, TRIM(v_content), v_tags;
END;
$$ LANGUAGE plpgsql;

-- Function to index a single row
CREATE OR REPLACE FUNCTION index_table_row(p_row_id UUID)
RETURNS void AS $$
DECLARE
    v_row RECORD;
    v_table RECORD;
    v_fields JSONB;
    v_extracted RECORD;
BEGIN
    -- Get row data
    SELECT * INTO v_row FROM table_rows WHERE id = p_row_id;
    IF NOT FOUND THEN RETURN; END IF;
    
    -- Get table metadata
    SELECT * INTO v_table FROM data_tables WHERE id = v_row.table_id;
    IF NOT FOUND THEN RETURN; END IF;
    
    -- Get field configurations as JSONB array
    SELECT jsonb_agg(jsonb_build_object(
        'id', id::TEXT,
        'name', name,
        'label', label,
        'semantic_type', COALESCE(semantic_type, 'text'),
        'is_display_field', COALESCE(is_display_field, FALSE),
        'search_weight', COALESCE(search_weight, 1.0)
    )) INTO v_fields
    FROM table_fields 
    WHERE table_id = v_row.table_id AND is_searchable = TRUE;
    
    -- Extract searchable content
    SELECT * INTO v_extracted 
    FROM extract_row_searchable_text(v_row.data, COALESCE(v_fields, '[]'::JSONB));
    
    -- Upsert into search index
    INSERT INTO search_index (
        entity_id, entity_type, table_id, workspace_id,
        title, subtitle, content, search_vector,
        hub_type, data_entity_type, tags,
        status, created_at, updated_at, metadata
    ) VALUES (
        v_row.id, 'row', v_row.table_id, v_table.workspace_id,
        v_extracted.title, v_extracted.subtitle, v_extracted.content,
        setweight(to_tsvector('english', COALESCE(v_extracted.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(v_extracted.subtitle, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(v_extracted.content, '')), 'C'),
        v_table.hub_type, v_table.entity_type, v_extracted.tags,
        COALESCE(v_row.metadata->>'status', 'active'),
        v_row.created_at, v_row.updated_at,
        jsonb_build_object(
            'table_name', v_table.name,
            'table_slug', v_table.slug,
            'row_position', v_row.position
        )
    )
    ON CONFLICT (entity_id, entity_type) DO UPDATE SET
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        content = EXCLUDED.content,
        search_vector = EXCLUDED.search_vector,
        tags = EXCLUDED.tags,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at,
        last_indexed_at = NOW(),
        metadata = EXCLUDED.metadata;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-index rows on insert/update
CREATE OR REPLACE FUNCTION trigger_index_row()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM index_table_row(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_table_rows_search_index ON table_rows;
CREATE TRIGGER trigger_table_rows_search_index
    AFTER INSERT OR UPDATE ON table_rows
    FOR EACH ROW
    EXECUTE FUNCTION trigger_index_row();

-- Trigger to remove from index on delete
CREATE OR REPLACE FUNCTION trigger_remove_row_index()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM search_index WHERE entity_id = OLD.id AND entity_type = 'row';
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_table_rows_search_index_delete ON table_rows;
CREATE TRIGGER trigger_table_rows_search_index_delete
    BEFORE DELETE ON table_rows
    FOR EACH ROW
    EXECUTE FUNCTION trigger_remove_row_index();

-- =====================================================
-- PHASE 7: SEARCH ANALYTICS & LEARNING
-- =====================================================
-- Track search patterns to improve relevance over time.

CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID,  -- NULL for anonymous/AI queries
    
    -- Query data
    query TEXT NOT NULL,
    query_tokens TEXT[],                     -- Tokenized for pattern analysis
    filters JSONB DEFAULT '{}',              -- Applied filters
    
    -- Results data
    result_count INTEGER,
    clicked_result_id UUID,                  -- Which result was clicked
    clicked_result_type TEXT,
    clicked_result_position INTEGER,         -- Position in results (for ranking)
    
    -- Timing
    search_at TIMESTAMPTZ DEFAULT NOW(),
    click_at TIMESTAMPTZ,
    time_to_click_ms INTEGER,                -- How long until user clicked
    
    -- Source context
    source TEXT DEFAULT 'omnisearch',        -- omnisearch, table_search, command_palette
    session_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_workspace ON search_analytics(workspace_id, search_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics USING GIN(query_tokens);
CREATE INDEX IF NOT EXISTS idx_search_analytics_clicked ON search_analytics(clicked_result_id);

COMMENT ON TABLE search_analytics IS 
'Search query and click analytics for improving search relevance over time.';

-- Function to boost results based on click patterns
CREATE OR REPLACE FUNCTION get_result_boost(p_entity_id UUID, p_workspace_id UUID)
RETURNS REAL AS $$
DECLARE
    v_click_rate REAL;
    v_view_count INTEGER;
    v_click_count INTEGER;
BEGIN
    -- Get click statistics
    SELECT 
        COALESCE(si.view_count, 0),
        COALESCE(si.search_click_count, 0)
    INTO v_view_count, v_click_count
    FROM search_index si
    WHERE si.entity_id = p_entity_id;
    
    -- Calculate boost (log scale to prevent runaway scores)
    IF v_view_count > 0 THEN
        v_click_rate := v_click_count::REAL / v_view_count;
        RETURN 1.0 + (LN(v_click_count + 1) * 0.1) + (v_click_rate * 0.5);
    END IF;
    
    RETURN 1.0;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 8: SMART SEARCH FUNCTION
-- =====================================================
-- Unified search function that uses all the AI-optimized features.

CREATE OR REPLACE FUNCTION smart_search(
    p_workspace_id UUID,
    p_query TEXT,
    p_filters JSONB DEFAULT '{}',
    p_limit INTEGER DEFAULT 50
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
    status TEXT,
    score REAL,
    metadata JSONB
) AS $$
DECLARE
    v_query_tsquery tsquery;
    v_hub_type_filter TEXT;
    v_entity_type_filter TEXT;
    v_status_filter TEXT;
BEGIN
    -- Parse query into tsquery
    v_query_tsquery := plainto_tsquery('english', p_query);
    
    -- Extract filters
    v_hub_type_filter := p_filters->>'hub_type';
    v_entity_type_filter := p_filters->>'entity_type';
    v_status_filter := p_filters->>'status';
    
    RETURN QUERY
    SELECT 
        si.entity_id,
        si.entity_type,
        si.table_id,
        si.title,
        si.subtitle,
        ts_headline('english', si.content, v_query_tsquery, 
            'MaxWords=30, MinWords=15, StartSel=<mark>, StopSel=</mark>') AS content_snippet,
        si.hub_type,
        si.data_entity_type,
        si.tags,
        si.status,
        (
            ts_rank_cd(si.search_vector, v_query_tsquery, 32) *  -- Base rank
            si.importance_score *                                  -- Manual importance
            get_result_boost(si.entity_id, p_workspace_id) *       -- Click-based boost
            CASE 
                WHEN si.entity_type = 'table' THEN 1.5            -- Boost tables
                WHEN si.entity_type = 'form' THEN 1.3             -- Boost forms
                ELSE 1.0
            END *
            similarity(si.title, p_query)                          -- Fuzzy title match
        )::REAL AS score,
        si.metadata
    FROM search_index si
    WHERE 
        si.workspace_id = p_workspace_id
        AND si.search_vector @@ v_query_tsquery
        AND (v_hub_type_filter IS NULL OR si.hub_type = v_hub_type_filter)
        AND (v_entity_type_filter IS NULL OR si.data_entity_type = v_entity_type_filter)
        AND (v_status_filter IS NULL OR si.status = v_status_filter)
    ORDER BY score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Also support fuzzy search when tsquery returns no results
CREATE OR REPLACE FUNCTION smart_search_fuzzy(
    p_workspace_id UUID,
    p_query TEXT,
    p_filters JSONB DEFAULT '{}',
    p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    entity_id UUID,
    entity_type TEXT,
    table_id UUID,
    title TEXT,
    subtitle TEXT,
    hub_type TEXT,
    data_entity_type TEXT,
    tags TEXT[],
    status TEXT,
    score REAL,
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
        si.tags,
        si.status,
        (
            similarity(si.title, p_query) * 2 +
            similarity(COALESCE(si.subtitle, ''), p_query) +
            similarity(COALESCE(si.content, ''), p_query) * 0.5
        )::REAL AS score,
        si.metadata
    FROM search_index si
    WHERE 
        si.workspace_id = p_workspace_id
        AND (
            si.title % p_query 
            OR si.subtitle % p_query 
            OR si.content % p_query
        )
    ORDER BY score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 9: CONTEXTUAL DESCRIPTIONS
-- =====================================================
-- Add structured descriptions to help AI understand entities.

-- Add AI-friendly descriptions to workspaces
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS ai_description TEXT,        -- Natural language description for AI
ADD COLUMN IF NOT EXISTS data_summary JSONB DEFAULT '{}';  -- {"table_count": 5, "row_count": 1234, "last_activity": "..."}

COMMENT ON COLUMN workspaces.ai_description IS 
'Natural language description of what this workspace contains, for AI context.';

-- =====================================================
-- PHASE 10: STANDARDIZED METADATA SCHEMA
-- =====================================================
-- Define consistent metadata structures.

-- Create a table documenting expected metadata fields
CREATE TABLE IF NOT EXISTS metadata_schema (
    id TEXT PRIMARY KEY,
    applies_to TEXT NOT NULL,              -- 'table_rows', 'data_tables', 'table_fields'
    field_name TEXT NOT NULL,
    field_type TEXT NOT NULL,              -- 'string', 'uuid', 'array', 'object', 'number', 'boolean'
    description TEXT,
    example_value JSONB,
    is_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed standard metadata fields
INSERT INTO metadata_schema (id, applies_to, field_name, field_type, description, example_value)
VALUES
    -- Table row metadata
    ('row_status', 'table_rows', 'status', 'string', 'Row status (active, archived, draft)', '"active"'),
    ('row_workflow', 'table_rows', 'assigned_workflow_id', 'uuid', 'ID of assigned review workflow', '"uuid-here"'),
    ('row_stage', 'table_rows', 'current_stage_id', 'uuid', 'Current workflow stage', '"uuid-here"'),
    ('row_reviewers', 'table_rows', 'assigned_reviewer_ids', 'array', 'Array of assigned reviewer UUIDs', '["uuid1", "uuid2"]'),
    ('row_scores', 'table_rows', 'review_scores', 'array', 'Array of review score objects', '[]'),
    ('row_tags', 'table_rows', 'custom_tags', 'array', 'User-defined tags', '["priority", "scholarship"]'),
    ('row_source', 'table_rows', 'source', 'string', 'How this row was created', '"form_submission"'),
    
    -- Table field metadata  
    ('field_hint', 'table_fields', 'hint', 'string', 'Help text for field', '"Enter your email address"'),
    ('field_placeholder', 'table_fields', 'placeholder', 'string', 'Placeholder text', '"john@example.com"'),
    ('field_validation', 'table_fields', 'validation', 'object', 'Validation rules', '{"required": true, "pattern": "email"}'),
    ('field_options', 'table_fields', 'options', 'array', 'Options for select fields', '[{"label": "Yes", "value": "yes"}]'),
    
    -- Data table metadata
    ('table_icon', 'data_tables', 'icon', 'string', 'Display icon', '"users"'),
    ('table_color', 'data_tables', 'color', 'string', 'Theme color hex', '"#3B82F6"'),
    ('table_template', 'data_tables', 'template_id', 'string', 'Template this was created from', '"scholarship_app"')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PHASE 11: HELPER FUNCTIONS FOR AI
-- =====================================================

-- Get table schema in AI-friendly format
CREATE OR REPLACE FUNCTION get_table_schema_for_ai(p_table_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'table_id', dt.id,
        'table_name', dt.name,
        'description', dt.description,
        'hub_type', dt.hub_type,
        'entity_type', dt.entity_type,
        'row_count', dt.row_count,
        'fields', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', tf.id,
                'name', tf.name,
                'label', tf.label,
                'type', tf.type,
                'semantic_type', tf.semantic_type,
                'is_display_field', tf.is_display_field,
                'is_searchable', tf.is_searchable,
                'sample_values', tf.sample_values
            ) ORDER BY tf.position)
            FROM table_fields tf
            WHERE tf.table_id = dt.id
        )
    ) INTO v_result
    FROM data_tables dt
    WHERE dt.id = p_table_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Get workspace summary for AI context
CREATE OR REPLACE FUNCTION get_workspace_summary_for_ai(p_workspace_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'workspace_id', w.id,
        'workspace_name', w.name,
        'description', w.description,
        'ai_description', w.ai_description,
        'tables', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', dt.id,
                'name', dt.name,
                'hub_type', dt.hub_type,
                'entity_type', dt.entity_type,
                'row_count', dt.row_count,
                'description', dt.description
            ))
            FROM data_tables dt
            WHERE dt.workspace_id = w.id AND NOT dt.is_archived
        ),
        'statistics', jsonb_build_object(
            'table_count', (SELECT COUNT(*) FROM data_tables WHERE workspace_id = w.id),
            'total_rows', (
                SELECT COALESCE(SUM(row_count), 0) 
                FROM data_tables WHERE workspace_id = w.id
            )
        )
    ) INTO v_result
    FROM workspaces w
    WHERE w.id = p_workspace_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 12: RE-INDEX EXISTING DATA
-- =====================================================

-- Function to rebuild entire search index
CREATE OR REPLACE FUNCTION rebuild_search_index(p_workspace_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_row RECORD;
BEGIN
    -- Index all tables
    FOR v_row IN 
        SELECT dt.id, dt.name, dt.description, dt.hub_type, dt.entity_type, dt.workspace_id
        FROM data_tables dt
        WHERE (p_workspace_id IS NULL OR dt.workspace_id = p_workspace_id)
    LOOP
        INSERT INTO search_index (
            entity_id, entity_type, table_id, workspace_id,
            title, subtitle, content, search_vector,
            hub_type, data_entity_type, status, metadata
        ) VALUES (
            v_row.id, 'table', v_row.id, v_row.workspace_id,
            v_row.name, v_row.description, v_row.name || ' ' || COALESCE(v_row.description, ''),
            setweight(to_tsvector('english', COALESCE(v_row.name, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(v_row.description, '')), 'B'),
            v_row.hub_type, v_row.entity_type, 'active',
            '{}'::JSONB
        )
        ON CONFLICT (entity_id, entity_type) DO UPDATE SET
            title = EXCLUDED.title,
            subtitle = EXCLUDED.subtitle,
            content = EXCLUDED.content,
            search_vector = EXCLUDED.search_vector,
            last_indexed_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    -- Index all rows
    FOR v_row IN
        SELECT tr.id
        FROM table_rows tr
        JOIN data_tables dt ON tr.table_id = dt.id
        WHERE (p_workspace_id IS NULL OR dt.workspace_id = p_workspace_id)
    LOOP
        PERFORM index_table_row(v_row.id);
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 13: RLS POLICIES
-- =====================================================

ALTER TABLE search_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata_schema ENABLE ROW LEVEL SECURITY;

-- Search index follows workspace access
CREATE POLICY "Users can search accessible workspaces" ON search_index
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- Search analytics
CREATE POLICY "Users can view their own search analytics" ON search_analytics
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create search analytics" ON search_analytics
    FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Entity types and metadata schema are public read
CREATE POLICY "Anyone can view entity types" ON entity_types FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can view metadata schema" ON metadata_schema FOR SELECT USING (TRUE);

-- =====================================================
-- PHASE 14: REAL-TIME
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE search_index;

-- =====================================================
-- PHASE 15: COMMENTS
-- =====================================================

COMMENT ON TABLE search_index IS 'Denormalized full-text search index for fast AI-powered search';
COMMENT ON TABLE search_analytics IS 'Search query and click analytics for relevance learning';
COMMENT ON TABLE entity_types IS 'Registry of semantic entity types (person, event, etc.)';
COMMENT ON TABLE metadata_schema IS 'Documentation of expected metadata fields for each table';
COMMENT ON FUNCTION smart_search IS 'AI-optimized search with full-text, ranking, and filtering';
COMMENT ON FUNCTION smart_search_fuzzy IS 'Fuzzy search fallback when exact matches fail';
COMMENT ON FUNCTION get_table_schema_for_ai IS 'Returns table schema in AI-friendly JSON format';
COMMENT ON FUNCTION get_workspace_summary_for_ai IS 'Returns workspace overview for AI context';
COMMENT ON FUNCTION rebuild_search_index IS 'Rebuilds the entire search index for a workspace';

-- =====================================================
-- RUN INITIAL INDEX BUILD
-- =====================================================

-- Uncomment to build initial index:
-- SELECT rebuild_search_index();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Test smart search
-- SELECT * FROM smart_search('your-workspace-uuid', 'search term');

-- Check search index stats
-- SELECT entity_type, COUNT(*), AVG(importance_score) FROM search_index GROUP BY entity_type;

-- View entity types
-- SELECT * FROM entity_types;

-- Get AI-friendly table schema
-- SELECT get_table_schema_for_ai('your-table-uuid');
