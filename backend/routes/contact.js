const express = require('express');
const auth = require('../middleware/supabaseAuth');
const router = express.Router();

// Public endpoint - no auth required
router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        status: 'fail',
        message: 'Name, email, and message are required'
      });
    }

    // Basic email validation
    if (!email.includes('@')) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid email address'
      });
    }

    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await adminClient
      .from('contact_messages')
      .insert([{
        name: name.trim(),
        email: email.trim().toLowerCase(),
        message: message.trim(),
        status: 'unread'
      }])
      .select()
      .single();

    if (error) {
      console.error('Contact message insert error:', error);
      throw error;
    }

    res.status(201).json({
      status: 'success',
      message: 'Message sent successfully',
      data: { id: data.id }
    });
  } catch (error) {
    console.error('POST /contact error:', error);
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to send message'
    });
  }
});

// Admin endpoints - require auth
router.use(auth);

// Get all contact messages (admin only)
router.get('/', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Admin access required'
      });
    }

    const { status } = req.query;
    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let query = adminClient
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && ['unread', 'read', 'archived'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      results: data?.length || 0,
      data: { messages: data || [] }
    });
  } catch (error) {
    console.error('GET /contact error:', error);
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to fetch messages'
    });
  }
});

// Update message status (admin only)
router.patch('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Admin access required'
      });
    }

    const { status } = req.body;

    if (!['unread', 'read', 'archived'].includes(status)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid status. Must be unread, read, or archived'
      });
    }

    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await adminClient
      .from('contact_messages')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      data: { message: data }
    });
  } catch (error) {
    console.error('PATCH /contact/:id error:', error);
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to update message'
    });
  }
});

// Delete message (admin only)
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Admin access required'
      });
    }

    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await adminClient
      .from('contact_messages')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('DELETE /contact/:id error:', error);
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to delete message'
    });
  }
});

// Reply to contact message (admin only)
router.post('/:id/reply', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Admin access required'
      });
    }

    const { reply } = req.body;

    if (!reply || !reply.trim()) {
      return res.status(400).json({
        status: 'fail',
        message: 'Reply message is required'
      });
    }

    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get the contact message
    const { data: message, error: fetchError } = await adminClient
      .from('contact_messages')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError) throw fetchError;

    if (!message) {
      return res.status(404).json({
        status: 'fail',
        message: 'Contact message not found'
      });
    }

    // Update message with reply
    const { data, error } = await adminClient
      .from('contact_messages')
      .update({ 
        admin_reply: reply.trim(),
        replied_by: req.user.id,
        replied_at: new Date().toISOString(),
        status: message.status === 'unread' ? 'read' : message.status
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      message: 'Reply sent successfully',
      data: { message: data }
    });
  } catch (error) {
    console.error('POST /contact/:id/reply error:', error);
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to send reply'
    });
  }
});

module.exports = router;
