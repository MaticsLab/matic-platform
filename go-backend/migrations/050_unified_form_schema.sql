-- ============================================
-- MIGRATION 050: UNIFIED FORM SCHEMA
-- Phase 1: Create new tables (non-breaking)
-- ============================================
-- This migration creates a normalized form schema that:
-- 1. Links directly to ba_users (Better Auth) using TEXT id
-- 2. Stores responses in typed columns (not JSONB blobs)
-- 3. Tracks field-level history
-- 4. Supports multi-form submissions per user
-- ============================================

-- 1. FORMS TABLE (new normalized form definitions)
-- ============================================
CREATE TABLE IF NOT EXISTS forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Link to legacy data_tables if migrated
    legacy_table_id UUID REFERENCES data_tables(id) ON DELETE SET NULL,
    
    -- Basic info
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    
    -- Form settings (branding, behavior)
    settings JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'closed')),
    published_at TIMESTAMPTZ,
    closes_at TIMESTAMPTZ,
    
    -- Limits
    max_submissions INTEGER,
    allow_multiple_submissions BOOLEAN DEFAULT false,
    require_auth BOOLEAN DEFAULT true,
    
    -- Versioning
    version INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT REFERENCES ba_users(id) ON DELETE SET NULL,
    
    UNIQUE(workspace_id, slug)
);

-- 2. FORM SECTIONS TABLE (logical grouping of fields)
-- ============================================
CREATE TABLE IF NOT EXISTS form_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    
    -- Section info
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    
    -- Conditional visibility
    conditions JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FORM FIELDS TABLE (individual questions)
-- ============================================
CREATE TABLE IF NOT EXISTS form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    section_id UUID REFERENCES form_sections(id) ON DELETE SET NULL,
    
    -- Link to legacy table_fields if migrated
    legacy_field_id UUID REFERENCES table_fields(id) ON DELETE SET NULL,
    
    -- Field identification
    field_key TEXT NOT NULL,
    
    -- Field definition
    field_type TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    placeholder TEXT,
    
    -- Validation
    required BOOLEAN DEFAULT false,
    validation JSONB DEFAULT '{}'::jsonb,
    
    -- Options (for select, radio, checkbox)
    options JSONB DEFAULT '[]'::jsonb,
    
    -- Conditional logic
    conditions JSONB DEFAULT '[]'::jsonb,
    
    -- Display
    sort_order INTEGER DEFAULT 0,
    width TEXT DEFAULT 'full',
    
    -- Versioning
    version INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(form_id, field_key)
);

-- 4. FORM SUBMISSIONS TABLE (one per user per form)
-- ============================================
CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES ba_users(id) ON DELETE CASCADE,
    
    -- Link to legacy table_rows if migrated
    legacy_row_id UUID REFERENCES table_rows(id) ON DELETE SET NULL,
    
    -- Submission metadata
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'submitted', 'under_review', 'accepted', 'rejected', 'withdrawn')),
    
    -- Progress tracking
    current_section_id UUID REFERENCES form_sections(id) ON DELETE SET NULL,
    completion_percentage INTEGER DEFAULT 0,
    
    -- Important timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_saved_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    
    -- Form version at time of submission
    form_version INTEGER DEFAULT 1,
    
    -- Review workflow integration
    workflow_id UUID,
    current_stage_id UUID,
    assigned_reviewer_id TEXT REFERENCES ba_users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint for single submission per user (can be dropped if allow_multiple)
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_submissions_unique_user 
ON form_submissions(form_id, user_id) 
WHERE status != 'withdrawn';

-- 5. FORM RESPONSES TABLE (individual field values - normalized)
-- ============================================
CREATE TABLE IF NOT EXISTS form_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,
    
    -- The actual value (stored by type for efficient querying)
    value_text TEXT,
    value_number NUMERIC,
    value_boolean BOOLEAN,
    value_date DATE,
    value_datetime TIMESTAMPTZ,
    value_json JSONB,
    
    -- Which value column has the data
    value_type TEXT NOT NULL CHECK (value_type IN ('text', 'number', 'boolean', 'date', 'datetime', 'json')),
    
    -- Validation status
    is_valid BOOLEAN DEFAULT true,
    validation_errors JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(submission_id, field_id)
);

-- 6. FORM RESPONSE HISTORY TABLE (version tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS form_response_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
    
    -- Previous value snapshot
    previous_value_text TEXT,
    previous_value_number NUMERIC,
    previous_value_boolean BOOLEAN,
    previous_value_date DATE,
    previous_value_datetime TIMESTAMPTZ,
    previous_value_json JSONB,
    previous_value_type TEXT,
    
    -- Change metadata
    changed_by TEXT REFERENCES ba_users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    change_reason TEXT
);

