/**
 * Script to check workspace access for a user
 * Run with: npx tsx scripts/check-workspace-user-access.ts
 */

import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

// Try to read DATABASE_URL from go-backend/.env
let databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  try {
    const envFile = readFileSync(join(__dirname, '../go-backend/.env'), 'utf-8')
    const match = envFile.match(/^DATABASE_URL=(.+)$/m)
    if (match) {
      databaseUrl = match[1].trim()
    }
  } catch (error) {
    // Ignore if file doesn't exist
  }
}

// Fallback: try to construct from Supabase URL
if (!databaseUrl) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    // Extract project ref from Supabase URL
    const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
    if (match) {
      const projectRef = match[1]
      // Note: This won't work without the actual password, but we can try
      console.warn('⚠️  DATABASE_URL not found. Please set it in go-backend/.env')
      console.warn('   Format: postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres')
    }
  }
}

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found')
  console.error('Please set DATABASE_URL in go-backend/.env or as an environment variable')
  process.exit(1)
}

console.log('📊 Connecting to database...')
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
})

async function checkWorkspaceAccess() {
  const userId = 'f0d18629-f5c6-49b4-ab1e-327c90af9cfe'
  const workspaceId = '9a13130f-a0ec-47c9-8fe2-8254f9fcfa7e'

  console.log('🔍 Checking workspace access...\n')
  console.log(`User ID: ${userId}`)
  console.log(`Workspace ID: ${workspaceId}\n`)

  // Check if workspace exists
  const workspaceResult = await pool.query(
    'SELECT id, name, slug, organization_id FROM workspaces WHERE id = $1',
    [workspaceId]
  )
  
  if (workspaceResult.rows.length === 0) {
    console.log('❌ Workspace not found!')
    return
  }
  
  console.log('✅ Workspace found:', workspaceResult.rows[0])
  console.log('')

  // Check Better Auth user
  const userResult = await pool.query(
    'SELECT id, email, name, created_at FROM ba_users WHERE id = $1',
    [userId]
  )
  
  if (userResult.rows.length === 0) {
    console.log('❌ Better Auth user not found!')
    return
  }
  
  console.log('✅ Better Auth user found:', userResult.rows[0])
  console.log('')

  // Check workspace membership
  const membershipResult = await pool.query(
    `SELECT 
      wm.id,
      wm.workspace_id,
      wm.user_id,
      wm.ba_user_id,
      wm.role,
      wm.status,
      wm.accepted_at,
      ba_user.id as better_auth_user_id,
      ba_user.email as better_auth_user_email
    FROM workspace_members wm
    LEFT JOIN ba_users ba_user ON (wm.ba_user_id = ba_user.id OR wm.user_id::text = ba_user.id)
    WHERE wm.workspace_id = $1
      AND (wm.user_id::text = $2 OR wm.ba_user_id = $2)
      AND wm.status = 'active'`,
    [workspaceId, userId]
  )
  
  if (membershipResult.rows.length === 0) {
    console.log('❌ User is NOT a member of this workspace!')
    console.log('\nChecking all workspace members:')
    const allMembers = await pool.query(
      'SELECT user_id, ba_user_id, role, status FROM workspace_members WHERE workspace_id = $1',
      [workspaceId]
    )
    console.log(allMembers.rows)
  } else {
    console.log('✅ User IS a member of this workspace:')
    console.log(membershipResult.rows[0])
  }
  
  console.log('')

  // Check forms in workspace (tables with icon='form' or type='form')
  const formsResult = await pool.query(
    `SELECT id, name, slug, workspace_id, icon, created_at 
     FROM data_tables 
     WHERE workspace_id = $1 
     AND (icon = 'form' OR settings->>'type' = 'form')
     ORDER BY created_at DESC`,
    [workspaceId]
  )
  
  console.log(`📋 Forms in workspace: ${formsResult.rows.length}`)
  formsResult.rows.forEach((form, i) => {
    console.log(`  ${i + 1}. ${form.name} (${form.id})`)
  })

  await pool.end()
}

checkWorkspaceAccess().catch(console.error)
