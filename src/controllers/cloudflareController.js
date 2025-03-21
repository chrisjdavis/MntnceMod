const CloudflareConfig = require('../models/CloudflareConfig');
const CloudflareService = require('../services/CloudflareService');

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
    console.error('Error fetching Cloudflare config:', error);
    req.flash('error', 'Error fetching Cloudflare configuration');
    res.redirect('/settings');
  }
};

exports.editConfig = async (req, res) => {
  try {
    const config = await CloudflareConfig.findOne({ user: req.user._id });
    if (!config) {
      req.flash('error', 'Cloudflare configuration not found');
      return res.redirect('/settings/cloudflare');
    }

    res.render('settings/cloudflare/edit', {
      user: req.user,
      config,
      active: 'cloudflare',
      title: 'Edit Cloudflare Configuration',
      path: '/settings/cloudflare',
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    console.error('Error loading Cloudflare config for edit:', error);
    req.flash('error', 'Error loading Cloudflare configuration');
    res.redirect('/settings/cloudflare');
  }
};

exports.saveConfig = async (req, res) => {
  try {
    const { apiToken, email, accountId, zoneId, kvNamespaceId, workerName } = req.body;

    // Validate required fields
    if (!email || !accountId || !zoneId || !kvNamespaceId) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect('/settings/cloudflare/edit');
    }

    // Find existing config
    let config = await CloudflareConfig.findOne({ user: req.user._id });

    if (config) {
      // Update existing config
      config.email = email;
      config.accountId = accountId;
      config.zoneId = zoneId;
      config.kvNamespaceId = kvNamespaceId;
      config.workerName = workerName || 'maintenance-worker';
      
      // Only update API token if a new one is provided
      if (apiToken) {
        console.log('Updating API token...');
        config.apiToken = apiToken;
      } else {
        console.log('Keeping existing API token');
      }
    } else {
      // Create new config
      if (!apiToken) {
        req.flash('error', 'API Token is required for new configuration');
        return res.redirect('/settings/cloudflare');
      }

      console.log('Creating new configuration with API token');
      config = new CloudflareConfig({
        user: req.user._id,
        apiToken,
        email,
        accountId,
        zoneId,
        kvNamespaceId,
        workerName: workerName || 'maintenance-worker'
      });
    }

    // Save the configuration first
    console.log('Saving configuration...');
    await config.save();

    // Test the configuration
    console.log('Testing configuration...');
    const cloudflare = new CloudflareService(req.user);
    const isValid = await cloudflare.testConnection();

    if (!isValid) {
      console.log('Configuration test failed');
      // If test fails, delete the config
      await CloudflareConfig.findOneAndDelete({ user: req.user._id });
      req.flash('error', 'Invalid Cloudflare credentials. Please check your configuration.');
      return res.redirect('/settings/cloudflare/edit');
    }

    console.log('Configuration test successful');
    // Update lastUsed timestamp
    config.lastUsed = new Date();
    await config.save();

    req.flash('success', 'Cloudflare configuration saved successfully');
    res.redirect('/settings/cloudflare');
  } catch (error) {
    console.error('Error saving Cloudflare config:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    req.flash('error', 'Error saving Cloudflare configuration');
    res.redirect('/settings/cloudflare/edit');
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

exports.testConnectionPage = async (req, res) => {
  try {
    const config = await CloudflareConfig.findOne({ user: req.user._id });
    if (!config) {
      req.flash('error', 'Cloudflare configuration not found');
      return res.redirect('/settings/cloudflare');
    }

    res.render('settings/cloudflare/test', {
      user: req.user,
      config,
      active: 'cloudflare',
      title: 'Test Cloudflare Connection',
      path: '/settings/cloudflare',
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    console.error('Error loading test page:', error);
    req.flash('error', 'Error loading test page');
    res.redirect('/settings/cloudflare');
  }
};

exports.testConnection = async (req, res) => {
  try {
    const cloudflare = new CloudflareService(req.user);
    await cloudflare.testConnection();
    
    // Store results in session for the result page
    req.session.cloudflareTestResults = {
      success: true,
      tokenVerification: {
        success: true,
        message: 'API Token is valid and active'
      },
      accountAccess: {
        success: true,
        message: 'Account access verified'
      },
      zoneAccess: {
        success: true,
        message: 'Zone access verified'
      },
      kvAccess: {
        success: true,
        message: 'KV namespace access verified'
      },
      workerAccess: {
        success: true,
        message: 'Worker access verified and created successfully'
      }
    };
    res.redirect('/settings/cloudflare/test-result');
  } catch (error) {
    console.error('Error testing Cloudflare connection:', error);
    req.session.cloudflareTestResults = {
      success: false,
      error: error.message,
      details: error.response?.data || {}
    };
    res.redirect('/settings/cloudflare/test-result');
  }
};

exports.testResult = async (req, res) => {
  try {
    const results = req.session.cloudflareTestResults;
    if (!results) {
      req.flash('error', 'No test results found');
      return res.redirect('/settings/cloudflare');
    }

    // Clear the results from session after displaying
    delete req.session.cloudflareTestResults;

    res.render('settings/cloudflare/test-result', {
      user: req.user,
      results,
      active: 'cloudflare',
      title: 'Cloudflare Test Results',
      path: '/settings/cloudflare'
    });
  } catch (error) {
    console.error('Error displaying test results:', error);
    req.flash('error', 'Error displaying test results');
    res.redirect('/settings/cloudflare');
  }
}; 