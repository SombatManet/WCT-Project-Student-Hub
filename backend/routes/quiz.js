const express = require('express');
const auth = require('../middleware/supabaseAuth');
const router = express.Router();

router.use(auth);

// Create a new quiz (teacher only)
router.post('/', async (req, res) => {
  try {
    const role = req.user?.role || req.user?.user_metadata?.role;
    if (role !== 'teacher' && role !== 'admin') return res.status(403).json({ status: 'fail', message: 'Only teachers can create quizzes' });

    // Accept flexible payload keys (frontend may send different names)
    const { title, name, description, classId, class: classKey, questions, timeLimit } = req.body;
    const class_id = classId || classKey || req.body.class_id;
    const time_limit = timeLimit || time_limit || 30;

    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const payload = {
      title: title || name,
      description: description || req.body.desc || req.body.description || null,
      class_id,
      teacher_id: req.user.id,
      questions: questions || req.body.questions || [],
      time_limit,
      submissions: []
    };

    console.debug('POST /quizzes: insert payload', payload);

    const { data, error } = await adminClient.from('quizzes').insert([payload]).select();
    if (error) {
      console.error('POST /quizzes: insert error', error);
      throw error;
    }

    res.status(201).json({ status: 'success', data: { quiz: data[0] } });
  } catch (error) {
    console.error('POST /quizzes: caught error', error);
    res.status(400).json({ status: 'fail', message: (error && error.message) || 'Failed to create quiz' });
  }
});

// Get quizzes for a class
router.get('/class/:classId', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await adminClient.from('quizzes').select('*').eq('class_id', req.params.classId).order('created_at', { ascending: false });
    if (error) throw error;

    res.status(200).json({ status: 'success', data: { quizzes: data || [] } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Get specific quiz
router.get('/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: quiz, error } = await adminClient.from('quizzes').select('*').eq('id', req.params.id).single();
    if (error || !quiz) return res.status(404).json({ status: 'fail', message: 'Quiz not found' });

    res.status(200).json({ status: 'success', data: { quiz } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Submit quiz answers
router.post('/:id/submit', async (req, res) => {
  try {
    const { answers } = req.body;
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: quiz } = await adminClient.from('quizzes').select('*').eq('id', req.params.id).single();
    if (!quiz) return res.status(404).json({ status: 'fail', message: 'Quiz not found' });

    // Calculate score and detailed results
    let score = 0;
    const results = (quiz.questions || []).map((question, index) => {
      const isCorrect = question.correctAnswer === (answers && answers[index]);
      if (isCorrect) score += question.points || 1;
      return { questionIndex: index, correct: isCorrect, correctAnswer: question.correctAnswer, userAnswer: answers && answers[index], points: question.points || 1 };
    });

    // Check if already submitted
    const submissions = Array.isArray(quiz.submissions) ? [...quiz.submissions] : [];
    const existing = submissions.find(sub => String(sub.student) === String(req.user.id));
    if (existing) return res.status(400).json({ status: 'fail', message: 'Already submitted this quiz' });

    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const newSubmission = { submission_id: submissionId, student: req.user.id, answers, score, results, submitted_at: new Date() };
    submissions.push(newSubmission);

    const { error } = await adminClient.from('quizzes').update({ submissions }).eq('id', req.params.id);
    if (error) throw error;

    res.status(200).json({ status: 'success', data: { score, totalQuestions: (quiz.questions || []).length, maxPoints: (quiz.questions || []).reduce((s,q) => s + (q.points || 1), 0), results } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Get student's quiz submission details
router.get('/:id/submission', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: quiz } = await adminClient.from('quizzes').select('*').eq('id', req.params.id).single();
    if (!quiz) return res.status(404).json({ status: 'fail', message: 'Quiz not found' });

    const submission = (quiz.submissions || []).find(sub => String(sub.student) === String(req.user.id));
    if (!submission) return res.status(404).json({ status: 'fail', message: 'No submission found for this quiz' });

    res.status(200).json({ status: 'success', data: { quiz: { id: quiz.id, title: quiz.title, description: quiz.description, questions: quiz.questions, timeLimit: quiz.time_limit, teacher: quiz.teacher_id, class: quiz.class_id }, submission } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Get quiz results (Teacher only) - View all student submissions
router.get('/:id/results', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: quiz } = await adminClient.from('quizzes').select('*').eq('id', req.params.id).single();
    if (!quiz) return res.status(404).json({ status: 'fail', message: 'Quiz not found' });

    if (req.user.role !== 'teacher' || String(quiz.teacher_id) !== String(req.user.id)) return res.status(403).json({ status: 'fail', message: 'Not authorized to view these results' });

    // Enrich submissions with student profile data
    const submissionsWithStudents = [];
    if (quiz.submissions && quiz.submissions.length > 0) {
      const studentIds = quiz.submissions.map(sub => sub.student).filter(Boolean);
      if (studentIds.length > 0) {
        const { data: profiles } = await adminClient
          .from('profiles')
          .select('id,username,email')
          .in('id', studentIds);
        
        const profilesMap = {};
        (profiles || []).forEach(p => {
          profilesMap[p.id] = p;
        });

        submissionsWithStudents.push(...quiz.submissions.map(sub => ({
          ...sub,
          _id: sub.submission_id || `sub_${Date.now()}`,
          student: profilesMap[sub.student] || { id: sub.student, username: 'Unknown', email: 'N/A' }
        })));
      }
    }

    const totalStudents = submissionsWithStudents.length;
    const averageScore = totalStudents > 0 ? (submissionsWithStudents.reduce((sum, sub) => sum + (sub.score || 0), 0) / totalStudents) : 0;
    const maxPoints = (quiz.questions || []).reduce((s,q) => s + (q.points || 1), 0);

    res.status(200).json({ status: 'success', data: { quiz: { id: quiz.id, title: quiz.title, description: quiz.description, questions: quiz.questions, timeLimit: quiz.time_limit, class: quiz.class_id, teacher: quiz.teacher_id }, submissions: submissionsWithStudents, statistics: { totalStudents, averageScore: Math.round(averageScore * 100) / 100, maxPoints, averagePercentage: Math.round((averageScore / maxPoints) * 100) } } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Get detailed student submission (Teacher view)
router.get('/:quizId/submissions/:studentId', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: quiz } = await adminClient.from('quizzes').select('*').eq('id', req.params.quizId).single();
    if (!quiz) return res.status(404).json({ status: 'fail', message: 'Quiz not found' });

    if (req.user.role !== 'teacher' || String(quiz.teacher_id) !== String(req.user.id)) return res.status(403).json({ status: 'fail', message: 'Not authorized to view these results' });

    const submission = (quiz.submissions || []).find(sub => String(sub.student) === String(req.params.studentId));
    if (!submission) return res.status(404).json({ status: 'fail', message: 'Submission not found' });

    res.status(200).json({ status: 'success', data: { quiz: { id: quiz.id, title: quiz.title, questions: quiz.questions }, submission, studentId: req.params.studentId } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Delete quiz (Teacher only)
router.delete('/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: quiz } = await adminClient.from('quizzes').select('id,teacher_id').eq('id', req.params.id).single();
    if (!quiz) return res.status(404).json({ status: 'fail', message: 'Quiz not found' });

    if (req.user.role !== 'teacher' || String(quiz.teacher_id) !== String(req.user.id)) return res.status(403).json({ status: 'fail', message: 'Not authorized to delete this quiz' });

    const { error } = await adminClient.from('quizzes').delete().eq('id', req.params.id);
    if (error) throw error;

    res.status(200).json({ status: 'success', message: 'Quiz deleted successfully' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

module.exports = router;