const express = require('express');
const User = require('../models/User');
const Class = require('../models/Class');
const Assignment = require('../models/Assignment');
const Quiz = require('../models/Quiz');
const auth = require('../middleware/supabaseAuth');
const router = express.Router();
const supabaseClient = require('../config/supabase');

// Helper: resolve existing table by attempting a direct select
async function resolveExistingTable(adminClient, candidates) {
  for (const c of candidates) {
    try {
      const { data, error } = await adminClient.from(c).select('id').limit(1);
      // If no error, table exists regardless of rows
      if (!error) return c;
      // If error is clearly "table does not exist", continue
      const msg = String(error?.message || '');
      if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema')) {
        continue;
      }
      // Any other error: treat as exists to avoid false negatives with RLS
      return c;
    } catch (e) {
      // continue to next candidate
    }
  }
  return null;
}

// Helper: pick a reasonable sort column if present
async function getPreferredSortColumn(adminClient, table) {
  try {
    const { data } = await adminClient
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', table);
    const cols = (data || []).map(c => c.column_name);
    const preferred = ['created_at', 'createdAt', 'created_on', 'inserted_at', 'id'];
    return preferred.find(n => cols.includes(n)) || null;
  } catch (e) {
    return null;
  }
}

// Bootstrap admin (development-only). Protect with ADMIN_BOOTSTRAP_TOKEN env var.
router.post('/bootstrap-admin', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ status: 'fail', message: 'Bootstrap disabled in production' });
    }

    const token = req.headers['x-admin-bootstrap-token'];
    if (!process.env.ADMIN_BOOTSTRAP_TOKEN || token !== process.env.ADMIN_BOOTSTRAP_TOKEN) {
      return res.status(403).json({ status: 'fail', message: 'Missing or invalid bootstrap token. Set ADMIN_BOOTSTRAP_TOKEN in backend .env and send it in header `x-admin-bootstrap-token`' });
    }

    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ status: 'fail', message: 'username, email and password are required' });
    }

    // Create admin via admin API
    const { data, error } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      user_metadata: { username, role: 'admin' },
      email_confirm: true
    });
    if (error) throw error;
    const userId = data?.user?.id || data?.id || (data?.user && data.user.id);

    // Insert into profiles
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .insert([{ id: userId, username, email, role: 'admin', points: 0 }]);
    if (profileError) throw profileError;

    res.status(201).json({ status: 'success', message: 'Admin created', data: { id: userId, email } });
  } catch (error) {
    console.error('Bootstrap admin error:', error);
    res.status(error?.status || 400).json({ status: 'fail', message: error?.message || 'Could not bootstrap admin' });
  }
});

// Admin middleware
const requireAdmin = async (req, res, next) => {
  try {
    // 1. Check top-level or user_metadata role present on the token
    const tokenRole = req.user?.user_metadata?.role || req.user?.role;
    console.debug('requireAdmin: tokenRole=', tokenRole, 'req.user.id=', req.user?.id);
    // Allow both 'admin' and 'superadmin' to pass this middleware
    if (tokenRole === 'admin' || tokenRole === 'superadmin') return next();

    // 2. Fallback: query profiles table using service role key
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('requireAdmin: missing SUPABASE_SERVICE_ROLE_KEY');
      return res.status(403).json({ status: 'fail', message: 'Admin access required' });
    }

    const { createClient } = require('@supabase/supabase-js');
    const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await adminClient.from('profiles').select('role').eq('id', req.user.id).single();
    console.debug('requireAdmin: profileLookup=', data, 'error=', error);
    // Allow profile role of either 'admin' or 'superadmin'
    if (error || (data?.role !== 'admin' && data?.role !== 'superadmin')) {
      return res.status(403).json({ status: 'fail', message: 'Admin access required' });
    }

    return next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    return res.status(500).json({ status: 'fail', message: 'Internal Server Error' });
  }
};

// Require superadmin middleware for sensitive operations
const requireSuperAdmin = async (req, res, next) => {
  try {
    const tokenRole = req.user?.user_metadata?.role || req.user?.role;
    if (tokenRole === 'superadmin') return next();

    // Fallback: check profiles table with service role key
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(403).json({ status: 'fail', message: 'Superadmin access required' });
    }

    const { createClient } = require('@supabase/supabase-js');
    const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await adminClient.from('profiles').select('role').eq('id', req.user.id).single();
    if (error || data?.role !== 'superadmin') {
      return res.status(403).json({ status: 'fail', message: 'Superadmin access required' });
    }

    return next();
  } catch (err) {
    console.error('requireSuperAdmin error:', err);
    return res.status(500).json({ status: 'fail', message: 'Internal Server Error' });
  }
};

router.use(auth);
router.use(requireAdmin);

// ==================== USER MANAGEMENT ====================

