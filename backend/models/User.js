const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const User = {
  // Sign up a new user (Supabase handles password hashing automatically)
  async signUp(email, password, username, role = 'student') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          role
        }
      }
    });

    if (error) throw error;
    return data;
  },

  // Get user profile data
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  // Update points
  async addPoints(userId, amount) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ points: amount })
      .eq('id', userId);

    if (error) throw error;
    return data;
  }
};

module.exports = User;