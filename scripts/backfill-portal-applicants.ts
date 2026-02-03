/**
 * Backfill portal_applicants records for users who signed up but don't have this record
 * This fixes the "Unknown Form" issue in the CRM
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function backfillPortalApplicants() {
  console.log('\n=== Backfilling portal_applicants Records ===\n');

  // Find all applicant users
  const { data: users, error: usersError } = await supabase
    .from('ba_users')
    .select('id, email, name, metadata')
    .like('user_type', 'applicant%');

  if (usersError) {
    console.error('Error fetching users:', usersError);
    return;
  }

  console.log(`Found ${users.length} applicant users\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    // Check if they already have portal_applicants records
    const { data: existingApplicants } = await supabase
      .from('portal_applicants')
      .select('id, form_id')
      .eq('ba_user_id', user.id);

    // Parse metadata to get forms_applied
    const metadata = user.metadata as any;
    const formsApplied: string[] = metadata?.forms_applied || [];

    if (formsApplied.length === 0) {
      console.log(`⚠️  User ${user.email} has no forms_applied in metadata`);
      skipped++;
      continue;
    }

    const existingFormIds = new Set(existingApplicants?.map(a => a.form_id) || []);

    // Create missing portal_applicants records
    for (const formId of formsApplied) {
      if (existingFormIds.has(formId)) {
        console.log(`  ✓ ${user.email} already has portal_applicants for form ${formId}`);
        skipped++;
        continue;
      }

      // Check if form exists
      const { data: form } = await supabase
        .from('data_tables')
        .select('id, name')
        .eq('id', formId)
        .single();

      if (!form) {
        console.log(`  ⚠️  Form ${formId} not found for user ${user.email}`);
        errors++;
        continue;
      }

      // Create table_row for the form submission if it doesn't exist
      const { data: existingRow } = await supabase
        .from('table_rows')
        .select('id')
        .eq('table_id', formId)
        .eq('metadata->ba_user_id', user.id)
        .single();

      let rowId = existingRow?.id;

      if (!rowId) {
        // Create table_row
        const { data: newRow, error: rowError } = await supabase
          .from('table_rows')
          .insert({
            table_id: formId,
            data: {},
            metadata: {
              status: 'not_started',
              completion_percentage: 0,
              ba_user_id: user.id,
              applicant_email: user.email,
              applicant_name: user.name,
            },
          })
          .select('id')
          .single();

        if (rowError) {
          console.log(`  ❌ Failed to create table_row for ${user.email}: ${rowError.message}`);
          errors++;
          continue;
        }

        rowId = newRow.id;
        console.log(`  ✅ Created table_row for ${user.email}`);
      }

      // Create portal_applicants record
      const { error: insertError } = await supabase
        .from('portal_applicants')
        .insert({
          ba_user_id: user.id,
          form_id: formId,
          email: user.email,
          row_id: rowId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.log(`  ❌ Failed to create portal_applicants for ${user.email} form ${formId}: ${insertError.message}`);
        errors++;
      } else {
        console.log(`  ✅ Created portal_applicants for ${user.email} → ${form.name}`);
        created++;
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`✅ Created: ${created}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('\n');
}

backfillPortalApplicants().catch(console.error);
