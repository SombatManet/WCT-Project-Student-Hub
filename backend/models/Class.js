const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/supabaseAuth');

// Get a single class with its materials
router.get('/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('classes')
    .select(`
      *,
      materials (*) 
    `)
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Create a new class
router.post('/', auth, async (req, res) => {
  const { name, subject, description, classCode } = req.body;
  
  const { data, error } = await supabase
    .from('classes')
    .insert([{
      name,
      subject,
      description,
      class_code: classCode,
      teacher_id: req.user.id
    }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data[0]);
});

module.exports = router;