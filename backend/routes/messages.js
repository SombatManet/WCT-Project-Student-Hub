const express = require('express');
const auth = require('../middleware/supabaseAuth');
const router = express.Router();

// Middleware to ensure auth
router.use(auth);

// Get available users to message (filtered by role or search)
router.get('/users/available', async (req, res) => {
  try {
    const userId = req.user.id;
    const { role, search } = req.query;

    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let query = adminClient
      .from('profiles')
      .select('id, username, email, role')
      .neq('id', userId);

    if (role) {
      query = query.eq('role', role);
    }

    if (search) {
      query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, error } = await query.order('username', { ascending: true });

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      results: users?.length || 0,
      data: { users: users || [] }
    });
  } catch (error) {
    console.error('GET /messages/users/available error:', error);
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to fetch users'
    });
  }
});

// Get all conversations for current user (with latest message)
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user.id;
    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get all unique conversations
    const { data: messages, error } = await adminClient
      .from('personal_messages')
      .select('sender_id, recipient_id, message, created_at, read_at')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group conversations
    const conversations = new Map();

    messages.forEach((msg) => {
      const otherId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
      const key = [userId, otherId].sort().join('_');

      if (!conversations.has(key)) {
        conversations.set(key, {
          otherUserId: otherId,
          lastMessage: msg.message,
          lastMessageTime: msg.created_at,
          unreadCount: 0
        });
      }

      // Count unread messages
      if (msg.recipient_id === userId && !msg.read_at) {
        conversations.get(key).unreadCount++;
      }
    });

    // Fetch user details for each conversation
    const conversationList = Array.from(conversations.values());
    const userIds = conversationList.map((c) => c.otherUserId);

    if (userIds.length === 0) {
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: { conversations: [] }
      });
    }

    const { data: profiles, error: profileError } = await adminClient
      .from('profiles')
      .select('id, username, email, role')
      .in('id', userIds);

    if (profileError) throw profileError;

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const enrichedConversations = conversationList.map((conv) => ({
      ...conv,
      user: profileMap.get(conv.otherUserId)
    }));

    res.status(200).json({
      status: 'success',
      results: enrichedConversations.length,
      data: { conversations: enrichedConversations }
    });
  } catch (error) {
    console.error('GET /messages/conversations error:', error);
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to fetch conversations'
    });
  }
});

// Get messages with a specific user
router.get('/:recipientId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipientId } = req.params;

    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch messages (both directions)
    const { data: messages, error } = await adminClient
      .from('personal_messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Mark received messages as read
    await adminClient
      .from('personal_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', userId)
      .eq('sender_id', recipientId)
      .is('read_at', null);

    // Fetch recipient profile
    const { data: recipient, error: recipientError } = await adminClient
      .from('profiles')
      .select('id, username, email, role')
      .eq('id', recipientId)
      .single();

    if (recipientError) throw recipientError;

    res.status(200).json({
      status: 'success',
      results: messages?.length || 0,
      data: {
        messages: messages || [],
        recipient
      }
    });
  } catch (error) {
    console.error('GET /messages/:recipientId error:', error);
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to fetch messages'
    });
  }
});

// Send a message
router.post('/', async (req, res) => {
  try {
    const { recipientId, message } = req.body;
    const senderId = req.user.id;

    if (!recipientId || !message) {
      return res.status(400).json({
        status: 'fail',
        message: 'recipientId and message are required'
      });
    }

    if (senderId === recipientId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot send message to yourself'
      });
    }

    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await adminClient
      .from('personal_messages')
      .insert([{
        sender_id: senderId,
        recipient_id: recipientId,
        message: message.trim()
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      status: 'success',
      data: { message: data }
    });
  } catch (error) {
    console.error('POST /messages error:', error);
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to send message'
    });
  }
});

// Mark messages as read
router.patch('/:messageId/read', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const adminClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await adminClient
      .from('personal_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('recipient_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      data: { message: data }
    });
  } catch (error) {
    console.error('PATCH /messages/:messageId/read error:', error);
    res.status(500).json({
      status: 'fail',
      message: error.message || 'Failed to mark message as read'
    });
  }
});

module.exports = router;