-- 7. FORM ATTACHMENTS TABLE (file uploads)
-- ============================================
CREATE TABLE IF NOT EXISTS form_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
    
    -- File info
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    
    -- Storage
    storage_provider TEXT DEFAULT 'supabase',
    storage_path TEXT NOT NULL,
    storage_url TEXT,
    
    -- Metadata
    uploaded_by TEXT REFERENCES ba_users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Security
    is_public BOOLEAN DEFAULT false,
    access_token TEXT
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Form lookups
CREATE INDEX IF NOT EXISTS idx_forms_workspace ON forms(workspace_id);
CREATE INDEX IF NOT EXISTS idx_forms_slug ON forms(slug);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);
CREATE INDEX IF NOT EXISTS idx_forms_legacy ON forms(legacy_table_id) WHERE legacy_table_id IS NOT NULL;

-- Section ordering
CREATE INDEX IF NOT EXISTS idx_form_sections_order ON form_sections(form_id, sort_order);

-- Field lookups
CREATE INDEX IF NOT EXISTS idx_form_fields_form ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_section ON form_fields(section_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_key ON form_fields(form_id, field_key);
CREATE INDEX IF NOT EXISTS idx_form_fields_legacy ON form_fields(legacy_field_id) WHERE legacy_field_id IS NOT NULL;

-- Submission queries (most common)
CREATE INDEX IF NOT EXISTS idx_form_submissions_user ON form_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_user ON form_submissions(form_id, user_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_legacy ON form_submissions(legacy_row_id) WHERE legacy_row_id IS NOT NULL;

-- Response queries (critical for form rendering)
CREATE INDEX IF NOT EXISTS idx_form_responses_submission ON form_responses(submission_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_field ON form_responses(field_id);

-- Value-based queries (for reporting/filtering)
CREATE INDEX IF NOT EXISTS idx_form_responses_text ON form_responses(value_text) WHERE value_type = 'text' AND value_text IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_responses_number ON form_responses(value_number) WHERE value_type = 'number' AND value_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_responses_date ON form_responses(value_date) WHERE value_type = 'date' AND value_date IS NOT NULL;

-- History tracking
CREATE INDEX IF NOT EXISTS idx_form_response_history_response ON form_response_history(response_id);
CREATE INDEX IF NOT EXISTS idx_form_response_history_time ON form_response_history(changed_at);

-- File lookups
CREATE INDEX IF NOT EXISTS idx_form_attachments_response ON form_attachments(response_id);

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View: Full submission with all responses as JSONB (backward compatibility)
CREATE OR REPLACE VIEW form_submissions_full AS
SELECT 
    fs.id,
    fs.form_id,
    fs.user_id,
    fs.legacy_row_id,
    fs.status,
    fs.completion_percentage,
    fs.submitted_at,
    fs.created_at,
    fs.updated_at,
    u.email as user_email,
    u.name as user_name,
    f.name as form_name,
    f.slug as form_slug,
    f.workspace_id,
    COALESCE(
        jsonb_object_agg(
            ff.field_key,
            CASE fr.value_type
                WHEN 'text' THEN to_jsonb(fr.value_text)
                WHEN 'number' THEN to_jsonb(fr.value_number)
                WHEN 'boolean' THEN to_jsonb(fr.value_boolean)
                WHEN 'date' THEN to_jsonb(fr.value_date)
                WHEN 'datetime' THEN to_jsonb(fr.value_datetime)
                WHEN 'json' THEN fr.value_json
            END
        ) FILTER (WHERE ff.field_key IS NOT NULL),
        '{}'::jsonb
    ) as form_data
FROM form_submissions fs
JOIN ba_users u ON fs.user_id = u.id
JOIN forms f ON fs.form_id = f.id
LEFT JOIN form_responses fr ON fr.submission_id = fs.id
LEFT JOIN form_fields ff ON fr.field_id = ff.id
GROUP BY fs.id, fs.form_id, fs.user_id, fs.legacy_row_id, fs.status, fs.completion_percentage, 
         fs.submitted_at, fs.created_at, fs.updated_at, u.email, u.name, f.name, f.slug, f.workspace_id;

-- View: User's submissions across all forms
CREATE OR REPLACE VIEW user_form_submissions AS
SELECT 
    u.id as user_id,
    u.email,
    u.name as user_name,
    f.id as form_id,
    f.name as form_name,
    f.slug as form_slug,
    f.workspace_id,
    fs.id as submission_id,
    fs.status,
    fs.completion_percentage,
    fs.started_at,
    fs.submitted_at,
    fs.last_saved_at
FROM ba_users u
JOIN form_submissions fs ON fs.user_id = u.id
JOIN forms f ON fs.form_id = f.id
ORDER BY u.id, fs.updated_at DESC;

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all new tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['forms', 'form_sections', 'form_fields', 'form_submissions', 'form_responses'])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;
            CREATE TRIGGER update_%s_updated_at
            BEFORE UPDATE ON %s
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END;
$$;

-- ============================================
-- MIGRATION HELPER FUNCTION
-- Converts legacy table_rows to new form_submissions
-- ============================================
CREATE OR REPLACE FUNCTION migrate_legacy_submission(
    p_legacy_row_id UUID,
    p_form_id UUID,
    p_user_id TEXT
) RETURNS UUID AS $$
DECLARE
    v_submission_id UUID;
    v_row RECORD;
    v_field RECORD;
    v_value JSONB;
    v_value_type TEXT;
BEGIN
    -- Get the existing row
    SELECT * INTO v_row FROM table_rows WHERE id = p_legacy_row_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Legacy row not found: %', p_legacy_row_id;
    END IF;
    
    -- Check if already migrated
    SELECT id INTO v_submission_id FROM form_submissions WHERE legacy_row_id = p_legacy_row_id;
    IF FOUND THEN
        RETURN v_submission_id;
    END IF;
    
    -- Determine status from legacy metadata
    DECLARE
        v_status TEXT := 'draft';
        v_submitted_at TIMESTAMPTZ;
    BEGIN
        IF v_row.metadata ? 'status' THEN
            v_status := CASE v_row.metadata->>'status'
                WHEN 'submitted' THEN 'submitted'
                WHEN 'draft' THEN 'draft'
                WHEN 'in_progress' THEN 'in_progress'
                ELSE 'draft'
            END;
        END IF;
        
        IF v_row.metadata ? 'submitted_at' THEN
            v_submitted_at := (v_row.metadata->>'submitted_at')::timestamptz;
        END IF;
        
        -- Create submission
        INSERT INTO form_submissions (
            form_id, user_id, legacy_row_id, status, 
            submitted_at, started_at, last_saved_at, created_at
        )
        VALUES (
            p_form_id, p_user_id, p_legacy_row_id, v_status,
            v_submitted_at, v_row.created_at, v_row.updated_at, v_row.created_at
        )
        RETURNING id INTO v_submission_id;
    END;
    
    -- Migrate each field value
    FOR v_field IN 
        SELECT ff.id as new_field_id, ff.field_key, ff.field_type, tf.id as legacy_field_id
        FROM form_fields ff
        LEFT JOIN table_fields tf ON ff.legacy_field_id = tf.id
        WHERE ff.form_id = p_form_id
    LOOP
        -- Try to get value from legacy data using field_key
        v_value := v_row.data -> v_field.field_key;
        
        -- If not found by key, try legacy field_id
        IF v_value IS NULL AND v_field.legacy_field_id IS NOT NULL THEN
            v_value := v_row.data -> v_field.legacy_field_id::text;
        END IF;
        
        IF v_value IS NOT NULL AND v_value != 'null'::jsonb THEN
            -- Determine value type based on field type
            v_value_type := CASE 
                WHEN v_field.field_type IN ('number', 'currency', 'percentage', 'rating', 'scale') THEN 'number'
                WHEN v_field.field_type IN ('checkbox', 'boolean') THEN 'boolean'
                WHEN v_field.field_type = 'date' THEN 'date'
                WHEN v_field.field_type IN ('datetime', 'time') THEN 'datetime'
                WHEN v_field.field_type IN ('select', 'multiselect', 'file', 'image', 'address', 'name', 'repeater') THEN 'json'
                ELSE 'text'
            END;
            
            INSERT INTO form_responses (
                submission_id, field_id, value_type,
                value_text, value_number, value_boolean, value_date, value_datetime, value_json
            )
            VALUES (
                v_submission_id,
                v_field.new_field_id,
                v_value_type,
                CASE WHEN v_value_type = 'text' THEN v_value #>> '{}' END,
                CASE WHEN v_value_type = 'number' THEN (v_value #>> '{}')::numeric END,
                CASE WHEN v_value_type = 'boolean' THEN (v_value #>> '{}')::boolean END,
                CASE WHEN v_value_type = 'date' THEN (v_value #>> '{}')::date END,
                CASE WHEN v_value_type = 'datetime' THEN (v_value #>> '{}')::timestamptz END,
                CASE WHEN v_value_type = 'json' THEN v_value END
            )
            ON CONFLICT (submission_id, field_id) DO UPDATE SET
                value_text = EXCLUDED.value_text,
                value_number = EXCLUDED.value_number,
                value_boolean = EXCLUDED.value_boolean,
                value_date = EXCLUDED.value_date,
                value_datetime = EXCLUDED.value_datetime,
                value_json = EXCLUDED.value_json,
                value_type = EXCLUDED.value_type,
                updated_at = NOW();
        END IF;
    END LOOP;
    
    -- Calculate completion percentage
    UPDATE form_submissions 
    SET completion_percentage = (
        SELECT ROUND(
            COUNT(fr.id)::numeric / NULLIF(COUNT(ff.id), 0)::numeric * 100
        )
        FROM form_fields ff
        LEFT JOIN form_responses fr ON fr.field_id = ff.id AND fr.submission_id = v_submission_id
        WHERE ff.form_id = p_form_id AND ff.required = true
    )
    WHERE id = v_submission_id;
    
    RETURN v_submission_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Migrate a legacy form (data_table) to new schema
-- ============================================
CREATE OR REPLACE FUNCTION migrate_legacy_form(
    p_table_id UUID
) RETURNS UUID AS $$
DECLARE
    v_form_id UUID;
    v_table RECORD;
    v_field RECORD;
    v_section_id UUID;
BEGIN
    -- Get the legacy table
    SELECT * INTO v_table FROM data_tables WHERE id = p_table_id AND icon = 'form';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Form table not found: %', p_table_id;
    END IF;
    
    -- Check if already migrated
    SELECT id INTO v_form_id FROM forms WHERE legacy_table_id = p_table_id;
    IF FOUND THEN
        RETURN v_form_id;
    END IF;
    
    -- Create the new form
    INSERT INTO forms (
        workspace_id, legacy_table_id, name, slug, description,
        settings, status, created_at, updated_at
    )
    VALUES (
        v_table.workspace_id,
        p_table_id,
        v_table.name,
        COALESCE(v_table.custom_slug, v_table.id::text),
        v_table.description,
        COALESCE(v_table.settings, '{}'::jsonb),
        CASE WHEN v_table.is_published THEN 'published' ELSE 'draft' END,
        v_table.created_at,
        v_table.updated_at
    )
    RETURNING id INTO v_form_id;
    
    -- Create default section
    INSERT INTO form_sections (form_id, name, sort_order)
    VALUES (v_form_id, 'Main', 0)
    RETURNING id INTO v_section_id;
    
    -- Migrate fields
    FOR v_field IN 
        SELECT * FROM table_fields 
        WHERE table_id = p_table_id 
        ORDER BY position
    LOOP
        INSERT INTO form_fields (
            form_id, section_id, legacy_field_id,
            field_key, field_type, label, description, placeholder,
            required, validation, options, conditions,
            sort_order, width, created_at, updated_at
        )
        VALUES (
            v_form_id,
            v_section_id,
            v_field.id,
            COALESCE(v_field.key, v_field.id::text),
            v_field.field_type,
            v_field.name,
            v_field.description,
            v_field.placeholder,
            COALESCE((v_field.validation->>'required')::boolean, false),
            COALESCE(v_field.validation, '{}'::jsonb),
            COALESCE(v_field.options, '[]'::jsonb),
            COALESCE(v_field.conditions, '[]'::jsonb),
            v_field.position,
            COALESCE(v_field.width, 'full'),
            v_field.created_at,
            v_field.updated_at
        );
    END LOOP;
    
    RETURN v_form_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT ALL ON forms TO authenticated;
GRANT ALL ON form_sections TO authenticated;
GRANT ALL ON form_fields TO authenticated;
GRANT ALL ON form_submissions TO authenticated;
GRANT ALL ON form_responses TO authenticated;
GRANT ALL ON form_response_history TO authenticated;
GRANT ALL ON form_attachments TO authenticated;

GRANT SELECT ON form_submissions_full TO authenticated;
GRANT SELECT ON user_form_submissions TO authenticated;

-- ============================================
-- RLS POLICIES (optional, enable as needed)
-- ============================================
-- ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
-- etc.

COMMENT ON TABLE forms IS 'Unified form definitions (Phase 1 of migration from data_tables)';
COMMENT ON TABLE form_submissions IS 'User submissions linked directly to ba_users';
COMMENT ON TABLE form_responses IS 'Normalized field responses with typed columns';
COMMENT ON FUNCTION migrate_legacy_form IS 'Migrates a data_table form to the new schema';
COMMENT ON FUNCTION migrate_legacy_submission IS 'Migrates a table_row submission to the new schema';
