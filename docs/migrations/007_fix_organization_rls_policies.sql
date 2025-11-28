-- Fix Row Level Security Policies for Organizations and Workspaces
-- This allows authenticated users to create organizations and be added as members

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage organization members" ON organization_members;

-- Allow authenticated users to view organization members they belong to
CREATE POLICY "Users can view their organization memberships"
ON organization_members FOR SELECT
USING (user_id = auth.uid());

-- Allow the system (service role) to insert organization members
-- This is needed for signup flow
CREATE POLICY "Service role can insert organization members"
ON organization_members FOR INSERT
WITH CHECK (true);

-- Allow organization owners/admins to insert new members
CREATE POLICY "Admins can add organization members"
ON organization_members FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = organization_members.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

-- Allow organization owners/admins to update members
CREATE POLICY "Admins can update organization members"
ON organization_members FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
);

-- Allow organization owners to delete members
CREATE POLICY "Owners can remove organization members"
ON organization_members FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
);

-- Similar policies for workspace_members
DROP POLICY IF EXISTS "Users can view workspace members" ON workspace_members;

CREATE POLICY "Users can view their workspace memberships"
ON workspace_members FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Service role can insert workspace members"
ON workspace_members FOR INSERT
WITH CHECK (true);

CREATE POLICY "Workspace admins can add members"
ON workspace_members FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = workspace_members.workspace_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
);

CREATE POLICY "Workspace admins can update members"
ON workspace_members FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
);

CREATE POLICY "Workspace admins can remove members"
ON workspace_members FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
    )
);
