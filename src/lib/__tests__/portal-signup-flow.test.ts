/**
 * Portal Signup Flow Integration Test
 * 
 * Tests the complete public portal signup flow using Better Auth SDK (Approach 1)
 * and verifies that data is stored correctly across all relevant Supabase tables.
 * 
 * NEW APPROACH (Better Auth SDK):
 * 1. Frontend calls portalBetterAuthClient.signUp.email() - Better Auth handles:
 *    - ba_users record (Better Auth manages)
 *    - ba_accounts record (Better Auth manages)
 *    - ba_sessions record (Better Auth manages)
 * 
 * 2. Frontend calls sync endpoint /portal/sync-better-auth-applicant - Backend creates:
 *    - table_rows record (form submission)
 *    - portal_applicants record (linker)
 * 
 * Tables involved:
 * 1. ba_users - Better Auth user record (applicant type)
 * 2. ba_accounts - Better Auth account with password hash
 * 3. ba_sessions - Better Auth session (created on signup)
 * 4. table_rows - Form submission data row
 * 5. portal_applicants - Links ba_user to form and table_row
 * 
 * @see src/components/ApplicationsHub/Applications/ApplicantPortal/PublicPortalV2.tsx - Frontend
 * @see go-backend/handlers/portal_auth_v2.go - PortalSyncBetterAuthApplicant
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { portalBetterAuthClient } from '@/lib/portal-better-auth-client'

// Supabase client for direct database queries
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Service key for admin queries
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// API URL for portal sync endpoint
const getApiUrl = () => {
  return process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'
}

describe('Portal Signup Flow - Better Auth SDK (Approach 1)', () => {
  let testFormId: string
  let testEmail: string
  let testPassword: string
  let testFullName: string
  let createdUserId: string

  beforeAll(() => {
    // Setup test data
    testEmail = `test-portal-${Date.now()}@example.com`
    testPassword = 'TestPassword123!'
    testFullName = 'Test Applicant User'
    
    // For this test, you need a valid form ID from your database
    // You can either:
    // 1. Create a test form in beforeAll
    // 2. Use an existing form ID
    // 3. Query for any form and use that ID
    
    // For now, we'll assume you have at least one form in the database
    // In a real test, you'd create this form in beforeAll
  })

  afterAll(async () => {
    // Cleanup: Delete test records in reverse order of dependencies
    if (createdUserId) {
      try {
        // 1. Delete portal_applicants records
        await supabase
          .from('portal_applicants')
          .delete()
          .eq('ba_user_id', createdUserId)
        
        // 2. Delete table_rows
        await supabase
          .from('table_rows')
          .delete()
          .eq('metadata->>ba_user_id', createdUserId)
        
        // 3. Delete ba_accounts
        await supabase
          .from('ba_accounts')
          .delete()
          .eq('user_id', createdUserId)
        
        // 4. Delete ba_users
        await supabase
          .from('ba_users')
          .delete()
          .eq('id', createdUserId)
        
        console.log('✅ Cleaned up test data')
      } catch (error) {
        console.error('Cleanup failed:', error)
      }
    }
  })

  it('should create account and store data in all relevant tables', async () => {
    // Step 1: Greate user with Better Auth SDK
    console.log('\n📝 Testing Portal Signup Flow (Better Auth SDK Approach)')
    console.log('Test Data:', { email: testEmail, form_id: testFormId })

    const signupResult = await portalBetterAuthClient.signUp.email({
      email: testEmail,
      password: testPassword,
      name: testFullName,
    })

    expect(signupResult.error).toBeUndefined()
    expect(signupResult.data?.user).toBeDefined()
    
    const betterAuthUser = signupResult.data!.user
    console.log('\n✅ Better Auth Signup Response:', {
      id: betterAuthUser.id,
      email: betterAuthUser.email,
      name: betterAuthUser.name
    })
    
    createdUserId = betterAuthUser.id

    // Step 3: Sync with backend to create portal records
    console.log('\n🔄 Syncing with backend to create portal records...')
    const syncResponse = await fetch(`${getApiUrl()}/portal/sync-better-auth-applicant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        form_id: testFormId,
        email: testEmail,
        better_auth_user_id: createdUserId,
        name: testFullName,
        first_name: testFullName.split(' ')[0] || '',
        last_name: testFullName.split(' ').slice(1).join(' ') || '',
      })
    })

    expect(syncResponse.ok).toBe(true)
    const syncResult = await syncResponse.json()
    4: Verify ba_users table
    console.log('\n🔍 Checking ba_users table...')
    const { data: baUser, error: baUserError } = await supabase
      .from('ba_users')
      .select('*')
      .eq('id', createdUserId)
      .single()

    expect(baUserError).toBeNull()
    expect(baUser).toBeDefined()
    expect(baUser!.email).toBe(testEmail)
    expect(baUser!.name).toBe(testFullName)
    expect(baUser!.user_type).toBe('applicant')
    expect(baUser!.metadata).toBeDefined()
    expect(baUser!.metadata.forms_applied).toContain(testFormId)
    
    console.log('✅ ba_users record:', {
      id: baUser!.id,
      email: baUser!.email,
      user_type: baUser!.user_type,
      forms_applied: baUser!.metadata.forms_applied
    })

    // Step 5', createdUserId)
      .single()

    expect(baUserError).toBeNull()
    expect(baUser).toBeDefined()
    expect(baUser!.email).toBe(testEmail)
    expect(baUser!.name).toBe(testFullName)
    expect(baUser!.user_type).toBe('applicant')
    expect(baUser!.metadata).toBeDefined()
    expect(baUser!.metadata.forms_applied).toContain(testFormId)
    
    console.log('✅ ba_users record:', {
      id: baUser!.id,
      email: baUser!.email,
      user_type: baUser!.user_type,
      forms_applied: baUser!.metadata.forms_applied
    })

    // Step 5: Verify ba_accounts table
    console.log('\n🔍 Checking ba_accounts table...')
    const { data: baAccount, error: baAccountError } = await supabase
      .from('ba_accounts')
      .select('*')
      .eq('user_id', createdUserId)
      .eq('provider_id', 'credential')
      .single()

    expect(baAccountError).toBeNull()
    expect(baAccount).toBeDefined()
    expect(baAccount!.account_id).toBe(testEmail)
    expect(baAccount!.provider_id).toBe('credential')
    expect(baAccount!.password).toBeDefined()
    expect(baAccount!.password).toMatch(/^[0-9a-f]+:[0-9a-f]+$/) // scrypt format: salt:hash
    
    console.log('✅ ba_accounts record:', {
      id: baAccount!.id,
      account_id: baAccount!.account_id,
      provider_id: baAccount!.provider_id,
      has_password: !!baAccount!.password
    })

    // Step 7: Verify table_rows table
    console.log('\n🔍 Checking table_rows table...')
    const { data: tableRows, error: tableRowsError } = await supabase
      .from('table_rows')
      .select('*')
      .eq('table_id', testFormId)
      .eq('metadata->>ba_user_id', createdUserId)
      .order('created_at', { ascending: false })
      .limit(1)

    expect(tableRowsError).toBeNull()
    expect(tableRows).toBeDefined()
    expect(tableRows!.length).toBeGreaterThan(0)
    
    const tableRow = tableRows![0]
    expect(tableRow.metadata.ba_user_id).toBe(createdUserId)
    expect(tableRow.metadata.applicant_email).toBe(testEmail)
    expect(tableRow.metadata.applicant_name).toBe(testFullName)
    expect(tableRow.metadata.status).toBe('not_started')
    expect(tableRow.metadata.completion_percentage).toBe(0)
    
    console.log('✅ table_rows record:', {
      id: tableRow.id,
      table_id: tableRow.table_id,
      ba_user_id: tableRow.metadata.ba_user_id,
      status: tableRow.metadata.status
    })
8: Verify portal_applicants table
    console.log('\n🔍 Checking portal_applicants table...')
    const { data: portalApplicant, error: portalApplicantError } = await supabase
      .from('portal_applicants')
      .select('*')
      .eq('ba_user_id', createdUserId)
      .eq('form_id', testFormId)
      .single()

    expect(portalApplicantError).toBeNull()
    expect(portalApplicant).toBeDefined()
    expect(portalApplicant!.email).toBe(testEmail)
    expect(portalApplicant!.form_id).toBe(testFormId)
    expect(portalApplicant!.ba_user_id).toBe(createdUserId)
    expect(portalApplicant!.row_id).toBe(tableRow.id)
    
    console.log('✅ portal_applicants record:', {
      id: portalApplicant!.id,
      ba_user_id: portalApplicant!.ba_user_id,
      form_id: portalApplicant!.form_id,
      row_id: portalApplicant!.row_id
    })

    // Step 9: Final summary
    console.log('\n📊 Portal Signup Flow - Complete Data Flow Summary (Better Auth SDK):')
    console.log('='.repeat(70))
    console.log('Better Auth (automatic):')
    console.log('1. ba_users:          ', baUser!.id, '(user_type: applicant)')
    console.log('2. ba_accounts:       ', baAccount!.id, '(provider: credential)')
    console.log('3. ba_sessions:       ', baSession.id, '(auto-created on signup)')
    console.log('\nBackend sync (manual):')
    console.log('4. table_rows:        ', tableRow.id, '(form submission)')
    console.log('5. portal_applicants: ', portalApplicant!.id, '(links all together)')
    console.log('='.repeat(70))
    console.log('✅ All records created successfully using Better Auth SDK!\n')

    // Final assertion - everything is linked correctly
    expect(baUser!.id).toBe(createdUserId)
    expect(baAccount!.user_id).toBe(createdUserId)
    expect(baSession.user_id).toBe(createdUserId)
    expect(tableRow.metadata.ba_user_id).toBe(createdUserId)
    expect(portalApplicant!.ba_user_id).toBe(createdUserId)
    expect(portalApplicant!.row_id).toBe(tableRow.id)
  })

  it('should handle duplicate signup gracefully', async () => {
    // Try to signup with the same email again
    const duplicateSignupResult = await portalBetterAuthClient.signUp.email({
      email: testEmail,
      password: testPassword,
      name: testFullName,
    })

    expect(duplicateSignupResult.error).toBeDefined()
    expect(duplicateSignupResult.error?.message).toMatch(/already exists|email is taken|user exists/i)
    
    console.log('\n🔄 Duplicate signup attempt (Better Auth):', duplicateSignupResult.error?.message

  it('should handle duplicate signup gracefully', async () => {
    // Try to signup with the same email again
    const duplicateSignupResponse = await fetch(`${getApiUrl()}/portal/v2/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        full_name: testFullName,
        form_id: testFormId
      })
    })

    expect(duplicateSignupResponse.status).toBe(409) // Conflict
    const errorResult = await duplicateSignupResponse.json()
    
    console.log('\n🔄 Duplicate signup attempt:', errorResult)
    expect(errorResult.error).toBeDefined()
    expect(errorResult.action).toBe('login')
    expect(errorResult.user_id).toBe(createdUserId)
  })
})

describe('Portal Signup - Data Structure Verification', () => {
  it('should verify table schemas exist', async () => {
    // Verify all required tables exist
    const tables = [
      'ba_users',
      'ba_accounts', 
      'table_rows',
      'portal_applicants'
    ]

    console.log('\n🔍 Verifying table schemas...')
    
    for (const tableName of tables) {
      const { error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0)
      
      expect(error).toBeNull()
      console.log(`✅ Table exists: ${tableName}`)
    }
  })

  it('should verify ba_users has correct columns', async () => {
    const { data, error } = await supabase
      .from('ba_users')
      .select('id, email, name, user_type, metadata, created_at, updated_at')
      .limit(1)
    
    expect(error).toBeNull()
    console.log('✅ ba_users columns verified')
  })

  it('should verify ba_accounts has correct columns', async () => {
    const { data, error } = await supabase
      .from('ba_accounts')
      .select('id, account_id, provider_id, user_id, password, created_at')
      .limit(1)
    
    expect(error).toBeNull()
    console.log('✅ ba_accounts columns verified')
  })

  it('should verify portal_applicants has correct columns', async () => {
    const { data, error } = await supabase
      .from('portal_applicants')
      .select('id, ba_user_id, form_id, email, row_id, created_at')
      .limit(1)
    
    expect(error).toBeNull()
    console.log('✅ portal_applicants columns verified')
  })

  it('should verify table_rows has correct columns', async () => {
    const { data, error } = await supabase
      .from('table_rows')
      .select('id, table_id, data, metadata, created_at')
      .limit(1)
    
    expect(error).toBeNull()
    console.log('✅ table_rows columns verified')
  })
})
