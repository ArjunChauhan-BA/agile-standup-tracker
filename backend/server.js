const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const { sendEmail, scheduleEmail } = require('./emailService');
require('dotenv').config();

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
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Agile Standup Tracker API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      sendEmail: '/api/send-email',
      scheduleEmail: '/api/schedule-email'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    emailConfigured: !!process.env.EMAIL_USER
  });
});

// Send email immediately
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, body, html } = req.body;

    // Validation
    if (!to || !subject || !body) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: to, subject, body' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email address' 
      });
    }

    console.log(`📧 Sending email to: ${to}`);
    const result = await sendEmail({ to, subject, body, html });

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Email sent successfully', 
        messageId: result.messageId,
        to: to
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('❌ Error in /api/send-email:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Schedule email for later
app.post('/api/schedule-email', async (req, res) => {
   console.log("POST /api/schedule-email NUDGE");
   console.log('Server current UTC:', new Date().toISOString());
   
  try {
    const { to, subject, body, html, scheduledTime } = req.body;

    // Validation
    if (!to || !subject || !body || !scheduledTime) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: to, subject, body, scheduledTime' 
      });
    }

    // Validate scheduled time is in future
    
    const scheduledDate = new Date(scheduledTime);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ 
        success: false,
        error: 'Scheduled time must be in the future' 
      });
    }

    console.log(`⏰ Scheduling email to: ${to} for ${scheduledDate.toLocaleString()}`);
    scheduleEmail({ to, subject, body, html }, scheduledTime);

    res.json({ 
      success: true, 
      message: 'Email scheduled successfully',
      scheduledFor: scheduledDate.toISOString()
    });
  } catch (error) {
    console.error('❌ Error in /api/schedule-email:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});
// Add this route before your 404 handler
app.post('/api/github-activity', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const response = await axios.get(`https://api.github.com/users/${username}/events`, {
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN.trim()}`, 
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Agile-Standup-Tracker' 
      }
    });

    // 1. Broaden the filter to include 'CreateEvent' (for new repos) and 'PushEvent'
// Replace the filter/map logic in your /api/github-activity route
const activities = response.data
  .filter(event => ['PushEvent', 'CreateEvent', 'WatchEvent'].includes(event.type)) // Added CreateEvent
  .map(event => {
    let action = "Updated";
    if (event.type === 'PushEvent') action = `🚀 Pushed code to ${event.repo.name}`;
    if (event.type === 'CreateEvent') action = `🆕 Created repository ${event.repo.name}`;
    if (event.type === 'WatchEvent') action = `⭐ Starred ${event.repo.name}`;

    return {
      text: `🐙 GitHub: ${action}`,
      time: new Date(event.created_at).toLocaleTimeString()
    };
  })
  .slice(0, 5);

    console.log(`✅ Found ${activities.length} activities for ${username}`);
    res.json({ success: true, activities });
  } catch (error) {
    console.error('GitHub API Error:', error.message);
    res.status(500).json({ success: false, error: 'Could not fetch GitHub data' });
  }
});
// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 Agile Standup Tracker API');
  console.log('='.repeat(50));
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER || 'NOT CONFIGURED'}`);
  console.log(`🌐 CORS: ${process.env.FRONTEND_URL}`);
  console.log(`⏰ Cron jobs: Active`);
  console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});