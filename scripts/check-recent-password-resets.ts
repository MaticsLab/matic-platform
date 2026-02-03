import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRecentPasswordResets() {
  const { data, error } = await supabase
    .from('ba_accounts')
    .select('user_id, password, updated_at')
    .eq('provider_id', 'credential')
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Recent password updates:');
  console.log('='.repeat(80));
  
  data.forEach((acc, index) => {
    const isScrypt = acc.password.includes(':');
    const parts = isScrypt ? acc.password.split(':') : [];
    
    console.log(`\n${index + 1}. User: ${acc.user_id}`);
    console.log(`   Password hash (first 50 chars): ${acc.password.substring(0, 50)}...`);
    console.log(`   Total length: ${acc.password.length} characters`);
    console.log(`   Format: ${isScrypt ? 'scrypt (salt:key)' : 'bcrypt ($2...)'}`);
    
    if (isScrypt) {
      console.log(`   Salt length: ${parts[0].length} chars`);
      console.log(`   Key length: ${parts[1] ? parts[1].length : 0} chars`);
      console.log(`   Expected: salt=32, key=128, total=161 (32+1+128)`);
    }
    
    console.log(`   Updated: ${acc.updated_at}`);
  });
  
  console.log('\n' + '='.repeat(80));
}

checkRecentPasswordResets().catch(console.error);
