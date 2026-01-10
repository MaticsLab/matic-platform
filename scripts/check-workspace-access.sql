-- Check workspace membership for a user
-- Replace USER_ID and WORKSPACE_ID with actual values

-- Check if workspace exists
SELECT id, name, slug, organization_id 
FROM workspaces 
WHERE id = '9a13130f-a0ec-47c9-8fe2-8254f9fcfa7e';

-- Check workspace members for this workspace
SELECT 
    wm.id,
    wm.workspace_id,
    wm.user_id,
    wm.ba_user_id,
    wm.role,
    wm.status,
    wm.created_at,
    ba_user.id as better_auth_user_id,
    ba_user.email as better_auth_user_email
FROM workspace_members wm
LEFT JOIN ba_users ba_user ON (wm.ba_user_id = ba_user.id OR wm.user_id::text = ba_user.id)
WHERE wm.workspace_id = '9a13130f-a0ec-47c9-8fe2-8254f9fcfa7e'
    AND wm.status = 'active';

-- Check if user f0d18629-f5c6-49b4-ab1e-327c90af9cfe has access
SELECT 
    wm.*,
    w.name as workspace_name,
    w.slug as workspace_slug
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.workspace_id = '9a13130f-a0ec-47c9-8fe2-8254f9fcfa7e'
    AND (wm.user_id::text = 'f0d18629-f5c6-49b4-ab1e-327c90af9cfe' 
         OR wm.ba_user_id = 'f0d18629-f5c6-49b4-ab1e-327c90af9cfe')
    AND wm.status = 'active';

-- Check Better Auth user
SELECT id, email, name, created_at 
FROM ba_users 
WHERE id = 'f0d18629-f5c6-49b4-ab1e-327c90af9cfe';

-- Check all workspaces for this user
SELECT 
    w.id,
    w.name,
    w.slug,
    wm.role,
    wm.status,
    wm.user_id,
    wm.ba_user_id
FROM workspaces w
JOIN workspace_members wm ON wm.workspace_id = w.id
WHERE (wm.user_id::text = 'f0d18629-f5c6-49b4-ab1e-327c90af9cfe' 
       OR wm.ba_user_id = 'f0d18629-f5c6-49b4-ab1e-327c90af9cfe')
    AND wm.status = 'active';
