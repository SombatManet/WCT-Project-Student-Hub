const express = require('express');
const router = express.Router();
const auth = require('../middleware/supabaseAuth');

router.use(auth);

// GET /api/activity/recent - aggregate recent activity for current user
router.get('/recent', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user?.role || req.user?.user_metadata?.role;

    const { createClient } = require('@supabase/supabase-js');
    const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const events = [];

    // Helper to push event objects with a sortable timestamp
    const pushEvent = (type, title, description, ts) => {
      events.push({ type, title, description, ts });
    };

    // 1) Messages: last 5 messages sent/received
    try {
      const { data: messages } = await adminClient
        .from('personal_messages')
        .select('id, sender_id, recipient_id, message, created_at')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (messages) {
        // Fetch counterpart display names
        const userIds = Array.from(new Set(messages.flatMap(m => [m.sender_id, m.recipient_id])));
        let profilesMap = {};
        if (userIds.length) {
          const { data: profiles } = await adminClient
            .from('profiles')
            .select('id,username,email')
            .in('id', userIds);
          (profiles || []).forEach(p => { profilesMap[p.id] = p.username || (p.email ? p.email.split('@')[0] : 'User'); });
        }
        messages.forEach(m => {
          const isSent = String(m.sender_id) === String(userId);
          const counterpart = profilesMap[isSent ? m.recipient_id : m.sender_id] || 'User';
          pushEvent('message', isSent ? `You messaged ${counterpart}` : `${counterpart} messaged you`, m.message?.slice(0, 80) || '—', m.created_at);
        });
      }
    } catch (e) {
      // ignore
    }

    // 2) Classes joined (prefer class_students; fallback to classes.students array)
    try {
      const { data: joinRows, error: joinErr } = await adminClient
        .from('class_students')
        .select('class_id, created_at')
        .eq('student_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!joinErr && joinRows && joinRows.length) {
        const classIds = Array.from(new Set(joinRows.map(j => j.class_id)));
        const { data: classes } = await adminClient
          .from('classes')
          .select('id,name,title')
          .in('id', classIds);
        const clsMap = {};
        (classes || []).forEach(c => { clsMap[c.id] = c.name || c.title || 'Class'; });
        joinRows.forEach(r => pushEvent('class', `Joined ${clsMap[r.class_id] || 'a class'}`, 'Enrollment successful', r.created_at));
      } else {
        // Fallback when class_students does not exist: scan classes.students array
        const { data: classes } = await adminClient
          .from('classes')
          .select('id,name,title,students,updated_at,created_at');
        (classes || [])
          .filter(c => Array.isArray(c.students) && c.students.map(String).includes(String(userId)))
          .slice(0, 5)
          .forEach(c => {
            const title = c.name || c.title || 'Class';
            // Best-effort timestamp: prefer updated_at if available, else created_at
            const ts = c.updated_at || c.created_at || new Date().toISOString();
            pushEvent('class', `Enrolled in ${title}`, 'Enrollment recorded', ts);
          });
      }
    } catch (e) {
      // ignore when table missing
    }

    // Prepare teacher set (for student) to filter assignments/quizzes
    let teacherIds = [];
    if (role === 'student') {
      try {
        const { data: enrolls } = await adminClient
          .from('class_students')
          .select('class_id')
          .eq('student_id', userId);
        const classIds = (enrolls || []).map(e => e.class_id);
        if (classIds.length) {
          const { data: classes } = await adminClient
            .from('classes')
            .select('id,teacher_id')
            .in('id', classIds);
          teacherIds = Array.from(new Set((classes || []).map(c => c.teacher_id).filter(Boolean)));
        } else {
          // Fallback via classes.students array
          const { data: classesAlt } = await adminClient
            .from('classes')
            .select('id,teacher_id,students');
          teacherIds = Array.from(new Set((classesAlt || [])
            .filter(c => Array.isArray(c.students) && c.students.map(String).includes(String(userId)))
            .map(c => c.teacher_id)
            .filter(Boolean)));
        }
      } catch (e) {
        // ignore
      }
    }

    // 3) Assignments created (for student teachers or for teacher own)
    try {
      let query = adminClient
        .from('assignments')
        .select('id,title,created_at,teacher');
      if (role === 'student' && teacherIds.length) {
        query = query.in('teacher', teacherIds);
      } else if (role === 'teacher') {
        query = query.eq('teacher', userId);
      }
      const { data: assignments } = await query.order('created_at', { ascending: false }).limit(5);
      (assignments || []).forEach(a => pushEvent('assignment', a.title || 'New Assignment', 'An assignment was created', a.created_at));
    } catch (e) {
      // ignore
    }

    // 4) Quizzes created (similar filtering)
    try {
      let query = adminClient
        .from('quizzes')
        .select('id,title,created_at,teacher');
      if (role === 'student' && teacherIds.length) {
        query = query.in('teacher', teacherIds);
      } else if (role === 'teacher') {
        query = query.eq('teacher', userId);
      }
      const { data: quizzes } = await query.order('created_at', { ascending: false }).limit(5);
      (quizzes || []).forEach(q => pushEvent('quiz', q.title || 'New Quiz', 'A quiz was published', q.created_at));
    } catch (e) {
      // ignore
    }

    // 5) For teachers: surface class creations as activity
    try {
      if (role === 'teacher') {
        const { data: myClasses } = await adminClient
          .from('classes')
          .select('id,name,title,created_at')
          .eq('teacher_id', userId)
          .order('created_at', { ascending: false })
          .limit(5);
        (myClasses || []).forEach(c => pushEvent('class', `Created ${c.name || c.title || 'a class'}`, 'Class is now available to students', c.created_at));
      }
    } catch (e) {}

    // Sort by time descending (events are already roughly ordered but combine streams)
    const sorted = events
      .map(ev => ({ ...ev, _ts: Date.parse(ev.ts) || 0 }))
      .sort((a, b) => b._ts - a._ts)
      .slice(0, 10)
      .map(({ _ts, ts, ...rest }) => ({ ...rest, time: new Date(ts).toLocaleString() }));

    res.status(200).json({ status: 'success', data: sorted });
  } catch (error) {
    console.error('GET /activity/recent error:', error);
    res.status(500).json({ status: 'fail', message: error.message || 'Failed to load activity' });
  }
});

