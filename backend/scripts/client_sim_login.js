const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in env');
  process.exit(1);
}

(async () => {
  const supabase = createClient(url, anonKey);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'superadmin@example.com',
      password: 'StrongP@ssw0rd'
    });
    if (error) {
      console.error('SignIn error:', error);
      process.exit(2);
    }
    console.log('Signed in user id:', data.user.id);

    // Now call server-side profile endpoint using the access token as the client would
    const token = data.session.access_token;
    const res = await fetch(`http://localhost:5000/api/auth/profile/${data.user.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await res.json();
    console.log('Server profile endpoint response:', res.status, body);

  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(4);
  }
})();