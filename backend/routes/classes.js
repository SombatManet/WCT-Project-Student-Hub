const express = require('express');
// Note: legacy Mongoose-style models are not used; Supabase is the source of truth
// Change this line:
const auth = require('../middleware/supabaseAuth');
const router = express.Router();

router.use(auth);

// Create class (Supabase-backed)
router.post('/', async (req, res) => {
  try {
    // Log auth and role check details for debugging
    console.debug('POST /classes called by user:', { id: req.user?.id, role: req.user?.role, metaRole: req.user?.user_metadata?.role });

    const role = req.user?.role || req.user?.user_metadata?.role;
    if (!role || (role !== 'teacher' && role !== 'admin')) {
      console.debug('POST /classes: permission denied - role check failed', { role });
      return res.status(403).json({ status: 'fail', message: 'Only teachers can create classes' });
    }

    const classCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Normalize incoming payload (frontend may send `name`/`subject`/`description`)
    const { name, subject, description } = req.body;
    const payload = {
      name: name || req.body.name || req.body.title || req.body.className,
      subject: subject || req.body.subject,
      description: description || req.body.description,
      teacher_id: req.user.id,
      class_code: classCode
    };

    // Add invite_code if column exists
    try {
      const { data: cols } = await adminClient
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'classes')
        .eq('column_name', 'invite_code');
      if (cols && cols.length) {
        payload.invite_code = inviteCode;
      }
    } catch (e) {
      // ignore schema check errors
    }

    console.debug('POST /classes: insert payload', payload);
    const { data, error } = await adminClient.from('classes').insert([payload]).select();
    if (error) {
      console.error('POST /classes: insert error', error);
      throw error;
    }

    // Fallback: record invite in class_invites table if available
    try {
      await adminClient.from('class_invites').insert([{ class_id: data[0].id, invite_code: inviteCode }]);
    } catch (e) {
      // ignore if table doesn't exist
    }

    const inviteLink = (payload.invite_code || inviteCode) ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join/${payload.invite_code || inviteCode}` : null;
    res.status(201).json({ status: 'success', data: { class: { ...data[0], invite_link: inviteLink } } });
  } catch (error) {
    console.error('POST /classes: caught error', error);
    res.status(400).json({ status: 'fail', message: (error && error.message) || 'Failed to create class' });
  }
});

// Get all classes
router.get('/', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    let { data: classes, error } = { data: [], error: null };

    if (req.user.role === 'admin') {
      ({ data: classes, error } = await adminClient.from('classes').select('*').order('created_at', { ascending: false }));
    } else if (req.user.role === 'teacher') {
      ({ data: classes, error } = await adminClient.from('classes').select('*').eq('teacher_id', req.user.id));
    } else {
      // student: fetch enrolled classes via class_students table
      try {
        const { data: enrollments, error: enrollErr } = await adminClient
          .from('class_students')
          .select('class_id')
          .eq('student_id', req.user.id);
        
        if (enrollErr) throw enrollErr;
        
        if (enrollments && enrollments.length > 0) {
          const classIds = enrollments.map(e => e.class_id);
          ({ data: classes, error } = await adminClient.from('classes').select('*').in('id', classIds));
          if (error) throw error;
        } else {
          classes = [];
        }
      } catch (e) {
        // Fallback: try students array column if class_students table doesn't exist
        console.warn('class_students lookup failed, trying students column fallback:', e?.message || e);
        try {
          ({ data: classes, error } = await adminClient.from('classes').select('*').contains('students', [req.user.id]));
          if (error) throw error;
        } catch (e2) {
          console.warn('students column fallback also failed:', e2?.message || e2);
          classes = [];
        }
      }
    }

    // If there was an earlier error it would have been thrown; safe to continue
    if (!classes) classes = [];

    // Enrich with student counts for all roles; include full student ID array for teacher/admin
    try {
      const classIds = (classes || []).map(c => c.id).filter(Boolean);
      if (classIds.length) {
        const { data: enrollments } = await adminClient
          .from('class_students')
          .select('class_id,student_id')
          .in('class_id', classIds);
        const countsMap = {};
        const studentsMap = {};
        (enrollments || []).forEach(e => {
          countsMap[e.class_id] = (countsMap[e.class_id] || 0) + 1;
          if (!studentsMap[e.class_id]) studentsMap[e.class_id] = [];
          studentsMap[e.class_id].push(e.student_id);
        });

        classes = classes.map(c => {
          const base = { ...c, students_count: countsMap[c.id] || (Array.isArray(c.students) ? c.students.length : 0) };
          if (req.user.role === 'admin' || req.user.role === 'teacher') {
            return { ...base, students: studentsMap[c.id] || c.students || [] };
          }
          // For students, avoid attaching raw IDs array
          return base;
        });
      }
    } catch (e) {
      // ignore enrichment errors
    }

    const classesWithInvite = (classes || []).map(c => ({ ...c, invite_link: c.invite_code ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join/${c.invite_code}` : null }));

    res.status(200).json({ status: 'success', results: classesWithInvite.length, data: { classes: classesWithInvite } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Get specific class with detailed info
router.get('/:id', async (req, res) => {
  try {
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: classData, error } = await adminClient.from('classes').select('*').eq('id', req.params.id).single();
    if (error || !classData) return res.status(404).json({ status: 'fail', message: 'Class not found' });

    // Check if user has access to this class
    if (req.user.role === 'student') {
      // Check enrollment via class_students table
      let isEnrolled = false;
      try {
        const { data: enrollment, error: enrollErr } = await adminClient
          .from('class_students')
          .select('id')
          .eq('class_id', req.params.id)
          .eq('student_id', req.user.id)
          .single();
        if (!enrollErr && enrollment) isEnrolled = true;
      } catch (e) {
        // Fallback: check students array column
        const students = Array.isArray(classData.students) ? classData.students.map(String) : [];
        if (students.includes(String(req.user.id))) isEnrolled = true;
      }
      
      if (!isEnrolled) return res.status(403).json({ status: 'fail', message: 'Access denied' });
    }

    // Build students list using class_students + profiles for all roles
    let students = [];
    try {
      const { data: enrollments } = await adminClient
        .from('class_students')
        .select('student_id')
        .eq('class_id', req.params.id);
      const studentIds = (enrollments || []).map(e => e.student_id);
      if (studentIds.length) {
        const { data: profiles } = await adminClient
          .from('profiles')
          .select('id,username,email')
          .in('id', studentIds);
        students = (profiles || []).map(p => ({ _id: p.id, username: p.username || (p.email ? p.email.split('@')[0] : 'Student'), email: p.email }));
      }
    } catch (e) {
      // ignore lookup errors
    }

    const inviteLink = classData.invite_code ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join/${classData.invite_code}` : null;

    res.status(200).json({ status: 'success', data: { class: { ...classData, students }, invite_link: inviteLink } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Get class by invite code for preview (no authentication required)
router.get('/by-invite/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Try classes.invite_code
    let { data: classData, error } = await adminClient.from('classes').select('id,name,subject,description,teacher_id,class_code,invite_code').eq('invite_code', code).single();

    if (error || !classData) {
      // Fallback to class_invites table
      try {
        const { data: inviteRow, error: inviteErr } = await adminClient.from('class_invites').select('class_id').eq('invite_code', code).single();
        if (!inviteErr && inviteRow && inviteRow.class_id) {
          const { data: cls } = await adminClient.from('classes').select('id,name,subject,description,teacher_id,class_code,invite_code').eq('id', inviteRow.class_id).single();
          classData = cls;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!classData) return res.status(404).json({ status: 'fail', message: 'Invite not found' });

    const inviteLink = classData.invite_code ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join/${classData.invite_code}` : null;
    res.status(200).json({ status: 'success', data: { class: classData, invite_link: inviteLink } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Join class — supports joining by classCode or inviteCode; optionally, admin/teacher can specify `studentId` to enroll a specific student
router.post('/join', async (req, res) => {
  try {
    const { classCode, inviteCode, studentId } = req.body;
    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Determine the target student to enroll
    let targetStudentId = studentId || req.user.id;

    // If studentId is provided, only allow admin or teacher to enroll others
    const requesterRole = req.user?.role || req.user?.user_metadata?.role;
    if (studentId && !(requesterRole === 'admin' || requesterRole === 'superadmin' || requesterRole === 'teacher')) {
      return res.status(403).json({ status: 'fail', message: 'Only teachers or admins can enroll other students' });
    }

    // If no studentId provided, enforce that the requester is a student (self-join)
    if (!studentId && requesterRole !== 'student') {
      return res.status(403).json({ status: 'fail', message: 'Only students can join classes via invite' });
    }

    // If targetStudentId is provided and is not the same as req.user.id, validate the student exists and has role student
    if (studentId) {
      const { data: studentProfile, error: spErr } = await adminClient.from('profiles').select('id,role').eq('id', studentId).single();
      if (spErr || !studentProfile) return res.status(404).json({ status: 'fail', message: 'Student not found' });
      if (studentProfile.role !== 'student') return res.status(400).json({ status: 'fail', message: 'Provided user is not a student' });
    }

    let classToJoin = null;

    if (classCode) {
      const { data, error } = await adminClient.from('classes').select('*').eq('class_code', classCode.toUpperCase()).single();
      if (!error && data) classToJoin = data;
    }

    if (!classToJoin && inviteCode) {
      // Try to find class by invite_code column directly
      try {
        const { data, error } = await adminClient.from('classes').select('*').eq('invite_code', inviteCode).single();
        if (!error && data) classToJoin = data;
      } catch (e) {
        // ignore and fallback
      }

      // Fallback: check separate 'class_invites' table (class_id, invite_code)
      if (!classToJoin) {
        try {
          const { data: inviteRow, error: inviteErr } = await adminClient.from('class_invites').select('class_id').eq('invite_code', inviteCode).single();
          if (!inviteErr && inviteRow && inviteRow.class_id) {
            const { data: cls } = await adminClient.from('classes').select('*').eq('id', inviteRow.class_id).single();
            if (cls) classToJoin = cls;
          }
        } catch (e) {
          // ignore
        }
      }
    }

    if (!classToJoin) return res.status(404).json({ status: 'fail', message: 'Class not found' });

    // If the classes table supports a students array, try to append to it
    let classesHasStudentsCol = false;
    try {
      const { data: cols } = await adminClient.from('information_schema.columns').select('column_name').eq('table_name', 'classes').eq('column_name', 'students');
      if (cols && cols.length) classesHasStudentsCol = true;
    } catch (e) {
      // ignore
    }

    // If students array exists, update that
    if (classesHasStudentsCol) {
      const students = Array.isArray(classToJoin.students) ? [...classToJoin.students] : [];
      if (students.map(String).includes(String(targetStudentId))) return res.status(400).json({ status: 'fail', message: 'Student already enrolled in this class' });
      students.push(targetStudentId);
      const { error: updateErr } = await adminClient.from('classes').update({ students }).eq('id', classToJoin.id);
      if (updateErr) throw updateErr;

      const inviteLink = classToJoin.invite_code ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join/${classToJoin.invite_code}` : null;
      return res.status(200).json({ status: 'success', message: 'Successfully enrolled student in class', data: { classId: classToJoin.id, studentId: targetStudentId, invite_link: inviteLink } });
    }

    // Otherwise, fallback to enrollment table 'class_students'
    // Try to insert directly; if table doesn't exist we'll get a specific error
    try {
      // Check if already enrolled
      const { data: existing } = await adminClient.from('class_students').select('*').eq('class_id', classToJoin.id).eq('student_id', targetStudentId).limit(1);
      if (existing && existing.length) return res.status(400).json({ status: 'fail', message: 'Student already enrolled in this class' });

      const { error: insertErr } = await adminClient.from('class_students').insert([{ class_id: classToJoin.id, student_id: targetStudentId }]);
      if (insertErr) {
        console.error('class_students insert error:', insertErr);
        // If table doesn't exist, provide clear instructions
        if (insertErr.code === '42P01' || insertErr.message?.includes('does not exist')) {
          return res.status(500).json({ 
            status: 'fail', 
            message: 'Enrollment table not found. Please run the SQL migration to create class_students table.',
            hint: 'See backend/supabase/sql/004_create_class_students_table.sql'
          });
        }
        throw insertErr;
      }

      const inviteLink = classToJoin.invite_code ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join/${classToJoin.invite_code}` : null;
      return res.status(200).json({ status: 'success', message: 'Successfully enrolled student in class', data: { classId: classToJoin.id, studentId: targetStudentId, invite_link: inviteLink } });
    } catch (e) {
      console.error('Enrollment fallback error:', e);
      return res.status(400).json({ status: 'fail', message: e.message || 'Could not enroll student' });
    }
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Enroll a specific student by ID (teacher or admin only)
router.post('/:id/enroll', async (req, res) => {
  try {
    const classId = req.params.id;
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ status: 'fail', message: 'studentId is required' });

    const requesterRole = req.user?.role || req.user?.user_metadata?.role;
    // Only teachers (owning teacher), admins, or superadmins may enroll someone by ID
    if (!(requesterRole === 'admin' || requesterRole === 'superadmin' || requesterRole === 'teacher')) {
      return res.status(403).json({ status: 'fail', message: 'Only teachers or admins can enroll students by ID' });
    }

    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Verify class exists
    const { data: classData, error: classErr } = await adminClient.from('classes').select('*').eq('id', classId).single();
    if (classErr || !classData) return res.status(404).json({ status: 'fail', message: 'Class not found' });

    // If requester is a teacher, ensure they own the class
    if (requesterRole === 'teacher') {
      const teacherId = classData.teacher_id || (classData.teacher && (classData.teacher.id || classData.teacher._id));
      if (!teacherId || String(teacherId) !== String(req.user.id)) {
        return res.status(403).json({ status: 'fail', message: 'Not authorized to enroll students for this class' });
      }
    }

    // Verify student exists and is a student
    const { data: studentProfile, error: spErr } = await adminClient.from('profiles').select('id,role').eq('id', studentId).single();
    if (spErr || !studentProfile) return res.status(404).json({ status: 'fail', message: 'Student not found' });
    if (studentProfile.role !== 'student') return res.status(400).json({ status: 'fail', message: 'Provided user is not a student' });

    // Enrollment logic (same as join): try classes.students column then class_students table
    let classesHasStudentsCol = false;
    try {
      const { data: cols } = await adminClient.from('information_schema.columns').select('column_name').eq('table_name', 'classes').eq('column_name', 'students');
      if (cols && cols.length) classesHasStudentsCol = true;
    } catch (e) {
      // ignore
    }

    if (classesHasStudentsCol) {
      const students = Array.isArray(classData.students) ? [...classData.students] : [];
      if (students.map(String).includes(String(studentId))) return res.status(400).json({ status: 'fail', message: 'Student already enrolled in this class' });
      students.push(studentId);
      const { error: updateErr } = await adminClient.from('classes').update({ students }).eq('id', classId);
      if (updateErr) throw updateErr;

      return res.status(200).json({ status: 'success', message: 'Student enrolled successfully', data: { classId, studentId } });
    }

    // Fallback to enrollment table
    try {
      const { data: tables } = await adminClient.from('information_schema.tables').select('table_name').eq('table_name', 'class_students');
      if (tables && tables.length) {
        const { data: existing } = await adminClient.from('class_students').select('*').eq('class_id', classId).eq('student_id', studentId).limit(1);
        if (existing && existing.length) return res.status(400).json({ status: 'fail', message: 'Student already enrolled in this class' });

        const { error: insertErr } = await adminClient.from('class_students').insert([{ class_id: classId, student_id: studentId }]);
        if (insertErr) throw insertErr;

        return res.status(200).json({ status: 'success', message: 'Student enrolled successfully', data: { classId, studentId } });
      }
    } catch (e) {
      // ignore
    }

    return res.status(400).json({ status: 'fail', message: 'Could not enroll student; no enrollment mechanism available' });
  } catch (error) {
    console.error('Enroll by ID error:', error);
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Remove student from class
router.delete('/:classId/students/:studentId', async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') return res.status(403).json({ status: 'fail', message: 'Only teachers can remove students from classes' });

    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: classData, error } = await adminClient.from('classes').select('*').eq('id', req.params.classId).single();
    if (error || !classData) return res.status(404).json({ status: 'fail', message: 'Class not found' });

    // Check if teacher owns this class
    if (req.user.role === 'teacher' && String(classData.teacher_id) !== String(req.user.id)) return res.status(403).json({ status: 'fail', message: 'Not authorized to modify this class' });

    const students = (Array.isArray(classData.students) ? classData.students.filter(s => String(s) !== String(req.params.studentId)) : []).map(String);
    const { error: updateErr } = await adminClient.from('classes').update({ students }).eq('id', req.params.classId);
    if (updateErr) throw updateErr;

    res.status(200).json({ status: 'success', message: 'Student removed from class successfully' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});

// Delete class
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'fail', message: 'Only teachers can delete classes' });
    }

    const adminClient = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: classData, error } = await adminClient.from('classes').select('*').eq('id', req.params.id).single();
    if (error || !classData) return res.status(404).json({ status: 'fail', message: 'Class not found' });

    // Check if teacher owns this class
    if (req.user.role === 'teacher' && String(classData.teacher_id) !== String(req.user.id)) return res.status(403).json({ status: 'fail', message: 'Not authorized to delete this class' });

    const { error: delErr } = await adminClient.from('classes').delete().eq('id', req.params.id);
    if (delErr) throw delErr;

    res.status(200).json({ status: 'success', message: 'Class deleted successfully' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
});



// Leave class (for students) — Supabase-backed
router.post('/:id/leave', async (req, res) => {
  try {
    const requesterRole = req.user?.role || req.user?.user_metadata?.role;
    if (requesterRole !== 'student') {
      return res.status(403).json({ status: 'fail', message: 'Only students can leave classes' });
    }

    const classId = req.params.id;
    const studentId = req.user.id;

    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Verify class exists
    const { data: classData, error: classErr } = await adminClient
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single();
    if (classErr || !classData) {
      return res.status(404).json({ status: 'fail', message: 'Class not found' });
    }

    // Attempt to remove enrollment from class_students table directly
    const { error: delErr } = await adminClient
      .from('class_students')
      .delete()
      .eq('class_id', classId)
      .eq('student_id', studentId);

    if (!delErr) {
      return res.status(200).json({ status: 'success', message: 'Successfully left the class' });
    }

    // If class_students table doesn't exist, fallback to classes.students column when available
    const msg = String(delErr?.message || '');
    const relationMissing = delErr?.code === '42P01' || msg.includes('relation') || msg.includes('does not exist');
    if (!relationMissing) {
      // Deletion failed for another reason
      throw delErr;
    }

    // Fallback: update classes.students array column
    // Ensure the column exists before attempting update
    let hasStudentsColumn = false;
    try {
      const { data: cols } = await adminClient
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'classes')
        .eq('column_name', 'students');
      hasStudentsColumn = !!(cols && cols.length);
    } catch (e) {
      hasStudentsColumn = false;
    }

    if (!hasStudentsColumn) {
      return res.status(500).json({
        status: 'fail',
        message: "Enrollment mechanism not found (no 'class_students' table or 'classes.students' column). Please run the migration to create 'class_students' or add 'students' array column.",
      });
    }

    const students = Array.isArray(classData.students)
      ? classData.students.filter(s => String(s) !== String(studentId))
      : [];

    const { error: updateErr } = await adminClient
      .from('classes')
      .update({ students })
      .eq('id', classId);
    if (updateErr) throw updateErr;

    res.status(200).json({ status: 'success', message: 'Successfully left the class' });
  } catch (error) {
    console.error('POST /classes/:id/leave error:', error);
    res.status(400).json({ status: 'fail', message: error.message || 'Failed to leave class' });
  }
});

module.exports = router;