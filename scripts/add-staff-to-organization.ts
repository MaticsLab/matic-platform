/**
 * Migration Script: Add All Staff Users to Organization
 * 
 * This script:
 * 1. Fixes the organization ID mismatch between workspaces and ba_organizations
 * 2. Adds all staff users to the BPNC organization as members
 * 3. Sets proper roles for organization access
 * 
 * Run: npx tsx scripts/add-staff-to-organization.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface StaffUser {
  id: string
  email: string
  name: string
  user_type: string
}

interface Organization {
  id: string
  name: string
  slug: string
}

interface ExistingMember {
  user_id: string
  role: string
}

async function main() {
  console.log('🚀 Starting organization migration...\n')

  try {
    // Step 1: Get the BPNC organization
    console.log('📋 Step 1: Fetching BPNC organization...')
    const { data: orgs, error: orgError } = await supabase
      .from('ba_organizations')
      .select('*')
      .eq('slug', 'BPNC')
      .single()

    if (orgError || !orgs) {
      console.error('❌ Failed to fetch organization:', orgError)
      process.exit(1)
    }

    const organization = orgs as Organization
    console.log(`✅ Found organization: ${organization.name} (${organization.id})\n`)

    // Step 2: Fix workspace organization_id mismatch
    console.log('🔧 Step 2: Fixing workspace organization ID...')
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, organization_id')
      .eq('slug', 'BPNC')
      .single()

    if (workspaceError) {
      console.error('❌ Failed to fetch workspace:', workspaceError)
      process.exit(1)
    }

    if (workspace.organization_id !== organization.id) {
      console.log(`   Current workspace org ID: ${workspace.organization_id}`)
      console.log(`   Correct org ID: ${organization.id}`)
      console.log('   Updating workspace organization_id...')

      const { error: updateError } = await supabase
        .from('workspaces')
        .update({ organization_id: organization.id })
        .eq('id', workspace.id)

      if (updateError) {
        console.error('❌ Failed to update workspace:', updateError)
        process.exit(1)
      }

      console.log('✅ Workspace organization ID updated!\n')
    } else {
      console.log('✅ Workspace organization ID already correct\n')
    }

    // Step 3: Get all staff users
    console.log('👥 Step 3: Fetching all staff users...')
    const { data: staffUsers, error: staffError } = await supabase
      .from('ba_users')
      .select('id, email, name, user_type')
      .eq('user_type', 'staff')

    if (staffError || !staffUsers) {
      console.error('❌ Failed to fetch staff users:', staffError)
      process.exit(1)
    }

    console.log(`✅ Found ${staffUsers.length} staff users\n`)

    // Step 4: Get existing organization members
    console.log('🔍 Step 4: Checking existing organization members...')
    const { data: existingMembers, error: membersError } = await supabase
      .from('ba_members')
      .select('user_id, role')
      .eq('organization_id', organization.id)

    if (membersError) {
      console.error('❌ Failed to fetch existing members:', membersError)
      process.exit(1)
    }

    const existingMemberIds = new Set((existingMembers || []).map((m: ExistingMember) => m.user_id))
    console.log(`✅ Found ${existingMemberIds.size} existing members\n`)

    // Step 5: Add new members
    console.log('➕ Step 5: Adding new staff members to organization...')
    
    let addedCount = 0
    let skippedCount = 0

    for (const user of staffUsers as StaffUser[]) {
      if (existingMemberIds.has(user.id)) {
        console.log(`   ⏭️  Skipping ${user.email} (already a member)`)
        skippedCount++
        continue
      }

      // Add as 'member' role (owners should be manually promoted)
      const { error: insertError } = await supabase
        .from('ba_members')
        .insert({
          organization_id: organization.id,
          user_id: user.id,
          role: 'member',
          created_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error(`   ❌ Failed to add ${user.email}:`, insertError.message)
        continue
      }

      console.log(`   ✅ Added ${user.email} as member`)
      addedCount++
    }

    // Summary
    console.log('\n📊 Migration Summary:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Organization: ${organization.name}`)
    console.log(`Total staff users: ${staffUsers.length}`)
    console.log(`Already members: ${skippedCount}`)
    console.log(`Newly added: ${addedCount}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Step 6: Verify final state
    console.log('\n🔍 Step 6: Verifying final organization state...')
    const { data: finalMembers, error: finalError } = await supabase
      .from('ba_members')
      .select(`
        user_id,
        role,
        ba_users (
          email,
          name,
          user_type
        )
      `)
      .eq('organization_id', organization.id)

    if (finalError) {
      console.error('❌ Failed to verify members:', finalError)
      process.exit(1)
    }

    console.log('\n👥 Current Organization Members:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    finalMembers?.forEach((member: any) => {
      const user = member.ba_users
      console.log(`   ${member.role.toUpperCase().padEnd(8)} | ${user.email} (${user.name || 'No name'})`)
    })
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    console.log('\n✅ Migration completed successfully!')
    console.log('\n💡 Next Steps:')
    console.log('   1. Verify middleware is blocking applicants from main app')
    console.log('   2. Test staff user login to main app')
    console.log('   3. Test applicant redirect to portal')
    console.log('   4. Promote specific users to "owner" role if needed')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

main()
