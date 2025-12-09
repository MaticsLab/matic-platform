-- Migration: Add portal_applicants table for custom authentication
-- Created: 2025-12-09

CREATE TABLE IF NOT EXISTS portal_applicants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES table_views(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    submission_data JSONB DEFAULT '{}',
    reset_token VARCHAR(255) UNIQUE,
    reset_token_expiry TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(form_id, email)
);

-- Index for faster lookups
CREATE INDEX idx_portal_applicants_form_email ON portal_applicants(form_id, email);
CREATE INDEX idx_portal_applicants_reset_token ON portal_applicants(reset_token) WHERE reset_token IS NOT NULL;

-- Comments
COMMENT ON TABLE portal_applicants IS 'Stores portal applicant accounts with custom authentication (not Supabase Auth)';
COMMENT ON COLUMN portal_applicants.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN portal_applicants.reset_token IS 'Token for password reset (expires after 24 hours)';
COMMENT ON COLUMN portal_applicants.submission_data IS 'Stores signup form data in JSONB format';
