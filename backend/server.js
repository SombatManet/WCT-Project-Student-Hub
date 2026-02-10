const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Supabase Connection Check (Optional but recommended)
const supabase = require('./config/supabase');
if (supabase) {
    console.log('✅ Supabase Client Initialized');
}

// Routes
// Note: Ensure you have refactored these route files to use the Supabase client
app.use('/api/auth', require('./routes/auth'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/quizzes', require('./routes/quiz'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/activity', require('./routes/activity'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});