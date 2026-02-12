const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bpvdnphvunezonyrjwub.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwdmRucGh2dW5lem9ueXJqd3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNjYwNjEsImV4cCI6MjA3NTY0MjA2MX0.61XNqx0Lqm_P_p8mypVsyU2U4LdoOWxEa8BxgkGZp74';
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('\n=== Checking form_submissions table ===\n');
  
  // Check submissions with ba_user_id
  const { data: baData, error: baError } = await supabase
    .from('form_submissions')
    .select('id, user_id, ba_user_id, form_id, status')
    .not('ba_user_id', 'is', null)
    .limit(5);
  
  console.log('Submissions with ba_user_id set:', baData ? baData.length : 0);
  if (baData && baData.length > 0) {
    baData.forEach(d => {
      console.log(`  - ba_user_id: ${d.ba_user_id}, user_id: ${d.user_id}, form: ${d.form_id}`);
    });
  }
  
  // Check submissions with user_id only
  const { data: userIdData, error: userIdError } = await supabase
    .from('form_submissions')
    .select('id, user_id, ba_user_id, form_id, status')
    .is('ba_user_id', null)
    .not('user_id', 'is', null)
    .limit(5);
  
  console.log('\nSubmissions with user_id only (legacy):', userIdData ? userIdData.length : 0);
  if (userIdData && userIdData.length > 0) {
    userIdData.forEach(d => {
      console.log(`  - user_id: ${d.user_id}, ba_user_id: ${d.ba_user_id}, form: ${d.form_id}`);
    });
  }
  
  // Check specific form_id for Logan Scholarship
  const formId = '9fec1d59-9b92-4280-8630-b5b5ba8275d8';
  const { data: loganData, error: loganError } = await supabase
    .from('forms')
    .select('id, legacy_table_id')
    .or(`id.eq.${formId},legacy_table_id.eq.${formId}`)
    .single();
  
  console.log('\n=== Logan Scholarship Form ===');
  if (loganData) {
    console.log('Form ID:', loganData.id);
    console.log('Legacy Table ID:', loganData.legacy_table_id);
    
    // Check submissions for this form
    const { data: submissions, error: subError } = await supabase
      .from('form_submissions')
      .select('id, user_id, ba_user_id, status, raw_data')
      .eq('form_id', loganData.id);
    
    console.log(`\nSubmissions for this form: ${submissions ? submissions.length : 0}`);
    if (submissions && submissions.length > 0) {
      submissions.forEach(s => {
        const dataSize = s.raw_data ? Object.keys(s.raw_data).length : 0;
        console.log(`  - ID: ${s.id}, ba_user_id: ${s.ba_user_id}, user_id: ${s.user_id}, status: ${s.status}, raw_data fields: ${dataSize}`);
      });
    }
  } else {
    console.log('Error finding form:', loganError?.message);
  }
})();
