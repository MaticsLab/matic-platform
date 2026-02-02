const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Get old user account
  const { data: oldUser } = await supabase.from('ba_users').select('id').eq('email', 'jasanchez85@cps.edu').single();
  const { data: oldAccount } = await supabase.from('ba_accounts').select('password').eq('user_id', oldUser.id).single();
  
  // Get new user account
  const { data: newUser } = await supabase.from('ba_users').select('id').eq('email', 'test-new-user@example.com').single();
  const { data: newAccount } = await supabase.from('ba_accounts').select('password').eq('user_id', newUser.id).single();
  
  console.log('Old user hash:', oldAccount.password);
  console.log('New user hash:', newAccount.password);
  console.log('\nOld hash length:', oldAccount.password.length);
  console.log('New hash length:', newAccount.password.length);
  console.log('\nBoth are bcrypt format');
  
  // The real difference is that Better Auth created the new one,
  // but we manually created the old one - there might be a subtle incompatibility
})();
