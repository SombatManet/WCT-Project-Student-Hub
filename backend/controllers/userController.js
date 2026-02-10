const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function registerUser(req, res) {
  try {
    const { username, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);

    const { data, error } = await supabase
      .from('users')
      .insert([{ username, email, password: hashedPassword, role }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    const token = generateToken(data.id);
    res.status(201).json({ user: data, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) return res.status(400).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(400).json({ error: 'Invalid password' });

    const token = generateToken(user.id);
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { registerUser, loginUser };
