const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();

const { sendEmail, scheduleEmail } = require('./emailService');
const { fetchGitHubActivity } = require('./githubService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next()
});

// Root Route
app.get('/', (req, res) => {
  res.json({
    message: 'Agile Standup Tracker API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      sendEmail: '/api/send-email',
      scheduleEmail: '/api/schedule-email',
      githubActivity: '/api/github-activity'
    }
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    emailConfigured: !!process.env.EMAIL_USER,
    githubConfigured: !!process.env.GITHUB_TOKEN
  });
});

// Send Email Immediately
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, body, html } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, body'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    console.log(`📧 Sending email to: ${to}`);
    const result = await sendEmail({ to, subject, body, html });

    if (result.success) {
      return res.json({
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId,
        to
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error /api/send-email:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Schedule Email
app.post('/api/schedule-email', async (req, res) => {
  try {
    const { to, subject, body, html, scheduledTime } = req.body;

    if (!to || !subject || !body || !scheduledTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const scheduledDate = new Date(scheduledTime);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid scheduledTime format'
      });
    }

    if (scheduledDate <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled time must be in the future'
      });
    }

    console.log(`⏰ Scheduling email to ${to} at ${scheduledDate.toLocaleString()}`);
    scheduleEmail({ to, subject, body, html }, scheduledDate);

    return res.json({
      success: true,
      message: 'Email scheduled successfully',
      scheduledFor: scheduledDate.toISOString()
    });
  } catch (error) {
    console.error('❌ Error /api/schedule-email:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Fetch GitHub Activity
app.post('/api/github-activity', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'GitHub username is required'
      });
    }

    console.log(`🐙 Fetching GitHub activity for ${username}`);
    const activities = await fetchGitHubActivity(username);

    return res.json({
      success: true,
      activities,
      count: activities.length
    });
  } catch (error) {
    console.error('❌ Error /api/github-activity:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 Agile Standup Tracker API Started');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER || 'NOT CONFIGURED'}`);
  console.log(`🌐 CORS: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`🐙 GitHub: ${process.env.GITHUB_TOKEN ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  console.log('='.repeat(50));
});
