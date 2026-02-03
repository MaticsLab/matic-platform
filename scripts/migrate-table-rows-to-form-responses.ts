#!/usr/bin/env node
/**
 * Migrate data from table_rows (legacy JSONB) to form_responses (unified schema)
 * 
 * This script:
 * 1. Finds form_submissions that have 0 form_responses
 * 2. Looks up the corresponding table_rows data
 * 3. Maps fields from table_rows.data JSONB to form_responses
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface SubmissionToMigrate {
  submission_id: string;
  user_id: string;
  email: string;
  form_id: string;
  form_name: string;
  row_id: string;
  data: Record<string, any>;
}

interface FormField {
  id: string;
  form_id: string;
  field_key: string;
  label: string;
  field_type: string;
}

async function getSubmissionsToMigrate(): Promise<SubmissionToMigrate[]> {
  const { data, error } = await supabase.rpc('get_submissions_without_responses', {});
  
  if (error) {
    console.log('RPC not available, using direct query...');
    
    // Fallback to direct query
    const query = `
      SELECT 
        fs.id as submission_id,
        fs.user_id,
        ba.email,
        f.id as form_id,
        f.name as form_name,
        tr.id as row_id,
        tr.data
      FROM form_submissions fs
      JOIN ba_users ba ON ba.id = fs.user_id
      JOIN forms f ON f.id = fs.form_id
      JOIN table_rows tr ON tr.ba_created_by = ba.id
      JOIN data_tables dt ON dt.id = tr.table_id
      WHERE dt.name = f.name
        AND NOT EXISTS (
          SELECT 1 FROM form_responses fr WHERE fr.submission_id = fs.id
        )
      ORDER BY fs.created_at DESC
    `;
    
    const { data: rawData, error: queryError } = await supabase.rpc('exec_sql', { query });
    
    if (queryError) {
      throw queryError;
    }
    
    return rawData || [];
  }
  
  return data || [];
}

async function getFormFields(formId: string): Promise<FormField[]> {
  const { data, error } = await supabase
    .from('form_fields')
    .select('id, form_id, field_key, label, field_type')
    .eq('form_id', formId)
    .order('sort_order');
  
  if (error) throw error;
  return data || [];
}

async function migrateSubmission(submission: SubmissionToMigrate) {
  console.log(`\nMigrating submission for ${submission.email}...`);
  console.log(`  Form: ${submission.form_name}`);
  console.log(`  Submission ID: ${submission.submission_id}`);
  
  // Get form fields
  const fields = await getFormFields(submission.form_id);
  console.log(`  Found ${fields.length} fields`);
  
  // Map data from table_rows to form_responses
  const responses = [];
  
  for (const field of fields) {
    const value = submission.data[field.field_key];
    
    if (value === undefined || value === null || value === '') {
      continue;
    }
    
    const response: any = {
      submission_id: submission.submission_id,
      field_id: field.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    // Map value based on field type
    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'dropdown':
      case 'radio':
      case 'textarea':
        response.value_text = String(value);
        break;
      
      case 'number':
        response.value_number = typeof value === 'number' ? value : parseFloat(value);
        break;
      
      case 'checkbox':
        response.value_boolean = Boolean(value);
        break;
      
      case 'json':
      case 'repeater':
        response.value_json = typeof value === 'object' ? value : JSON.parse(value);
        break;
      
      default:
        response.value_text = String(value);
    }
    
    responses.push(response);
  }
  
  if (responses.length === 0) {
    console.log(`  ⚠️  No responses to migrate (data fields don't match form fields)`);
    return;
  }
  
  // Insert responses
  const { data, error } = await supabase
    .from('form_responses')
    .insert(responses);
  
  if (error) {
    console.error(`  ❌ Error:`, error.message);
    throw error;
  }
  
  console.log(`  ✅ Migrated ${responses.length} responses`);
}

async function main() {
  console.log('🔄 Starting migration from table_rows to form_responses...\n');
  
  const submissions = await getSubmissionsToMigrate();
  
  if (submissions.length === 0) {
    console.log('✅ No submissions to migrate - all submissions have responses!');
    return;
  }
  
  console.log(`Found ${submissions.length} submissions to migrate:\n`);
  
  for (const submission of submissions) {
    try {
      await migrateSubmission(submission);
    } catch (error) {
      console.error(`Failed to migrate submission ${submission.submission_id}:`, error);
      // Continue with next submission
    }
  }
  
  console.log('\n✅ Migration complete!');
}

main().catch(console.error);