// Get users (supports optional role and search filters)
router.get('/users', async (req, res) => {
  try {
    const { role, search } = req.query;
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const allowedRoles = ['student', 'teacher', 'admin', 'superadmin', 'all'];
    let query = adminClient.from('profiles').select('id,username,email,role,points,created_at');

    if (role && role !== 'all') {
      if (!allowedRoles.includes(role)) return res.status(400).json({ status: 'fail', message: 'Invalid role filter' });
      query = query.eq('role', role);
    } else {
      // Default behavior: return students and teachers only
      query = query.in('role', ['student', 'teacher']);
    }

    if (search) {
      // Use ilike for case-insensitive partial match across username and email
      const s = `%${String(search).trim()}%`;
      query = query.or(`username.ilike.${s},email.ilike.${s}`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    // Calculate dynamic points for each student from quiz and assignment submissions
    const usersWithPoints = await Promise.all((data || []).map(async (user) => {
      if (user.role !== 'student') {
        return { ...user, points: 0 };
      }

      let totalPoints = 0;

      try {
        // Get quiz points: sum all quiz submission scores
        const { data: quizzes } = await adminClient.from('quizzes').select('submissions');
        if (quizzes && quizzes.length > 0) {
          quizzes.forEach(quiz => {
            const submissions = quiz.submissions || [];
            submissions.forEach(sub => {
              if (String(sub.student) === String(user.id)) {
                totalPoints += (sub.score || 0);
              }
            });
          });
        }

        // Get assignment points: sum all assignment grades
        const { data: assignments } = await adminClient.from('assignments').select('submissions');
        if (assignments && assignments.length > 0) {
          assignments.forEach(assignment => {
            const submissions = assignment.submissions || [];
            submissions.forEach(sub => {
              if (String(sub.student) === String(user.id) && sub.grade !== undefined && sub.grade !== null) {
                totalPoints += sub.grade;
              }
            });
          });
        }
      } catch (e) {
        console.error('Error calculating points for user', user.id, e);
      }

      return { ...user, points: totalPoints };
    }));

    res.status(200).json({ status: 'success', data: { users: usersWithPoints } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Create new user (student or teacher)
router.post('/users', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!['student', 'teacher'].includes(role)) {
      return res.status(400).json({ status: 'fail', message: 'Role must be either student or teacher' });
    }

    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Check if profile already exists
    const { data: existing, error: existingError } = await adminClient.from('profiles').select('id').or(`email.eq.${email},username.eq.${username}`).limit(1);
    if (existingError) throw existingError;
    if (existing && existing.length > 0) {
      return res.status(400).json({ status: 'fail', message: 'User already exists' });
    }

    // Create auth user using admin API
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      user_metadata: { username, role },
      email_confirm: true
    });
    if (error) throw error;
    const userId = data?.user?.id || data?.id || (data?.user && data.user.id);

    // Insert into profiles
    const { error: profileError } = await adminClient.from('profiles').insert([{ id: userId, username, email, role, points: 0 }]);
    if (profileError) throw profileError;

    res.status(201).json({ status: 'success', message: `${role} created successfully`, data: { id: userId, username, email, role } });
  } catch (error) {
    console.error('Admin create user error:', error);
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Admin: Create user (any role including admin) - protected endpoint
router.post('/create-user', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ status: 'fail', message: 'username, email, password and role are required' });
    }

    const allowedRoles = ['student', 'teacher', 'admin', 'superadmin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ status: 'fail', message: 'role must be student, teacher, admin, or superadmin' });
    }

    // Only an existing superadmin may create admin or superadmin accounts
    const requesterRole = req.user?.user_metadata?.role || req.user?.role;
    if (['admin', 'superadmin'].includes(role) && requesterRole !== 'superadmin') {
      return res.status(403).json({ status: 'fail', message: 'Only superadmin can create admin or superadmin accounts' });
    }

    // Check if user already exists in profiles
    const { data: existing, error: existingError } = await require('../config/supabase').from('profiles')
      .select('id')
      .or(`email.eq.${email},username.eq.${username}`)
      .limit(1);

    if (existingError) throw existingError;
    if (existing && existing.length > 0) {
      return res.status(400).json({ status: 'fail', message: 'User already exists' });
    }

    // Must have service role key to create admin users via Supabase admin API
    const supabaseClient = require('../config/supabase');
    let userId;

    if (role === 'admin' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'fail', message: 'SUPABASE_SERVICE_ROLE_KEY required to create admin users' });
    }

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Use admin API to create users (can set role in user_metadata)
      const { data, error } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        user_metadata: { username, role },
        email_confirm: true
      });
      if (error) throw error;
      userId = data?.user?.id || data?.id || (data?.user && data.user.id);
    } else {
      // Fallback for non-admin roles: sign up the user (will require email verification)
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { username, role }
        }
      });
      if (error) throw error;
      userId = data?.user?.id;
    }

    // Insert into profiles table
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .insert([{ id: userId, username, email, role, points: 0 }]);

    if (profileError) throw profileError;

    res.status(201).json({ status: 'success', message: `${role} created`, data: { id: userId, username, email, role } });
  } catch (error) {
    console.error('Admin create-user error:', error);
    res.status(error?.status || 400).json({ status: 'fail', message: error?.message || 'Could not create user' });
  }
});

