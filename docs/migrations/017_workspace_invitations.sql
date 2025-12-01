-- Workspace Invitations Table
-- Stores pending invitations to join workspaces

CREATE TABLE IF NOT EXISTS workspace_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    hub_access TEXT[] DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    CONSTRAINT valid_role CHECK (role IN ('admin', 'editor', 'viewer'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_status ON workspace_invitations(status);

-- Add hub_access column to workspace_members if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workspace_members' AND column_name = 'hub_access'
    ) THEN
        ALTER TABLE workspace_members ADD COLUMN hub_access TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Add updated_at column to workspace_members if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workspace_members' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE workspace_members ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Enable RLS
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workspace_invitations
CREATE POLICY "Users can view invitations for workspaces they are members of"
    ON workspace_invitations FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can create invitations"
    ON workspace_invitations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workspace_members 
            WHERE workspace_id = workspace_invitations.workspace_id 
            AND user_id = auth.uid() 
            AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "Admins can update invitations"
    ON workspace_invitations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members 
            WHERE workspace_id = workspace_invitations.workspace_id 
            AND user_id = auth.uid() 
            AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "Admins can delete invitations"
    ON workspace_invitations FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members 
            WHERE workspace_id = workspace_invitations.workspace_id 
            AND user_id = auth.uid() 
            AND role IN ('admin', 'owner')
        )
    );

-- Comment
COMMENT ON TABLE workspace_invitations IS 'Stores pending invitations for users to join workspaces';
