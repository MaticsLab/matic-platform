-- Allow authenticated users to create organizations
-- This was missing, which prevents users from creating organizations if the backend is not running as superuser
CREATE POLICY "Users can create organizations" ON organizations FOR INSERT TO authenticated WITH CHECK (true);

-- Ensure organization_members allows insertion
-- The previous migration added a permissive policy, but let's make sure it covers the authenticated role explicitly if needed
-- (The previous one applied to public, so it should be fine, but adding this doesn't hurt)
CREATE POLICY "Users can add themselves to organizations" ON organization_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Ensure workspaces allows insertion
-- The existing policy requires org membership, which is correct.
-- But let's ensure the backend can insert if it's running as a user.
-- The existing policy: "Users can create workspaces in their organizations"
-- WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() ...))
-- This is correct.