// Update user role (Supabase-backed)
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;

    // Allowed roles in general
    const baseAllowed = ['student', 'teacher'];
    const elevatedAllowed = ['admin', 'superadmin'];

    // If trying to set an elevated role, require the requester to be superadmin
    const requesterRole = req.user?.user_metadata?.role || req.user?.role;
    if (elevatedAllowed.includes(role) && requesterRole !== 'superadmin') {
      return res.status(403).json({ status: 'fail', message: 'Only superadmin can assign admin or superadmin roles' });
    }

    const allowedRoles = baseAllowed.concat(requesterRole === 'superadmin' ? elevatedAllowed : []);
    if (!allowedRoles.includes(role)) return res.status(400).json({ status: 'fail', message: `Role must be one of: ${allowedRoles.join(', ')}` });

    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await adminClient.from('profiles').update({ role }).eq('id', req.params.id).select();
    if (error) throw error;

    // Also update auth user_metadata if admin API is available
    try {
      if (adminClient.auth && adminClient.auth.admin && adminClient.auth.admin.updateUserById) {
        await adminClient.auth.admin.updateUserById(req.params.id, { user_metadata: { role } });
      }
    } catch (e) {
      // non-fatal
      console.warn('Could not update auth user metadata', e?.message || e);
    }

    res.status(200).json({ status: 'success', message: `User role updated to ${role}`, data: { user: data?.[0] || null } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Reset user password (admin only)
router.patch('/users/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ status: 'fail', message: 'New password must be at least 6 characters' });
    }

    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Update password using admin API
    const { error } = await adminClient.auth.admin.updateUserById(
      req.params.id,
      { password: newPassword }
    );

    if (error) throw error;

    res.status(200).json({ 
      status: 'success', 
      message: 'Password reset successfully',
      data: { userId: req.params.id }
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({ status: 'fail', message: error.message || 'Failed to reset password' });
  }
});

// Get user stats and comprehensive info (admin only)
router.get('/users/:id/stats', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const userId = req.params.id;

    // Get user profile
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // Initialize stats
    const stats = {
      profile,
      classCount: 0,
      assignmentCount: 0,
      quizCount: 0,
      messagesSent: 0,
      messagesReceived: 0,
      totalPoints: 0,
      submittedAssignments: 0,
      completedQuizzes: 0
    };

    // Get classes (student or teacher)
    if (profile.role === 'teacher') {
      const { data: classes } = await adminClient
        .from('classes')
        .select('id')
        .eq('teacher_id', userId);
      stats.classCount = classes?.length || 0;
    } else if (profile.role === 'student') {
      // Try class_students table first
      const { data: enrolls, error: enrollErr } = await adminClient
        .from('class_students')
        .select('class_id')
        .eq('student_id', userId);
      if (!enrollErr && enrolls) {
        stats.classCount = enrolls.length;
      } else {
        // Fallback to classes.students array
        const { data: classes } = await adminClient
          .from('classes')
          .select('id,students');
        const enrolledClasses = (classes || []).filter(c => 
          Array.isArray(c.students) && c.students.map(String).includes(String(userId))
        );
        stats.classCount = enrolledClasses.length;
      }
    }

    // Get assignments
    if (profile.role === 'teacher') {
      const { data: assignments } = await adminClient
        .from('assignments')
        .select('id')
        .eq('teacher_id', userId);
      stats.assignmentCount = assignments?.length || 0;
    } else if (profile.role === 'student') {
      // Count submitted assignments
      const { data: assignments } = await adminClient
        .from('assignments')
        .select('submissions');
      
      let submitted = 0;
      let totalGrade = 0;
      
      assignments?.forEach(assignment => {
        const submissions = assignment.submissions || [];
        const userSubmission = submissions.find(s => String(s.student) === String(userId));
        if (userSubmission) {
          submitted++;
          if (userSubmission.grade) {
            totalGrade += userSubmission.grade;
          }
        }
      });
      
      stats.submittedAssignments = submitted;
      stats.totalPoints += totalGrade;
    }

    // Get quizzes
    if (profile.role === 'teacher') {
      const { data: quizzes } = await adminClient
        .from('quizzes')
        .select('id')
        .eq('teacher_id', userId);
      stats.quizCount = quizzes?.length || 0;
    } else if (profile.role === 'student') {
      // Count completed quizzes
      const { data: quizzes } = await adminClient
        .from('quizzes')
        .select('submissions');
      
      let completed = 0;
      let totalScore = 0;
      
      quizzes?.forEach(quiz => {
        const submissions = quiz.submissions || [];
        const userSubmission = submissions.find(s => String(s.student) === String(userId));
        if (userSubmission) {
          completed++;
          if (userSubmission.score) {
            totalScore += userSubmission.score;
          }
        }
      });
      
      stats.completedQuizzes = completed;
      stats.totalPoints += totalScore;
    }

    // Get messages
    const { data: sentMessages } = await adminClient
      .from('personal_messages')
      .select('id')
      .eq('sender_id', userId);
    stats.messagesSent = sentMessages?.length || 0;

    const { data: receivedMessages } = await adminClient
      .from('personal_messages')
      .select('id')
      .eq('recipient_id', userId);
    stats.messagesReceived = receivedMessages?.length || 0;

    res.status(200).json({ status: 'success', data: stats });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(400).json({ status: 'fail', message: error.message || 'Failed to fetch user stats' });
  }
});

// Get recent personal messages for a specific user (admin only)
router.get('/users/:id/messages', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const userId = req.params.id;
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 10));

    // Fetch messages where the user is sender or recipient
    const { data: messages, error } = await adminClient
      .from('personal_messages')
      .select('id, sender_id, recipient_id, message, created_at')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Load counterpart profile usernames
    const ids = Array.from(new Set((messages || []).flatMap(m => [m.sender_id, m.recipient_id])));
    let profilesMap = {};
    if (ids.length) {
      const { data: profiles } = await adminClient
        .from('profiles')
        .select('id,username,email')
        .in('id', ids);
      (profiles || []).forEach(p => { profilesMap[p.id] = p.username || (p.email ? p.email.split('@')[0] : 'User'); });
    }

    const items = (messages || []).map(m => ({
      id: m.id,
      title: String(m.sender_id) === String(userId)
        ? `You → ${profilesMap[m.recipient_id] || 'User'}`
        : `${profilesMap[m.sender_id] || 'User'} → You`,
      content: (m.message || '').slice(0, 120),
      created_at: m.created_at,
      sender_id: m.sender_id,
      recipient_id: m.recipient_id
    }));

    res.status(200).json({ status: 'success', data: { messages: items } });
  } catch (error) {
    console.error('Get user messages error:', error);
    res.status(400).json({ status: 'fail', message: error.message || 'Failed to fetch messages' });
  }
});

