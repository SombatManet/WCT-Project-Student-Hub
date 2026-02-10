const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const supabase = require('../config/supabase');
const auth = require('../middleware/supabaseAuth');
const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadAvatar = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// ==================== REGISTER ====================
// routes/auth.js update
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ status: 'fail', message: 'username, email and password are required' });
    }

    // Only allow public creation of 'student' or 'teacher'. Admin must be created by an existing admin.
    const allowedRoles = ['student', 'teacher'];
    if (role === 'admin') {
      return res.status(403).json({ status: 'fail', message: 'Cannot create admin via public registration' });
    }
    const finalRole = allowedRoles.includes(role) ? role : 'student';

    // Create Auth User in Supabase
    // Prefer admin.createUser when running with a service role key (server-side)
    let userId;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: { username, role: finalRole },
        email_confirm: true
      });
      if (error) throw error;
      userId = data?.user?.id || data?.id || (data?.user && data.user.id);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, role: finalRole }
        }
      });
      if (error) throw error;
      userId = data?.user?.id;
    }

    // Insert into 'profiles' table
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{ id: userId, username, email, role: finalRole, points: 0 }]);

    if (profileError) throw profileError;

    res.status(201).json({ status: 'success', message: 'Registration successful', user: { id: userId, username, role: finalRole } });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(error?.status || 400).json({ status: 'fail', message: error?.message || 'Registration failed' });
  }
});

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide email and password'
      });
    }

    // Supabase Auth Sign In
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({
        status: 'fail',
        message: 'Incorrect email or password'
      });
    }

    res.status(200).json({
      status: 'success',
      token: data.session.access_token,
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          ...data.user.user_metadata // Contains username and role
        }
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
});

// ==================== PROFILE (server-side) ====================
// Returns the profile for `:id` but only if the requesting user is the same user or an admin.
router.get('/profile/:id', auth, async (req, res) => {
  try {
    const reqId = req.params.id;

    if (req.user.id !== reqId && req.user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ status: 'fail', message: 'Access denied' });
    }

    // Use a fresh admin client to bypass any auth state on the shared client
    const { createClient } = require('@supabase/supabase-js');
    const adminSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('id', reqId)
      .single();

    if (error) return res.status(404).json({ status: 'fail', message: error.message });

    res.status(200).json({ status: 'success', data });
  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await adminClient
      .from('profiles')
      .select('id, username, email, role, created_at, avatar_url')
      .eq('id', userId)
      .single();

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      data: data
    });
  } catch (error) {
    console.error('GET /auth/profile error:', error);
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to fetch profile'
    });
  }
});

// Update user profile
router.patch('/profile', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        status: 'fail',
        message: 'Username is required'
      });
    }

    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await adminClient
      .from('profiles')
      .update({ username: username.trim() })
      .eq('id', userId)
      .select('id, username, email, role, created_at')
      .single();

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      data: data
    });
  } catch (error) {
    console.error('PATCH /auth/profile error:', error);
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to update profile'
    });
  }
});

// Upload profile avatar
router.post('/upload-avatar', auth, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No file uploaded'
      });
    }

    const userId = req.user.id;
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get old avatar to delete
    const { data: oldProfile } = await adminClient
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    // Update profile with new avatar URL
    const { data, error } = await adminClient
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId)
      .select('id, username, email, role, created_at, avatar_url')
      .single();

    if (error) throw error;

    // Delete old avatar file if exists
    if (oldProfile?.avatar_url && oldProfile.avatar_url !== avatarUrl) {
      const oldFilePath = path.join(__dirname, '..', oldProfile.avatar_url);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    res.status(200).json({
      status: 'success',
      data: data
    });
  } catch (error) {
    console.error('POST /auth/upload-avatar error:', error);
    // Delete uploaded file if database update failed
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to upload avatar'
    });
  }
});

// Delete profile avatar
router.delete('/avatar', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get current avatar
    const { data: profile } = await adminClient
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    // Remove avatar URL from database
    const { data, error } = await adminClient
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId)
      .select('id, username, email, role, created_at, avatar_url')
      .single();

    if (error) throw error;

    // Delete avatar file if exists
    if (profile?.avatar_url) {
      const filePath = path.join(__dirname, '..', profile.avatar_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(200).json({
      status: 'success',
      data: data
    });
  } catch (error) {
    console.error('DELETE /auth/avatar error:', error);
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to delete avatar'
    });
  }
});

// Change password
router.patch('/change-password', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: 'fail',
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        status: 'fail',
        message: 'New password must be at least 6 characters'
      });
    }

    // Get user's email from profiles
    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // Verify current password by attempting sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword
    });

    if (signInError) {
      return res.status(401).json({
        status: 'fail',
        message: 'Current password is incorrect'
      });
    }

    // Update password using admin client
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) throw updateError;

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('PATCH /auth/change-password error:', error);
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to change password'
    });
  }
});

module.exports = router;