module.exports = router;

// ==================== DASHBOARD STATS ====================
// GET /api/activity/stats - dynamic dashboard stats per user
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user?.role || req.user?.user_metadata?.role;

    const { createClient } = require('@supabase/supabase-js');
    const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const result = {
      enrolled_classes: 0,
      pending_assignments: 0,
      quizzes_available: 0,
      average_score: 0,
      my_classes: 0,
      total_students: 0,
      active_assignments: 0,
      active_quizzes: 0,
    };

    // Compute for student
    if (role === 'student') {
      // Enrolled classes via class_students
      try {
        const { data: enrolls, error: enrollErr } = await adminClient
          .from('class_students')
          .select('class_id')
          .eq('student_id', userId);
        if (!enrollErr && enrolls) {
          result.enrolled_classes = enrolls.length;
        } else {
          // Fallback: classes.students column
          const { data: classes } = await adminClient
            .from('classes')
            .select('id,students');
          const count = (classes || []).filter(c => Array.isArray(c.students) && c.students.map(String).includes(String(userId))).length;
          result.enrolled_classes = count;
        }
      } catch (e) {}

      // Determine teachers of enrolled classes
      let teacherIds = [];
      try {
        const { data: enrolls } = await adminClient
          .from('class_students')
          .select('class_id')
          .eq('student_id', userId);
        const classIds = (enrolls || []).map(e => e.class_id);
        if (classIds.length) {
          const { data: classes } = await adminClient
            .from('classes')
            .select('id,teacher_id')
            .in('id', classIds);
          teacherIds = Array.from(new Set((classes || []).map(c => c.teacher_id).filter(Boolean)));
        }
      } catch (e) {}

      // Pending assignments: assignments by those teachers where user has no submission
      try {
        let query = adminClient.from('assignments').select('id,title,submissions,teacher');
        if (teacherIds.length) query = query.in('teacher', teacherIds);
        const { data: assignments } = await query;
        const pending = (assignments || []).filter(a => {
          const subs = Array.isArray(a.submissions) ? a.submissions : [];
          return !subs.some(s => String(s.student) === String(userId));
        });
        result.pending_assignments = pending.length;
      } catch (e) {}

      // Available quizzes: quizzes by those teachers where user has no submission
      try {
        let query = adminClient.from('quizzes').select('id,title,submissions,teacher');
        if (teacherIds.length) query = query.in('teacher', teacherIds);
        const { data: quizzes } = await query;
        const available = (quizzes || []).filter(q => {
          const subs = Array.isArray(q.submissions) ? q.submissions : [];
          return !subs.some(s => String(s.student) === String(userId));
        });
        result.quizzes_available = available.length;
      } catch (e) {}

      // Average score from quizzes (score) and assignments (grade)
      try {
        let total = 0;
        let count = 0;
        // Quiz scores
        const { data: quizzes } = await adminClient.from('quizzes').select('submissions');
        (quizzes || []).forEach(q => {
          const subs = Array.isArray(q.submissions) ? q.submissions : [];
          subs.forEach(s => {
            if (String(s.student) === String(userId) && typeof s.score === 'number') {
              total += s.score;
              count += 1;
            }
          });
        });
        // Assignment grades
        const { data: assignments } = await adminClient.from('assignments').select('submissions');
        (assignments || []).forEach(a => {
          const subs = Array.isArray(a.submissions) ? a.submissions : [];
          subs.forEach(s => {
            if (String(s.student) === String(userId) && typeof s.grade === 'number') {
              total += s.grade;
              count += 1;
            }
          });
        });
        result.average_score = count > 0 ? Math.round((total / count) * 100) / 100 : 0;
      } catch (e) {}
    }

    // Compute for teacher
    if (role === 'teacher') {
      try {
        const { data: classes } = await adminClient
          .from('classes')
          .select('id')
          .eq('teacher_id', userId);
        const classIds = (classes || []).map(c => c.id);
        result.my_classes = classIds.length;

        // Total students across classes via class_students
        if (classIds.length) {
          const { data: enrolls } = await adminClient
            .from('class_students')
            .select('student_id')
            .in('class_id', classIds);
          const unique = Array.from(new Set((enrolls || []).map(e => e.student_id)));
          result.total_students = unique.length;
        }
      } catch (e) {}

      try {
        const { data: assignments } = await adminClient
          .from('assignments')
          .select('id')
          .eq('teacher', userId);
        result.active_assignments = (assignments || []).length;
      } catch (e) {}

      try {
        const { data: quizzes } = await adminClient
          .from('quizzes')
          .select('id')
          .eq('teacher', userId);
        result.active_quizzes = (quizzes || []).length;
      } catch (e) {}
    }

    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    console.error('GET /activity/stats error:', error);
    res.status(500).json({ status: 'fail', message: error.message || 'Failed to load stats' });
  }
});