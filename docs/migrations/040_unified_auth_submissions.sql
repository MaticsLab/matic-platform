-- Migration: Unified Auth & Optimistic Submissions
-- Adds user_type to ba_users for applicant support
-- Creates application_submissions table with versioning for optimistic autosave

-- ============================================
-- 1. EXTEND ba_users FOR APPLICANTS
-- ============================================

-- Add user_type column (staff, applicant, reviewer)
ALTER TABLE ba_users ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'staff';

-- Add metadata JSONB for flexible user data
ALTER TABLE ba_users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ba_users_type ON ba_users(user_type);
CREATE INDEX IF NOT EXISTS idx_ba_users_metadata ON ba_users USING GIN(metadata);

-- ============================================
-- 2. CREATE application_submissions TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS application_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User reference (Better Auth user)
    user_id TEXT NOT NULL REFERENCES ba_users(id) ON DELETE CASCADE,
    
    -- Form reference
    form_id UUID NOT NULL REFERENCES data_tables(id) ON DELETE CASCADE,
    
    -- Status tracking
    status VARCHAR(30) DEFAULT 'draft',
    -- Possible values: draft, submitted, under_review, approved, rejected, waitlisted, withdrawn
    
    -- Workflow stage (nullable for draft)
    stage_id UUID REFERENCES application_stages(id) ON DELETE SET NULL,
    
    -- Form data (JSONB for flexibility)
    data JSONB DEFAULT '{}',
    
    -- Optimistic locking version
    version INT DEFAULT 1 NOT NULL,
    
    -- Timestamps
    submitted_at TIMESTAMPTZ,
    last_autosave_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure one submission per user per form
    UNIQUE(user_id, form_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_app_submissions_user ON application_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_submissions_form ON application_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_app_submissions_status ON application_submissions(status);
CREATE INDEX IF NOT EXISTS idx_app_submissions_stage ON application_submissions(stage_id);
CREATE INDEX IF NOT EXISTS idx_app_submissions_data ON application_submissions USING GIN(data);
CREATE INDEX IF NOT EXISTS idx_app_submissions_form_status ON application_submissions(form_id, status);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_app_submissions_form_user ON application_submissions(form_id, user_id);

-- ============================================
-- 3. CREATE submission_versions TABLE
-- ============================================
-- Stores version history for undo/audit

CREATE TABLE IF NOT EXISTS submission_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES application_submissions(id) ON DELETE CASCADE,
    version INT NOT NULL,
    data JSONB NOT NULL,
    changed_fields TEXT[], -- Array of field IDs that changed
    change_type VARCHAR(20) DEFAULT 'autosave', -- autosave, manual_save, submit, restore
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    UNIQUE(submission_id, version)
);

CREATE INDEX IF NOT EXISTS idx_submission_versions_submission ON submission_versions(submission_id);

-- ============================================
-- 4. MIGRATION FUNCTION: portal_applicants → ba_users
-- ============================================

CREATE OR REPLACE FUNCTION migrate_portal_applicants_to_ba_users()
RETURNS TABLE(migrated_count INT, skipped_count INT) AS $$
DECLARE
    v_migrated INT := 0;
    v_skipped INT := 0;
    v_applicant RECORD;
    v_user_id TEXT;
    v_existing_user_id TEXT;
BEGIN
    FOR v_applicant IN 
        SELECT DISTINCT ON (email) *
        FROM portal_applicants
        ORDER BY email, created_at DESC
    LOOP
        -- Check if user already exists in ba_users
        SELECT id INTO v_existing_user_id
        FROM ba_users
        WHERE email = v_applicant.email;
        
        IF v_existing_user_id IS NOT NULL THEN
            -- User exists, update their metadata to include this form
            UPDATE ba_users
            SET 
                user_type = CASE WHEN user_type = 'staff' THEN user_type ELSE 'applicant' END,
                metadata = jsonb_set(
                    COALESCE(metadata, '{}'::jsonb),
                    '{forms_applied}',
                    COALESCE(metadata->'forms_applied', '[]'::jsonb) || 
                    to_jsonb(v_applicant.form_id::text)
                ),
                updated_at = NOW()
            WHERE id = v_existing_user_id;
            
            v_user_id := v_existing_user_id;
            v_skipped := v_skipped + 1;
        ELSE
            -- Create new ba_user
            v_user_id := gen_random_uuid()::TEXT;
            
            INSERT INTO ba_users (id, email, name, user_type, metadata, created_at, updated_at)
            VALUES (
                v_user_id,
                v_applicant.email,
                v_applicant.full_name,
                'applicant',
                jsonb_build_object(
                    'forms_applied', jsonb_build_array(v_applicant.form_id::text),
                    'legacy_portal_applicant_id', v_applicant.id::text
                ),
                v_applicant.created_at,
                NOW()
            );
            
            -- Create ba_account for password auth (credential provider)
            INSERT INTO ba_accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
            VALUES (
                gen_random_uuid()::TEXT,
                v_applicant.email,
                'credential',
                v_user_id,
                v_applicant.password_hash,
                v_applicant.created_at,
                NOW()
            );
            
            v_migrated := v_migrated + 1;
        END IF;
        
        -- Migrate their submission if exists
        IF v_applicant.id IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM data_tables WHERE id = v_applicant.form_id) THEN
                INSERT INTO application_submissions (
                    id, user_id, form_id, status, data, version, submitted_at, created_at, updated_at
                )
                VALUES (
                    v_applicant.id,
                    v_user_id,
                    v_applicant.form_id,
                    'submitted',
                    v_applicant.submission_data,
                    1,
                    NULL,
                    v_applicant.created_at,
                    v_applicant.updated_at
                )
                ON CONFLICT (user_id, form_id) DO NOTHING;
            END IF;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_migrated, v_skipped;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. HELPER FUNCTION: Get or create submission
-- ============================================

CREATE OR REPLACE FUNCTION get_or_create_submission(
    p_user_id TEXT,
    p_form_id UUID
) RETURNS application_submissions AS $$
DECLARE
    v_submission application_submissions;
BEGIN
    -- Try to get existing
    SELECT * INTO v_submission
    FROM application_submissions
    WHERE user_id = p_user_id AND form_id = p_form_id;
    
    IF v_submission.id IS NOT NULL THEN
        RETURN v_submission;
    END IF;
    
    -- Create new
    INSERT INTO application_submissions (user_id, form_id, status, version)
    VALUES (p_user_id, p_form_id, 'draft', 1)
    RETURNING * INTO v_submission;
    
    RETURN v_submission;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. TRIGGER: Auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_submission_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
                    IF v_applicant.id IS NOT NULL THEN
END;
$$ LANGUAGE plpgsql;

                        VALUES (
                            v_applicant.id,
    BEFORE UPDATE ON application_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_submission_timestamp();

-- ============================================
-- 7. COMMENTS
-- ============================================

COMMENT ON TABLE application_submissions IS 'Stores application form submissions with optimistic locking for autosave';
COMMENT ON COLUMN application_submissions.version IS 'Optimistic locking version - incremented on each save';
COMMENT ON COLUMN application_submissions.user_id IS 'References ba_users.id (Better Auth user)';
COMMENT ON COLUMN ba_users.user_type IS 'User type: staff (internal), applicant (portal), reviewer (external)';
COMMENT ON COLUMN ba_users.metadata IS 'Flexible metadata - for applicants: {forms_applied: [...]}';
