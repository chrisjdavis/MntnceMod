const Settings = require('../models/Settings');

const defaultSettings = {
  siteName: 'StatusSaaS',
  siteUrl: '',
  smtpHost: '',
  smtpPort: '',
  smtpUser: '',
  smtpPass: '',
  stripeSecretKey: '',
  stripePublishableKey: ''
};

async function loadSettings(req, res, next) {
  try {
    const settings = await Settings.findOne() || defaultSettings;
    // Make settings available in all views
    res.locals.settings = settings;
    // Also attach to request object for middleware/route usage
    req.settings = settings;
    next();
  } catch (error) {
    console.error('Error loading settings:', error);
    // Even if there's an error, provide default settings
    res.locals.settings = defaultSettings;
    req.settings = defaultSettings;
    next();
  }
}

module.exports = loadSettings; 