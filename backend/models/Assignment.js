const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/supabaseAuth');

// Get all assignments for a specific class
router.get('/class/:classId', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('class_id', req.params.classId);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Create a new assignment
router.post('/', auth, async (req, res) => {
  const { title, description, class_id, due_date, max_points } = req.body;
  
  const { data, error } = await supabase
    .from('assignments')
    .insert([{
      title,
      description,
      class_id,
      teacher_id: req.user.id, // ID from your supabaseAuth middleware
      due_date,
      max_points
    }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data[0]);
});

module.exports = router;