const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/supabaseAuth');
const router = express.Router();

router.use(auth);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/assignments');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'assignment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.zip', '.jpg', '.jpeg', '.png'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, ZIP, JPG, PNG files are allowed.'));
    }
  }
});

// Create assignment (teacher only, Supabase-backed)
router.post('/', async (req, res) => {
  try {
    const role = req.user?.role || req.user?.user_metadata?.role;
    if (role !== 'teacher' && role !== 'admin') return res.status(403).json({ status: 'fail', message: 'Only teachers can create assignments' });

    // Accept flexible payload keys (`class` vs `classId`, `dueDate` vs `due_date`, `maxPoints` vs `max_points`)
    const { title, name, description, classId, class: classKey, dueDate, due_date, maxPoints, max_points } = req.body;
    const class_id = classId || classKey || req.body.class_id;
    const due_date_val = dueDate || due_date || null;
    const max_points_val = maxPoints || max_points || 100;

    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const payload = {
      title: title || name,
      description: description || req.body.desc || null,
      class_id,
      teacher_id: req.user.id,
      due_date: due_date_val,
      max_points: max_points_val,
      submissions: []
    };

    console.debug('POST /assignments: insert payload', payload);

    const { data, error } = await adminClient.from('assignments').insert([payload]).select();
    if (error) {
      console.error('POST /assignments: insert error', error);
      throw error;
    }

    res.status(201).json({ status: 'success', data: { assignment: data[0] } });
  } catch (error) {
    console.error('POST /assignments: caught error', error);
    res.status(400).json({ status: 'fail', message: (error && error.message) || 'Failed to create assignment' });
  }
});

// Get assignments for a class
router.get('/class/:classId', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await adminClient.from('assignments').select('*').eq('class_id', req.params.classId).order('created_at', { ascending: false });
    if (error) throw error;

    // Enrich assignments with class and teacher info
    const enrichedAssignments = await Promise.all((data || []).map(async (assignment) => {
      // Fetch class info
      const { data: classData } = await adminClient.from('classes').select('id, name, title, class_name').eq('id', assignment.class_id).single();
      
      // Fetch teacher info
      const { data: teacherData } = await adminClient.from('profiles').select('id, username, email').eq('id', assignment.teacher_id).single();
      
      return {
        ...assignment,
        class: classData ? { id: classData.id, _id: classData.id, name: classData.name || classData.title || classData.class_name } : null,
        teacher: teacherData ? { id: teacherData.id, _id: teacherData.id, username: teacherData.username, email: teacherData.email } : null
      };
    }));

    res.status(200).json({ status: 'success', data: { assignments: enrichedAssignments } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Get specific assignment with submissions
router.get('/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await adminClient.from('assignments').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ status: 'fail', message: 'Assignment not found' });

    res.status(200).json({ status: 'success', data: { assignment: data } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Submit assignment with file upload
router.post('/:id/submit', upload.single('file'), async (req, res) => {
  try {
    console.log('Submit assignment request:', { 
      assignmentId: req.params.id, 
      userId: req.user?.id, 
      hasFile: !!req.file,
      fileName: req.file?.originalname 
    });

    if (!req.file) return res.status(400).json({ status: 'fail', message: 'Please upload a file' });

    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: assignment, error: fetchError } = await adminClient.from('assignments').select('*').eq('id', req.params.id).single();
    
    if (fetchError) {
      console.error('Error fetching assignment:', fetchError);
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ status: 'fail', message: 'Assignment not found: ' + fetchError.message });
    }
    
    if (!assignment) {
      console.log('Assignment not found for ID:', req.params.id);
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ status: 'fail', message: 'Assignment not found' });
    }

    console.log('Found assignment:', { id: assignment.id, title: assignment.title, existingSubmissions: assignment.submissions?.length || 0 });

    const submissions = Array.isArray(assignment.submissions) ? [...assignment.submissions] : [];
    if (submissions.some(s => String(s.student) === String(req.user.id))) {
      console.log('User already submitted this assignment');
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ status: 'fail', message: 'Already submitted this assignment' });
    }

    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const newSubmission = { 
      submission_id: submissionId, 
      _id: submissionId,
      student: req.user.id, 
      file_name: req.file.originalname,
      fileName: req.file.originalname,
      file_path: req.file.filename,
      filePath: req.file.filename,
      file_size: req.file.size,
      fileSize: req.file.size,
      submitted_at: new Date(),
      submittedAt: new Date()
    };
    submissions.push(newSubmission);

    console.log('Updating assignment with new submission');
    const { error: updateError } = await adminClient.from('assignments').update({ submissions }).eq('id', req.params.id);
    if (updateError) {
      console.error('Error updating assignment:', updateError);
      fs.unlinkSync(req.file.path);
      throw updateError;
    }

    console.log('Submission successful');
    res.status(200).json({ status: 'success', message: 'Assignment submitted successfully', data: { submission: newSubmission } });
  } catch (error) {
    console.error('Error in submit assignment:', error);
    if (req.file && fs.existsSync(path.join(uploadsDir, req.file.filename))) {
      fs.unlinkSync(path.join(uploadsDir, req.file.filename));
    }
    res.status(400).json({ status: 'fail', message: error.message || 'Failed to submit assignment' });
  }
});

