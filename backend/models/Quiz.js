const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const auth = require('../middleware/supabaseAuth');

// Get a full quiz with all its questions
router.get('/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('quizzes')
    .select(`
      *,
      quiz_questions (*)
    `)
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Submit a quiz attempt
router.post('/:id/submit', auth, async (req, res) => {
  const { answers, score } = req.body;
  
  const { data, error } = await supabase
    .from('quiz_submissions')
    .insert([{
      quiz_id: req.params.id,
      student_id: req.user.id,
      answers,
      score
    }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data[0]);
});

module.exports = router;