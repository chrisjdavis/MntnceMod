const nodemailer = require('nodemailer');
const Settings = require('../models/Settings');

async function getTransporter() {
  const settings = await Settings.findOne();
  if (!settings || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPass) {
    throw new Error('SMTP settings not configured');
  }

  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass
    }
  });
}

async function sendEmail(to, subject, html) {
  try {
    const settings = await Settings.findOne();
    const transporter = await getTransporter();
    
    const info = await transporter.sendMail({
      from: `"${settings?.siteName || 'StatusSaaS'}" <${settings?.smtpUser}>`,
      to,
      subject,
      html
    });

    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

module.exports = {
  sendEmail
}; 