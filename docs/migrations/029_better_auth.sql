-- Better Auth Migration
-- Creates tables for Better Auth with ba_ prefix to avoid conflicts with Supabase Auth
-- Supports multi-tenant (organizations) functionality

-- ============================================
-- BETTER AUTH CORE TABLES
-- ============================================

-- Users table (separate from Supabase auth.users)
CREATE TABLE IF NOT EXISTS ba_users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    image TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Custom fields for Matic
    supabase_user_id UUID REFERENCES auth.users(id), -- Link to existing Supabase user
    migrated_from_supabase BOOLEAN DEFAULT FALSE,
    full_name TEXT,
    avatar_url TEXT
);

-- Sessions table
CREATE TABLE IF NOT EXISTS ba_sessions (
    id TEXT PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT NOT NULL REFERENCES ba_users(id) ON DELETE CASCADE,
    -- Multi-session support
    active_organization_id TEXT
);

-- Accounts table (for OAuth providers)
CREATE TABLE IF NOT EXISTS ba_accounts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES ba_users(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    scope TEXT,
    password TEXT, -- Hashed password for email/password auth
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Verifications table (for email verification, password reset, etc.)
CREATE TABLE IF NOT EXISTS ba_verifications (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORGANIZATION (MULTI-TENANT) TABLES
-- ============================================

-- Organizations table (maps to workspaces concept)
CREATE TABLE IF NOT EXISTS ba_organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    logo TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization members (user-organization relationship)
CREATE TABLE IF NOT EXISTS ba_members (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES ba_organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES ba_users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Organization invitations
CREATE TABLE IF NOT EXISTS ba_invitations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES ba_organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, expired
    expires_at TIMESTAMPTZ NOT NULL,
    inviter_id TEXT REFERENCES ba_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_ba_users_email ON ba_users(email);
CREATE INDEX IF NOT EXISTS idx_ba_users_supabase_id ON ba_users(supabase_user_id);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_ba_sessions_user_id ON ba_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ba_sessions_token ON ba_sessions(token);
CREATE INDEX IF NOT EXISTS idx_ba_sessions_expires_at ON ba_sessions(expires_at);

-- Accounts indexes
CREATE INDEX IF NOT EXISTS idx_ba_accounts_user_id ON ba_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_ba_accounts_provider ON ba_accounts(provider_id, account_id);

-- Organizations indexes
CREATE INDEX IF NOT EXISTS idx_ba_organizations_slug ON ba_organizations(slug);

-- Members indexes
CREATE INDEX IF NOT EXISTS idx_ba_members_user_id ON ba_members(user_id);
CREATE INDEX IF NOT EXISTS idx_ba_members_org_id ON ba_members(organization_id);

-- Invitations indexes
CREATE INDEX IF NOT EXISTS idx_ba_invitations_email ON ba_invitations(email);
CREATE INDEX IF NOT EXISTS idx_ba_invitations_org_id ON ba_invitations(organization_id);

-- ============================================
-- WORKSPACE TO ORGANIZATION LINKING
-- ============================================

-- Add organization_id to workspaces table to link with Better Auth organizations
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS ba_organization_id TEXT REFERENCES ba_organizations(id);

CREATE INDEX IF NOT EXISTS idx_workspaces_ba_org ON workspaces(ba_organization_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to migrate a Supabase user to Better Auth
CREATE OR REPLACE FUNCTION migrate_supabase_user_to_better_auth(
    p_supabase_user_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_supabase_user RECORD;
    v_better_auth_user_id TEXT;
BEGIN
    -- Get the Supabase user
    SELECT * INTO v_supabase_user 
    FROM auth.users 
    WHERE id = p_supabase_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Supabase user not found: %', p_supabase_user_id;
    END IF;
    
    -- Check if already migrated
    SELECT id INTO v_better_auth_user_id
    FROM ba_users
    WHERE supabase_user_id = p_supabase_user_id;
    
    IF FOUND THEN
        RETURN v_better_auth_user_id; -- Already migrated
    END IF;
    
    -- Generate a new Better Auth user ID
    v_better_auth_user_id := gen_random_uuid()::TEXT;
    
    -- Create Better Auth user
    INSERT INTO ba_users (
        id,
        email,
        email_verified,
        name,
        full_name,
        avatar_url,
        supabase_user_id,
        migrated_from_supabase,
        created_at,
        updated_at
    ) VALUES (
        v_better_auth_user_id,
        v_supabase_user.email,
        v_supabase_user.email_confirmed_at IS NOT NULL,
        COALESCE(v_supabase_user.raw_user_meta_data->>'full_name', v_supabase_user.email),
        v_supabase_user.raw_user_meta_data->>'full_name',
        v_supabase_user.raw_user_meta_data->>'avatar_url',
        p_supabase_user_id,
        TRUE,
        COALESCE(v_supabase_user.created_at, NOW()),
        NOW()
    );
    
    RETURN v_better_auth_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to link existing workspace to Better Auth organization
CREATE OR REPLACE FUNCTION link_workspace_to_organization(
    p_workspace_id UUID,
    p_owner_user_id TEXT
) RETURNS TEXT AS $$
DECLARE
    v_workspace RECORD;
    v_org_id TEXT;
BEGIN
    -- Get the workspace
    SELECT * INTO v_workspace 
    FROM workspaces 
    WHERE id = p_workspace_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace not found: %', p_workspace_id;
    END IF;
    
    -- Check if already linked
    IF v_workspace.ba_organization_id IS NOT NULL THEN
        RETURN v_workspace.ba_organization_id;
    END IF;
    
    -- Generate organization ID
    v_org_id := gen_random_uuid()::TEXT;
    
    -- Create organization
    INSERT INTO ba_organizations (
        id,
        name,
        slug,
        metadata,
        created_at,
        updated_at
    ) VALUES (
        v_org_id,
        v_workspace.name,
        v_workspace.slug,
        jsonb_build_object('workspace_id', p_workspace_id::TEXT),
        v_workspace.created_at,
        NOW()
    );
    
    -- Add owner as organization member
    INSERT INTO ba_members (
        id,
        organization_id,
        user_id,
        role,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid()::TEXT,
        v_org_id,
        p_owner_user_id,
        'owner',
        NOW(),
        NOW()
    );
    
    -- Link workspace to organization
    UPDATE workspaces 
    SET ba_organization_id = v_org_id 
    WHERE id = p_workspace_id;
    
    RETURN v_org_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE ba_users IS 'Better Auth users - separate from Supabase auth.users to allow gradual migration';
COMMENT ON TABLE ba_sessions IS 'Better Auth sessions for authenticated users';
COMMENT ON TABLE ba_accounts IS 'Better Auth accounts for OAuth and password authentication';
COMMENT ON TABLE ba_organizations IS 'Organizations for multi-tenant support (maps to workspaces)';
COMMENT ON TABLE ba_members IS 'Organization membership with role-based access';
COMMENT ON TABLE ba_invitations IS 'Pending invitations to join organizations';
COMMENT ON COLUMN ba_users.supabase_user_id IS 'Links to existing Supabase auth.users for migration';
COMMENT ON COLUMN workspaces.ba_organization_id IS 'Links workspace to Better Auth organization for multi-tenant support';