// Delete user (Supabase-backed)
router.delete('/users/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Delete profile row
    const { error: profileError } = await adminClient.from('profiles').delete().eq('id', req.params.id);
    if (profileError) throw profileError;

    // Try to delete auth user via admin API (best-effort)
    try {
      if (adminClient.auth && adminClient.auth.admin && adminClient.auth.admin.deleteUser) {
        await adminClient.auth.admin.deleteUser(req.params.id);
      }
    } catch (e) {
      console.warn('Could not delete auth user:', e?.message || e);
    }

    res.status(200).json({ status: 'success', message: 'User deleted successfully' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// ==================== CLASS MANAGEMENT (Supabase-backed) ====================

// Get all classes
router.get('/classes', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    let data, error;
    try {
      const { data: cols } = await adminClient.from('information_schema.columns').select('column_name').eq('table_name', 'classes');
      const names = (cols || []).map(c => c.column_name);
      const preferred = ['created_at', 'createdAt', 'created_on', 'inserted_at', 'id'];
      const sortCol = preferred.find(n => names.includes(n));
      const query = adminClient.from('classes').select('*');
      if (sortCol) {
        ({ data, error } = await query.order(sortCol, { ascending: false }));
      } else {
        ({ data, error } = await query);
      }
    } catch (e) {
      ({ data, error } = await adminClient.from('classes').select('*'));
    }
    if (error) throw error;

    // Fetch teacher info for each class
    const teacherIds = [...new Set((data || []).map(c => c.teacher_id).filter(Boolean))];
    const teachersMap = {};
    if (teacherIds.length > 0) {
      const { data: teachers } = await adminClient.from('profiles').select('id, username, email').in('id', teacherIds);
      if (teachers) {
        teachers.forEach(t => { teachersMap[t.id] = t; });
      }
    }

    // Fetch student enrollments for each class
    const classIds = (data || []).map(c => c.id);
    const enrollmentsMap = {};
    if (classIds.length > 0) {
      const { data: enrollments } = await adminClient.from('class_students').select('class_id, student_id').in('class_id', classIds);
      if (enrollments) {
        enrollments.forEach(e => {
          if (!enrollmentsMap[e.class_id]) enrollmentsMap[e.class_id] = [];
          enrollmentsMap[e.class_id].push(e.student_id);
        });
      }
    }

    const classesWithDetails = (data || []).map(c => ({
      ...c,
      invite_link: c.invite_code ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join/${c.invite_code}` : null,
      teacher: teachersMap[c.teacher_id] || null,
      students_count: (enrollmentsMap[c.id] || []).length,
      enrolled_student_ids: enrollmentsMap[c.id] || []
    }));
    res.status(200).json({ status: 'success', data: { classes: classesWithDetails } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Get single class (with invite_link)
router.get('/classes/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await adminClient.from('classes').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ status: 'fail', message: 'Class not found' });

    const invite_link = data.invite_code ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join/${data.invite_code}` : null;
    res.status(200).json({ status: 'success', data: { class: { ...data, invite_link } } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Admin create class
// Update class (admin)
router.patch('/classes/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { id } = req.params;
    const { name, title, class_name, subject, description, teacherId, students } = req.body;
    // Check if class exists
    const { data: existing, error: existingError } = await adminClient.from('classes').select('*').eq('id', id).single();
    if (existingError || !existing) return res.status(404).json({ status: 'fail', message: 'Class not found' });
    // Build update payload
    const updatePayload = {};
    if (name) updatePayload.name = name;
    if (title) updatePayload.title = title;
    if (class_name) updatePayload.class_name = class_name;
    if (subject) updatePayload.subject = subject;
    if (description) updatePayload.description = description;
    if (teacherId) updatePayload.teacher_id = teacherId;
    if (Array.isArray(students)) updatePayload.students = students;
    const { data, error } = await adminClient.from('classes').update(updatePayload).eq('id', id).select();
    if (error) throw error;
    res.status(200).json({ status: 'success', data: { class: data[0] } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});
router.post('/classes', async (req, res) => {
  try {
    // Accept multiple possible name fields from different frontends/schemas
    const incomingName = req.body.name || req.body.title || req.body.className || req.body.class_name;
    const { subject, description, teacherId } = req.body;

    // Basic validation
    if (!incomingName) return res.status(400).json({ status: 'fail', message: 'Class name is required' });
    if (!teacherId) return res.status(400).json({ status: 'fail', message: 'teacherId is required to create a class' });

    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Verify teacher exists and has role teacher (if provided)
    if (teacherId) {
      const { data: teacher, error: tErr } = await adminClient.from('profiles').select('id,role').eq('id', teacherId).single();
      if (tErr || !teacher) return res.status(404).json({ status: 'fail', message: 'Teacher not found' });
      if (teacher.role !== 'teacher') return res.status(400).json({ status: 'fail', message: 'Provided user is not a teacher' });
    }



    const classCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Generate a short unique invite code for student invitations (used in join links)
    let inviteCode = null;
    let inviteAttempts = 0;
    while (!inviteCode && inviteAttempts < 6) {
      const candidate = Math.random().toString(36).substring(2, 8).toUpperCase();
      try {
        const { data: existingInvite } = await adminClient.from('classes').select('id').eq('invite_code', candidate).limit(1);
        if (!existingInvite || existingInvite.length === 0) inviteCode = candidate;
      } catch (e) {
        // ignore transient permission/info errors and accept the candidate
        inviteCode = candidate;
      }
      inviteAttempts++;
    }

    console.debug('admin.createClass: admin=', req.user?.id, 'teacher=', teacherId, 'payload=', { incomingName, subject, description, inviteCode });

    // Determine whether certain columns exist on classes table (flexible mapping)
    let classesHasStudentsCol = false;
    let classesHasInviteCol = false;
    let classesNameColumn = null; // will hold actual column name for the class title/name

    try {
      const { data: cols } = await adminClient.from('information_schema.columns').select('column_name').eq('table_name', 'classes');
      const colNames = (cols || []).map(c => c.column_name);
      if (colNames.includes('students')) classesHasStudentsCol = true;
      if (colNames.includes('invite_code')) classesHasInviteCol = true;
      // Prefer title -> name -> class_name
      if (colNames.includes('title')) classesNameColumn = 'title';
      else if (colNames.includes('name')) classesNameColumn = 'name';
      else if (colNames.includes('class_name')) classesNameColumn = 'class_name';
    } catch (e) {
      console.warn('Could not determine classes schema via information_schema:', e?.message || e);
    }


    // Build insert payload using only columns that exist
    let createdClass = null;
    let lastInsertError = null;

    // Only use columns that exist: prefer 'name', fallback to classesNameColumn if detected
    let nameCol = 'name';
    if (classesNameColumn && classesNameColumn !== 'name') nameCol = classesNameColumn;
    const payloadAttempt = { subject, description, class_code: classCode };
    if (teacherId) payloadAttempt.teacher_id = teacherId;
    if (classesHasStudentsCol && Array.isArray(req.body.students) && req.body.students.length) payloadAttempt.students = req.body.students;
    if (classesHasInviteCol) payloadAttempt.invite_code = inviteCode || null;
    payloadAttempt[nameCol] = incomingName;
    try {
      const { data: attemptData, error: attemptErr } = await adminClient.from('classes').insert([payloadAttempt]).select();
      if (!attemptErr && attemptData && attemptData.length) {
        createdClass = attemptData[0];
      } else {
        lastInsertError = attemptErr;
      }
    } catch (e) {
      lastInsertError = e;
    }

    if (!createdClass) {
      console.error('admin.createClass error: insert failed', lastInsertError, 'payload=', payloadAttempt);
      throw lastInsertError || new Error('Could not insert class; unknown schema');
    }

    if (!createdClass) {
      console.error('admin.createClass error: all insert attempts failed', lastInsertError, 'candidates=', nameCandidates);
      throw lastInsertError || new Error('Could not insert class; unknown schema');
    }

    // If we couldn't store invite_code on classes table, try storing in a dedicated invite table
    if (!classesHasInviteCol && inviteCode && createdClass && createdClass.id) {
      try {
        const { data: tableCols } = await adminClient.from('information_schema.tables').select('table_name').eq('table_name', 'class_invites');
        if (tableCols && tableCols.length) {
          const { error: inviteErr } = await adminClient.from('class_invites').insert([{ class_id: createdClass.id, invite_code: inviteCode }]);
          if (inviteErr) console.warn('Failed to insert class_invites row:', inviteErr.message || inviteErr);
        }
      } catch (e) {
        console.warn('Could not insert into class_invites table:', e?.message || e);
      }
    }



    const inviteLink = (createdClass && (createdClass.invite_code || inviteCode)) ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join/${createdClass.invite_code || inviteCode}` : null;
    res.status(201).json({ status: 'success', data: { class: createdClass, invite_code: createdClass?.invite_code || inviteCode, invite_link: inviteLink } });
  } catch (error) {
    // Improve error clarity for missing columns due to DB triggers (e.g., NEW.title)
    const msg = String(error?.message || 'Unknown error');
    if (msg.includes("record 'new' has no field 'title'") || msg.includes('NEW.title')) {
      return res.status(409).json({
        status: 'fail',
        message: 'Database trigger expects a title column on classes. Please add a title column or update the trigger to use COALESCE(title, name, class_name).',
        hint: 'Run a migration to add classes.title or update triggers; app insert already uses name/title fallbacks.'
      });
    }
    res.status(error?.status || 400).json({ status: 'fail', message: msg });
  }
});

// Delete class
router.delete('/classes/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: existing, error: existingError } = await adminClient.from('classes').select('id').eq('id', req.params.id).single();
    if (existingError || !existing) return res.status(404).json({ status: 'fail', message: 'Class not found' });

    const { error } = await adminClient.from('classes').delete().eq('id', req.params.id);
    if (error) throw error;

    res.status(200).json({ status: 'success', message: 'Class deleted successfully' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// ==================== QUIZ MANAGEMENT (Supabase-backed) ====================

// Get all quizzes across all classes
router.get('/quizzes', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const quizTable = await resolveExistingTable(adminClient, ['quizzes', 'quiz']);
    if (!quizTable) {
      return res.status(404).json({ status: 'fail', message: "Quiz table not found (expected 'quizzes' or 'quiz'). Please create the table or update configuration." });
    }

    const sortCol = await getPreferredSortColumn(adminClient, quizTable);
    const query = adminClient.from(quizTable).select('*');
    const { data, error } = sortCol ? await query.order(sortCol, { ascending: false }) : await query;
    if (error) throw error;

    // Fetch class and teacher info
    const classIds = [...new Set((data || []).map(q => q.class_id).filter(Boolean))];
    const teacherIds = [...new Set((data || []).map(q => q.teacher_id).filter(Boolean))];
    
    const classesMap = {};
    const teachersMap = {};
    
    if (classIds.length > 0) {
      const { data: classes } = await adminClient.from('classes').select('id, name').in('id', classIds);
      if (classes) {
        classes.forEach(c => { classesMap[c.id] = c; });
      }
    }
    
    if (teacherIds.length > 0) {
      const { data: teachers } = await adminClient.from('profiles').select('id, username, email').in('id', teacherIds);
      if (teachers) {
        teachers.forEach(t => { teachersMap[t.id] = t; });
      }
    }

    const quizzesWithDetails = (data || []).map(q => ({
      ...q,
      class: classesMap[q.class_id] || null,
      teacher: teachersMap[q.teacher_id] || null
    }));

    res.status(200).json({ status: 'success', data: { quizzes: quizzesWithDetails } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Get specific quiz with detailed submissions
router.get('/quizzes/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const quizTable = await resolveExistingTable(adminClient, ['quizzes', 'quiz']);
    if (!quizTable) return res.status(404).json({ status: 'fail', message: 'Quiz table not found' });
    const { data, error } = await adminClient.from(quizTable).select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ status: 'fail', message: 'Quiz not found' });

    res.status(200).json({ status: 'success', data: { quiz: data } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Create quiz (admin can create quiz for any teacher/class)
router.post('/quizzes', async (req, res) => {
  try {
    const { title, description, classId, teacherId, questions, timeLimit } = req.body;

    // Validation
    if (!title) return res.status(400).json({ status: 'fail', message: 'Quiz title is required' });
    if (!classId) return res.status(400).json({ status: 'fail', message: 'classId is required' });
    if (!teacherId) return res.status(400).json({ status: 'fail', message: 'teacherId is required' });

    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const quizTable = await resolveExistingTable(adminClient, ['quizzes', 'quiz']);
    if (!quizTable) return res.status(404).json({ status: 'fail', message: "Quiz table not found (expected 'quizzes' or 'quiz')" });

    // Verify class exists
    const { data: classObj, error: classErr } = await adminClient.from('classes').select('id').eq('id', classId).single();
    if (classErr || !classObj) return res.status(404).json({ status: 'fail', message: 'Class not found' });

    // Verify teacher exists and is a teacher
    const { data: teacher, error: tErr } = await adminClient.from('profiles').select('id,role').eq('id', teacherId).single();
    if (tErr || !teacher) return res.status(404).json({ status: 'fail', message: 'Teacher not found' });
    if (teacher.role !== 'teacher') return res.status(400).json({ status: 'fail', message: 'Provided user is not a teacher' });

    const basePayload = { description, class_id: classId, teacher_id: teacherId, questions: questions || [], time_limit: timeLimit || 30, submissions: [] };

    console.debug('admin.createQuiz: admin=', req.user?.id, 'payload=', { title, classId, teacherId });

    // Try inserting with title/name fallback
    let createdQuiz = null;
    let lastQuizErr = null;
    for (const nameCol of ['title', 'name']) {
      const payloadAttempt = { ...basePayload };
      payloadAttempt[nameCol] = title;
      try {
        const { data: attemptData, error: attemptErr } = await adminClient.from(quizTable).insert([payloadAttempt]).select();
        if (!attemptErr && attemptData && attemptData.length) { createdQuiz = attemptData[0]; break; }
        lastQuizErr = attemptErr || lastQuizErr;
      } catch (e) { lastQuizErr = e; }
    }
    if (!createdQuiz) {
      console.error('admin.createQuiz error: all insert attempts failed', lastQuizErr, 'payloadBase=', basePayload);
      throw lastQuizErr || new Error('Could not insert quiz');
    }

    res.status(201).json({ status: 'success', data: { quiz: createdQuiz } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Update quiz (admin)
router.patch('/quizzes/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { id } = req.params;
    const { title, name, description, classId, teacherId, questions, timeLimit } = req.body;
    // Check if quiz exists
    const { data: existing, error: existingError } = await adminClient.from('quizzes').select('*').eq('id', id).single();
    if (existingError || !existing) return res.status(404).json({ status: 'fail', message: 'Quiz not found' });
    // Build update payload
    const updatePayload = {};
    if (title) updatePayload.title = title;
    if (name) updatePayload.name = name;
    if (description) updatePayload.description = description;
    if (classId) updatePayload.class_id = classId;
    if (teacherId) updatePayload.teacher_id = teacherId;
    if (Array.isArray(questions)) updatePayload.questions = questions;
    if (timeLimit) updatePayload.time_limit = timeLimit;
    const { data, error } = await adminClient.from('quizzes').update(updatePayload).eq('id', id).select();
    if (error) throw error;
    res.status(200).json({ status: 'success', data: { quiz: data[0] } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Delete quiz
router.delete('/quizzes/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const quizTable = await resolveExistingTable(adminClient, ['quizzes', 'quiz']);
    if (!quizTable) return res.status(404).json({ status: 'fail', message: 'Quiz table not found' });
    const { data: existing } = await adminClient.from(quizTable).select('id').eq('id', req.params.id).single();
    if (!existing) return res.status(404).json({ status: 'fail', message: 'Quiz not found' });

    const { error } = await adminClient.from(quizTable).delete().eq('id', req.params.id);
    if (error) throw error;

    res.status(200).json({ status: 'success', message: 'Quiz deleted successfully' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Get quiz statistics
router.get('/quiz-stats', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const quizTable = await resolveExistingTable(adminClient, ['quizzes', 'quiz']);
    if (!quizTable) return res.status(200).json({ status: 'success', data: { totalQuizzes: 0, totalQuizSubmissions: 0, popularQuizzes: [] } });

    // Basic stats: total quizzes and submission counts (if stored as submissions array)
    const { data: quizzes } = await adminClient.from(quizTable).select('*');
    const totalQuizzes = (quizzes || []).length;

    let totalSubmissions = 0;
    const counts = [];
    (quizzes || []).forEach((q) => {
      const subs = Array.isArray(q.submissions) ? q.submissions.length : 0;
      totalSubmissions += subs;
      counts.push({ id: q.id, title: q.title, submissionCount: subs });
    });

    counts.sort((a, b) => b.submissionCount - a.submissionCount);

    res.status(200).json({ status: 'success', data: { totalQuizzes, totalQuizSubmissions: totalSubmissions, popularQuizzes: counts.slice(0, 5) } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// ==================== ASSIGNMENT MANAGEMENT (Supabase-backed) ====================

// Get all assignments across all classes
router.get('/assignments', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    let data, error;
    try {
      const { data: cols } = await adminClient.from('information_schema.columns').select('column_name').eq('table_name', 'assignments');
      const names = (cols || []).map(c => c.column_name);
      const preferred = ['created_at', 'createdAt', 'created_on', 'inserted_at', 'id'];
      const sortCol = preferred.find(n => names.includes(n));
      const query = adminClient.from('assignments').select('*');
      if (sortCol) {
        ({ data, error } = await query.order(sortCol, { ascending: false }));
      } else {
        ({ data, error } = await query);
      }
    } catch (e) {
      ({ data, error } = await adminClient.from('assignments').select('*'));
    }
    if (error) throw error;

    // Fetch class and teacher info
    const classIds = [...new Set((data || []).map(a => a.class_id).filter(Boolean))];
    const teacherIds = [...new Set((data || []).map(a => a.teacher_id).filter(Boolean))];
    
    const classesMap = {};
    const teachersMap = {};
    
    if (classIds.length > 0) {
      const { data: classes } = await adminClient.from('classes').select('id, name').in('id', classIds);
      if (classes) {
        classes.forEach(c => { classesMap[c.id] = c; });
      }
    }
    
    if (teacherIds.length > 0) {
      const { data: teachers } = await adminClient.from('profiles').select('id, username, email').in('id', teacherIds);
      if (teachers) {
        teachers.forEach(t => { teachersMap[t.id] = t; });
      }
    }

    const assignmentsWithDetails = (data || []).map(a => ({
      ...a,
      class: classesMap[a.class_id] || null,
      teacher: teachersMap[a.teacher_id] || null
    }));

    res.status(200).json({ status: 'success', data: { assignments: assignmentsWithDetails } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Get specific assignment with submissions
router.get('/assignments/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await adminClient.from('assignments').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ status: 'fail', message: 'Assignment not found' });

    res.status(200).json({ status: 'success', data: { assignment: data } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Admin create assignment for any class
router.post('/assignments', async (req, res) => {
  try {
    const { title, description, classId, teacherId, dueDate, maxPoints } = req.body;

    // Validation
    if (!title) return res.status(400).json({ status: 'fail', message: 'Assignment title is required' });
    if (!classId) return res.status(400).json({ status: 'fail', message: 'classId is required' });
    if (!teacherId) return res.status(400).json({ status: 'fail', message: 'teacherId is required' });

    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Verify class exists
    const { data: classObj, error: classErr } = await adminClient.from('classes').select('id').eq('id', classId).single();
    if (classErr || !classObj) return res.status(404).json({ status: 'fail', message: 'Class not found' });

    // Verify teacher exists and is a teacher
    const { data: teacher, error: tErr } = await adminClient.from('profiles').select('id,role').eq('id', teacherId).single();
    if (tErr || !teacher) return res.status(404).json({ status: 'fail', message: 'Teacher not found' });
    if (teacher.role !== 'teacher') return res.status(400).json({ status: 'fail', message: 'Provided user is not a teacher' });

    const basePayload = { description, class_id: classId, teacher_id: teacherId, due_date: dueDate || null, max_points: maxPoints || 100 };

    console.debug('admin.createAssignment: admin=', req.user?.id, 'payload=', { title, classId, teacherId });

    // Try insert with title only (name column doesn't exist in current schema)
    const payloadAttempt = { ...basePayload, title };
    try {
      const { data: attemptData, error: attemptErr } = await adminClient.from('assignments').insert([payloadAttempt]).select();
      if (attemptErr) {
        console.error('admin.createAssignment error:', attemptErr);
        throw attemptErr;
      }
      if (!attemptData || !attemptData.length) {
        throw new Error('No data returned from insert');
      }
      res.status(201).json({ status: 'success', data: { assignment: attemptData[0] } });
    } catch (error) {
      console.error('admin.createAssignment error:', error);
      throw error;
    }
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Update assignment (admin)
router.patch('/assignments/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { id } = req.params;
    const { title, name, description, classId, teacherId, dueDate, maxPoints } = req.body;
    // Check if assignment exists
    const { data: existing, error: existingError } = await adminClient.from('assignments').select('*').eq('id', id).single();
    if (existingError || !existing) return res.status(404).json({ status: 'fail', message: 'Assignment not found' });
    // Build update payload
    const updatePayload = {};
    if (title) updatePayload.title = title;
    if (name) updatePayload.name = name;
    if (description) updatePayload.description = description;
    if (classId) updatePayload.class_id = classId;
    if (teacherId) updatePayload.teacher_id = teacherId;
    if (dueDate) updatePayload.due_date = dueDate;
    if (maxPoints) updatePayload.max_points = maxPoints;
    const { data, error } = await adminClient.from('assignments').update(updatePayload).eq('id', id).select();
    if (error) throw error;
    res.status(200).json({ status: 'success', data: { assignment: data[0] } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Delete assignment
router.delete('/assignments/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: existing } = await adminClient.from('assignments').select('id').eq('id', req.params.id).single();
    if (!existing) return res.status(404).json({ status: 'fail', message: 'Assignment not found' });

    const { error } = await adminClient.from('assignments').delete().eq('id', req.params.id);
    if (error) throw error;

    res.status(200).json({ status: 'success', message: 'Assignment deleted successfully' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Grade assignment submission
router.patch('/assignments/:assignmentId/submissions/:submissionId/grade', async (req, res) => {
  try {
    const { grade, feedback } = req.body;
    const { assignmentId, submissionId } = req.params;
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: assignment } = await adminClient.from('assignments').select('*').eq('id', assignmentId).single();
    if (!assignment) return res.status(404).json({ status: 'fail', message: 'Assignment not found' });

    const submissions = Array.isArray(assignment.submissions) ? [...assignment.submissions] : [];
    const idx = submissions.findIndex((s) => s.id === submissionId || s.submission_id === submissionId);
    if (idx === -1) return res.status(404).json({ status: 'fail', message: 'Submission not found' });

    submissions[idx].grade = grade;
    if (feedback) submissions[idx].feedback = feedback;

    const { error } = await adminClient.from('assignments').update({ submissions }).eq('id', assignmentId);
    if (error) throw error;

    // Optional: update student points in profiles table if structured that way
    if (grade) {
      const studentId = submissions[idx].student || submissions[idx].student_id;
      if (studentId) {
        // increase points by a simple heuristic (10 points max per assignment)
        const pointsEarned = Math.round((grade / (assignment.max_points || 100)) * 10);
        const { data: profile } = await adminClient.from('profiles').select('id,points').eq('id', studentId).single();
        if (profile) {
          const newPoints = (profile.points || 0) + pointsEarned;
          await adminClient.from('profiles').update({ points: newPoints }).eq('id', studentId);
        }
      }
    }

    res.status(200).json({ status: 'success', message: 'Submission graded successfully', data: { submission: submissions[idx] } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Get assignment statistics
router.get('/assignment-stats', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: assignments } = await adminClient.from('assignments').select('*');

    const totalAssignments = (assignments || []).length;
    let totalSubmissions = 0;
    const counts = [];
    const grades = [];

    (assignments || []).forEach((a) => {
      const subs = Array.isArray(a.submissions) ? a.submissions : [];
      totalSubmissions += subs.length;
      counts.push({ id: a.id, title: a.title, submissionCount: subs.length });
      subs.forEach((s) => { if (s.grade != null) grades.push(Number(s.grade)); });
    });

    counts.sort((a, b) => b.submissionCount - a.submissionCount);

    const averageGrade = grades.length ? (grades.reduce((s, v) => s + v, 0) / grades.length) : 0;

    res.status(200).json({ status: 'success', data: { totalAssignments, totalSubmissions, popularAssignments: counts.slice(0,5), gradeStatistics: { averageGrade, maxGrade: Math.max(...grades, 0), minGrade: Math.min(...grades, 0) } } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// ==================== SYSTEM STATS (Supabase-backed) ====================

// Update system statistics to include detailed assignment data
router.get('/stats', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const [{ count: studentsCount }, { count: teachersCount }, { count: classesCount }, { count: assignmentsCount }, { count: quizzesCount }] = await Promise.all([
      adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
      adminClient.from('classes').select('id', { count: 'exact', head: true }),
      adminClient.from('assignments').select('id', { count: 'exact', head: true }),
      adminClient.from('quizzes').select('id', { count: 'exact', head: true })
    ]);

    // Derive assignment submission totals
    const { data: assignments } = await adminClient.from('assignments').select('*');
    let totalSubmissions = 0;
    (assignments || []).forEach(a => { if (Array.isArray(a.submissions)) totalSubmissions += a.submissions.length; });

    res.status(200).json({ status: 'success', data: {
      totalStudents: Number(studentsCount || 0),
      totalTeachers: Number(teachersCount || 0),
      totalClasses: Number(classesCount || 0),
      totalAssignments: Number(assignmentsCount || 0),
      totalQuizzes: Number(quizzesCount || 0),
      assignmentStats: {
        totalSubmissions,
        gradedSubmissions: 0, // detailed graded count requires schema-specific checks
        submissionRate: (Number(assignmentsCount) > 0 && Number(studentsCount) > 0) ? Math.round((totalSubmissions) / (Number(assignmentsCount) * Number(studentsCount)) * 100) : 0
      }
    }});
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Dev-only: Return column information for a given table (development helpers only)
// Usage: GET /api/admin/schema/:table
// NOTE: This endpoint is disabled in production and requires admin role.
router.get('/schema/:table', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ status: 'fail', message: 'Not allowed in production' });
    if (!req.user || req.user.user_metadata?.role !== 'admin') return res.status(403).json({ status: 'fail', message: 'Admin access required' });

    const table = req.params.table;
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Try information_schema first (should work via PostgREST if allowed)
    try {
      const { data: cols, error: colsErr } = await adminClient.from('information_schema.columns').select('column_name,data_type,ordinal_position').eq('table_name', table).order('ordinal_position');
      if (!colsErr && cols && cols.length) {
        return res.status(200).json({ status: 'success', data: { columns: cols } });
      }
    } catch (e) {
      // ignore and fallback to sample row
      console.warn('admin/schema: information_schema query failed', e?.message || e);
    }

    // Fallback: attempt to select one row from the target table and infer columns from keys
    try {
      const { data: row, error: rowErr } = await adminClient.from(table).select('*').limit(1).single();
      if (!rowErr && row) {
        return res.status(200).json({ status: 'success', data: { columns: Object.keys(row) } });
      }
    } catch (e) {
      console.warn('admin/schema: table select fallback failed', e?.message || e);
    }

    res.status(404).json({ status: 'fail', message: 'No columns found - table may not exist or has no rows' });
  } catch (error) {
    console.error('GET /admin/schema/:table error', error);
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Bulk enroll all students in all classes
router.post('/bulk-enroll-all', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Get all students
    const { data: students, error: studentsErr } = await adminClient
      .from('profiles')
      .select('id')
      .eq('role', 'student');
    if (studentsErr) throw studentsErr;

    // Get all classes
    const { data: classes, error: classesErr } = await adminClient
      .from('classes')
      .select('id');
    if (classesErr) throw classesErr;

    // Build bulk enrollment records
    const enrollments = [];
    for (const student of students) {
      for (const cls of classes) {
        enrollments.push({
          class_id: cls.id,
          student_id: student.id,
          enrolled_at: new Date().toISOString()
        });
      }
    }

    // Insert all enrollments
    if (enrollments.length > 0) {
      const { error: insertErr } = await adminClient
        .from('class_students')
        .insert(enrollments);
      if (insertErr) throw insertErr;
    }

    res.status(200).json({
      status: 'success',
      message: `Enrolled ${students.length} students in ${classes.length} classes (${enrollments.length} total enrollments)`,
      data: { studentsCount: students.length, classesCount: classes.length, enrollmentsCreated: enrollments.length }
    });
  } catch (error) {
    console.error('POST /admin/bulk-enroll-all error:', error);
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Create dynamic class with auto-enrolled students
router.post('/create-dynamic-class', async (req, res) => {
  try {
    const { name = 'Dynamic Class', subject = 'General', description = 'Auto-generated class', teacherId } = req.body;

    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Generate class code
    const classCode = `DYN${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    // Create class
    const { data: createdClass, error: classErr } = await adminClient
      .from('classes')
      .insert([{
        name,
        subject,
        description,
        teacher_id: teacherId,
        class_code: classCode,
        invite_code: `invite_${Date.now()}_${Math.random().toString(36).substring(7)}`
      }])
      .select()
      .single();
    
    if (classErr) throw classErr;

    // Get all students
    const { data: students, error: studentsErr } = await adminClient
      .from('profiles')
      .select('id')
      .eq('role', 'student');
    if (studentsErr) throw studentsErr;

    // Enroll all students in the new class
    const enrollments = students.map(student => ({
      class_id: createdClass.id,
      student_id: student.id,
      enrolled_at: new Date().toISOString()
    }));

    if (enrollments.length > 0) {
      const { error: enrollErr } = await adminClient
        .from('class_students')
        .insert(enrollments);
      if (enrollErr) throw enrollErr;
    }

    res.status(201).json({
      status: 'success',
      message: `Created class "${name}" and enrolled ${students.length} students`,
      data: {
        class: createdClass,
        studentsEnrolled: students.length,
        enrollmentLink: `http://localhost:3000/classes?invite=${createdClass.invite_code}`
      }
    });
  } catch (error) {
    console.error('POST /admin/create-dynamic-class error:', error);
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

module.exports = router;