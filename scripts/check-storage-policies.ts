/**
 * Check current RLS policies for workspace-assets
 * Run with: npx tsx scripts/check-storage-policies.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkPolicies() {
  console.log('🔍 Checking storage RLS policies...\n')
  
  // Query the pg_policies view to see current policies
  const { data, error } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT 
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname ILIKE '%workspace-assets%'
        ORDER BY policyname;
      `
    })
  
  if (error) {
    console.log('⚠️  Could not query policies directly (expected with anon key)')
    console.log('   Error:', error.message)
    console.log('\n📋 Please check policies manually in Supabase Dashboard:')
    console.log('   Storage > Policies > objects table')
    console.log('\n   Look for these policies:')
    console.log('   - "Public upload workspace-assets" (INSERT)')
    console.log('   - "Public read workspace-assets" (SELECT)')  
    console.log('   - "Public delete workspace-assets" (DELETE)')
    console.log('   - "Public update workspace-assets" (UPDATE)')
  } else {
    console.log('✅ Current policies:', JSON.stringify(data, null, 2))
  }
}

checkPolicies().catch(console.error)
