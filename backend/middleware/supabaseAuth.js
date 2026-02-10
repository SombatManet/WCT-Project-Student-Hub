const supabase = require('../config/supabase');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No valid token provided' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: 'Session expired or invalid' });
    }

    // Always normalize role onto `user.role` so downstream code can check it consistently
    const tokenRole = user.user_metadata?.role || user.role;
    if (tokenRole) {
      user.role = tokenRole;
      user.user_metadata = { ...(user.user_metadata || {}), role: tokenRole };
    }

    // If role still missing, try to fetch from profiles table using service role key
    if (!user.role) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
          const { data: profile } = await adminClient.from('profiles').select('username,role').eq('id', user.id).single();
          if (profile) {
            user.user_metadata = { ...(user.user_metadata || {}), username: profile.username, role: profile.role };
            user.role = profile.role;
          }
        }
      } catch (e) {
        // Non-fatal - continue without profile merge
        console.warn('supabaseAuth: profile lookup failed', e?.message || e);
      }
    }

    // Debug log to help verify role detection during development
    console.debug('supabaseAuth: authenticated user', { id: user.id, role: user.role, username: user.user_metadata?.username });

    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};