// Serve uploaded files
router.get('/files/:filename', auth, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) return res.status(404).json({ status: 'fail', message: 'File not found' });

    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: assignments } = await adminClient.from('assignments').select('*');

    // Find submissions that match filename
    const matched = (assignments || []).filter(a => Array.isArray(a.submissions) && a.submissions.some(s => s.file_path === filename || s.filePath === filename));
    if (matched.length === 0) return res.status(404).json({ status: 'fail', message: 'File not found' });

    let hasAccess = false;
    for (const assignment of matched) {
      const submission = (assignment.submissions || []).find(s => s.file_path === filename || s.filePath === filename);
      if (!submission) continue;

      if (req.user.role === 'teacher' && String(assignment.teacher_id) === String(req.user.id)) { hasAccess = true; break; }
      if (req.user.role === 'student' && String(submission.student) === String(req.user.id)) { hasAccess = true; break; }
    }

    if (!hasAccess) return res.status(403).json({ status: 'fail', message: 'Access denied' });

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    res.status(500).json({ status: 'fail', message: 'Error downloading file' });
  }
});

// Grade assignment submission
router.post('/:id/grade', async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ status: 'fail', message: 'Only teachers can grade assignments' });

    const { submissionId, grade, feedback } = req.body;
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: assignment } = await adminClient.from('assignments').select('*').eq('id', req.params.id).single();
    if (!assignment) return res.status(404).json({ status: 'fail', message: 'Assignment not found' });

    if (String(assignment.teacher_id) !== String(req.user.id)) return res.status(403).json({ status: 'fail', message: 'Not authorized to grade this assignment' });

    const submissions = Array.isArray(assignment.submissions) ? [...assignment.submissions] : [];
    const idx = submissions.findIndex(s => s.submission_id === submissionId || s.id === submissionId);
    if (idx === -1) return res.status(404).json({ status: 'fail', message: 'Submission not found' });

    submissions[idx].grade = grade;
    submissions[idx].feedback = feedback;
    submissions[idx].graded_at = new Date();

    const { error } = await adminClient.from('assignments').update({ submissions }).eq('id', req.params.id);
    if (error) throw error;

    res.status(200).json({ status: 'success', message: 'Assignment graded successfully', data: { submission: submissions[idx] } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Delete assignment
router.delete('/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: assignment } = await adminClient.from('assignments').select('*').eq('id', req.params.id).single();
    if (!assignment) return res.status(404).json({ status: 'fail', message: 'Assignment not found' });

    if (req.user.role !== 'teacher' || String(assignment.teacher_id) !== String(req.user.id)) return res.status(403).json({ status: 'fail', message: 'Not authorized to delete this assignment' });

    // Delete associated files
    (assignment.submissions || []).forEach(submission => {
      const filePath = path.join(uploadsDir, submission.file_path || submission.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    const { error } = await adminClient.from('assignments').delete().eq('id', req.params.id);
    if (error) throw error;

    res.status(200).json({ status: 'success', message: 'Assignment deleted successfully' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

module.exports = router;