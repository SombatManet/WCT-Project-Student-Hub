const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url) throw new Error('SUPABASE_URL missing in env');

const keyToUse = serviceKey || anonKey;
console.log(`Using Supabase key: ${serviceKey ? 'SERVICE_ROLE_KEY' : 'ANON_KEY'}`);

const supabase = createClient(url, keyToUse, { auth: { persistSession: false } });

module.exports = supabase;