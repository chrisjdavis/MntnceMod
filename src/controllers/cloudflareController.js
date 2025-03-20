const CloudflareConfig = require('../models/CloudflareConfig');
const CloudflareService = require('../services/cloudflare');

exports.getConfig = async (req, res) => {
  try {
    const config = await CloudflareConfig.findOne({ user: req.user._id });
    if (!config) {
      return res.render('settings/cloudflare/setup', {
        user: req.user,
        active: 'cloudflare',
        title: 'Set Up Cloudflare',
        path: '/settings/cloudflare',
        csrfToken: req.csrfToken()
      });
    }

    res.render('settings/cloudflare/config', {
      user: req.user,
      config,
      active: 'cloudflare',
      title: 'Cloudflare Configuration',
      path: '/settings/cloudflare',
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    console.error('Error loading Cloudflare config:', error);
    req.flash('error', 'Error loading Cloudflare configuration');
    res.redirect('/settings');
  }
};

exports.saveConfig = async (req, res) => {
  try {
    const { apiToken, email, accountId, zoneId, kvNamespaceId, workerName } = req.body;
    console.log('Saving Cloudflare config for user:', req.user._id);
    console.log('Request body:', req.body);

    // Validate required fields
    if (!apiToken || !email || !accountId || !zoneId || !kvNamespaceId) {
      console.log('Missing required fields');
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/settings/cloudflare');
    }

    // Save configuration first
    const config = await CloudflareConfig.findOneAndUpdate(
      { user: req.user._id },
      {
        apiToken,
        email,
        accountId,
        zoneId,
        kvNamespaceId,
        workerName: workerName || 'maintenance-worker',
        lastUsed: new Date()
      },
      { upsert: true, new: true }
    );

    // Test the configuration using CloudflareService
    try {
      await CloudflareService.initializeForUser(req.user._id);
      console.log('Cloudflare configuration saved and verified successfully');
      req.flash('success', 'Cloudflare configuration saved successfully');
    } catch (error) {
      console.error('Cloudflare configuration test failed:', error);
      // If test fails, delete the saved configuration
      await CloudflareConfig.findOneAndDelete({ user: req.user._id });
      req.flash('error', 'Failed to verify Cloudflare credentials. Please check your configuration.');
      return res.redirect('/settings/cloudflare');
    }

    res.redirect('/settings/cloudflare');
  } catch (error) {
    console.error('Error saving Cloudflare config:', error);
    req.flash('error', 'Error saving Cloudflare configuration');
    res.redirect('/settings/cloudflare');
  }
};

exports.deleteConfig = async (req, res) => {
  try {
    await CloudflareConfig.findOneAndDelete({ user: req.user._id });
    req.flash('success', 'Cloudflare configuration deleted successfully');
    res.redirect('/settings/cloudflare');
  } catch (error) {
    console.error('Error deleting Cloudflare config:', error);
    req.flash('error', 'Error deleting Cloudflare configuration');
    res.redirect('/settings/cloudflare');
  }
};

exports.testConfig = async (req, res) => {
  try {
    const config = await CloudflareConfig.findOne({ user: req.user._id });
    if (!config) {
      return res.status(404).json({ error: 'Cloudflare configuration not found' });
    }

    await CloudflareService.initializeForUser(req.user._id);
    res.json({ success: true, message: 'Cloudflare configuration is valid' });
  } catch (error) {
    console.error('Error testing Cloudflare config:', error);
    res.status(500).json({ error: 'Failed to verify Cloudflare configuration' });
  }
}; 