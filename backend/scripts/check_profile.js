const supabase = require('../config/supabase');

(async () => {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: node scripts/check_profile.js <userId>');
    process.exit(1);
  }

  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) {
      console.error('Error fetching profile:', error.message || error);
      process.exit(2);
    }
    console.log('Profile found:', data);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(3);
  }
})();