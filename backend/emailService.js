const nodemailer = require("nodemailer");
const cron = require("node-cron");
require("dotenv").config();

// Validate .env credentials
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
  console.warn("⚠️ Email credentials not configured. Check .env file.");
}

// Create transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, // Use EMAIL_PASSWORD from .env
  },
  tls: {
    rejectUnauthorized: false, // Avoid TLS errors
  },
});

// Verify email configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email configuration error:", error.message);
  } else {
    console.log("✅ Email service is ready");
  }
});

// Send email immediately
const sendEmail = async ({ to, subject, body, html }) => {
  try {
    const mailOptions = {
      from: `"Agile Standup Tracker" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: body,
      html: html || body.replace(/\n/g, "<br>"),
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId, response: info.response };
  } catch (error) {
    console.error(`❌ Failed to send email:`, error.message);
    return { success: false, error: error.message };
  }
};

// Store scheduled emails in memory
const scheduledEmails = [];

// Schedule email
const scheduleEmail = ({ to, subject, body, html }, scheduledTime) => {
  const scheduledDate = new Date(scheduledTime);

  if (isNaN(scheduledDate.getTime())) {
    console.error("❌ Invalid scheduledTime:", scheduledTime);
    return;
  }

  scheduledEmails.push({
    to,
    subject,
    body,
    html,
    scheduledTime: scheduledDate,
    sent: false,
    id: Date.now(),
  });

  console.log("⏰ Email scheduled:");
  console.log("   → To:", to);
  console.log("   → Subject:", subject);
  console.log("   → At:", scheduledDate.toLocaleString());
};

// Cron job to send scheduled emails every minute
cron.schedule("* * * * *", async () => {
  const now = new Date();
  let sentCount = 0;

  for (const email of scheduledEmails) {
    if (!email.sent && email.scheduledTime <= now) {
      console.log(`📨 Sending scheduled email: ${email.subject}`);
      const result = await sendEmail(email);

      if (result.success) {
        email.sent = true;
        sentCount++;
      }
    }
  }

  if (sentCount > 0) console.log(`✅ Sent ${sentCount} scheduled email(s)`);

  // Cleanup emails older than 24 hours
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const beforeCleanup = scheduledEmails.length;
  for (let i = scheduledEmails.length - 1; i >= 0; i--) {
    if (scheduledEmails[i].sent && scheduledEmails[i].scheduledTime < oneDayAgo) {
      scheduledEmails.splice(i, 1);
    }
  }

  if (beforeCleanup !== scheduledEmails.length) {
    console.log(`🧹 Cleaned ${beforeCleanup - scheduledEmails.length} old emails`);
  }
});

module.exports = { sendEmail, scheduleEmail };
