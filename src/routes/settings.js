const express = require('express');
const router = express.Router();
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const MaintenancePage = require('../models/MaintenancePage');
const { isAuthenticated } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const LoginHistory = require('../models/LoginHistory');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// GET /settings - Show settings page
router.get('/', isAuthenticated, (req, res) => {
  res.locals.title = 'Profile Settings';
  const success = req.flash('success');
  const error = req.flash('error');
  
  const renderData = {
    user: req.user,
    active: 'settings',
    title: 'Profile Settings',
    path: '/settings'
  };

  // Only include messages if they have actual content
  if (success && success.length > 0) {
    renderData.messages = { success };
  }
  if (error && error.length > 0) {
    renderData.messages = {
      ...renderData.messages,
      error
    };
  }
  
  res.render('settings/profile', renderData);
});

// GET /settings/appearance - Show appearance settings page
router.get('/appearance', isAuthenticated, (req, res) => {
  res.locals.title = 'Appearance Settings';
  const success = req.flash('success');
  const error = req.flash('error');
  
  const renderData = {
    user: req.user,
    active: 'settings',
    title: 'Appearance Settings',
    path: '/settings/appearance'
  };

  // Only include messages if they have actual content
  if (success && success.length > 0) {
    renderData.messages = { success };
  }
  if (error && error.length > 0) {
    renderData.messages = {
      ...renderData.messages,
      error
    };
  }
  
  res.render('settings/appearance', renderData);
});

// GET /settings/notifications - Show notifications settings page
router.get('/notifications', isAuthenticated, (req, res) => {
  res.locals.title = 'Notification Settings';
  const success = req.flash('success');
  const error = req.flash('error');
  
  const renderData = {
    user: req.user,
    active: 'settings',
    title: 'Notification Settings',
    path: '/settings/notifications'
  };

  // Only include messages if they have actual content
  if (success && success.length > 0) {
    renderData.messages = { success };
  }
  if (error && error.length > 0) {
    renderData.messages = {
      ...renderData.messages,
      error
    };
  }
  
  res.render('settings/notifications', renderData);
});

// POST /settings - Update settings
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    // Update name and email
    user.name = name;
    user.email = email;

    // Update password if provided
    if (currentPassword && newPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        req.flash('error', 'Current password is incorrect');
        return res.redirect('/settings');
      }
      user.password = newPassword;
    }

    await user.save();
    req.flash('success', 'Profile updated successfully');
    res.redirect('/settings');
  } catch (error) {
    console.error('Error updating profile:', error);
    req.flash('error', 'Error updating profile');
    res.redirect('/settings');
  }
});

// Update theme
router.post('/appearance', isAuthenticated, async (req, res) => {
  try {
    const { theme } = req.body;
    
    if (!['default', 'dark'].includes(theme)) {
      req.flash('error', 'Invalid theme selection');
      return res.redirect('/settings/appearance');
    }

    const user = await User.findById(req.user._id);
    user.theme = theme;
    await user.save();

    // Update the theme in the session
    req.session.theme = theme;

    req.flash('success', 'Theme updated successfully');
    res.redirect('/settings/appearance');
  } catch (error) {
    console.error('Error updating theme:', error);
    req.flash('error', 'Error updating theme');
    res.redirect('/settings/appearance');
  }
});

// Update notifications
router.post('/notifications', isAuthenticated, async (req, res) => {
  try {
    const { comments, mentions, updates } = req.body;
    
    const user = await User.findById(req.user._id);
    
    // Initialize notifications object if it doesn't exist
    if (!user.notifications) {
      user.notifications = {};
    }
    
    // Update notification preferences
    user.notifications.comments = !!comments;
    user.notifications.mentions = !!mentions;
    user.notifications.updates = !!updates;
    
    await user.save();

    req.flash('success', 'Notification preferences updated successfully');
    res.redirect('/settings/notifications');
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    req.flash('error', 'Error updating notification preferences');
    res.redirect('/settings/notifications');
  }
});

// Subscription Settings
router.get('/subscription', isAuthenticated, async (req, res) => {
  try {
    const currentPlan = await req.user.getPlanDetails();
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    const pageCount = await MaintenancePage.countDocuments({ user: req.user._id });

    const success = req.flash('success');
    const error = req.flash('error');
    
    const renderData = {
      user: req.user,
      active: 'subscription',
      currentPlan,
      plans,
      pageCount,
      title: 'Subscription Settings',
      path: '/settings/subscription'
    };

    // Only include messages if they have actual content
    if (success && success.length > 0) {
      renderData.messages = { success };
    }
    if (error && error.length > 0) {
      renderData.messages = {
        ...renderData.messages,
        error
      };
    }

    res.locals.title = 'Subscription Settings';
    res.render('settings/subscription', renderData);
  } catch (error) {
    console.error('Error loading subscription settings:', error);
    req.flash('error', 'Failed to load subscription settings');
    res.redirect('/settings');
  }
});

// Subscription confirmation page
router.post('/subscription/confirm', isAuthenticated, async (req, res) => {
  try {
    const { planCode } = req.body;
    
    // Validate plan exists and is active
    const newPlan = await SubscriptionPlan.findOne({ code: planCode, isActive: true });
    if (!newPlan) {
      req.flash('error', 'Invalid plan selected');
      return res.redirect('/settings/subscription');
    }

    // Get current plan details
    const currentPlan = await req.user.getPlanDetails();

    // Allow downgrading to free plan at any time
    if (planCode === 'free') {
      req.user.subscription.plan = planCode;
      req.user.subscription.status = 'active';
      await req.user.save();
      req.flash('success', 'Subscription plan updated successfully');
      return res.redirect('/settings/subscription');
    }

    // For paid plans, check if user has an active subscription
    if (!req.user.hasActiveSubscription()) {
      req.flash('error', 'Please activate your subscription before changing plans');
      return res.redirect('/settings/subscription');
    }

    res.render('settings/subscription-confirm', {
      user: req.user,
      active: 'subscription',
      currentPlan,
      newPlan,
      title: 'Confirm Subscription Change',
      path: '/settings/subscription'
    });
  } catch (error) {
    console.error('Error loading subscription confirmation:', error);
    req.flash('error', 'Failed to load subscription confirmation');
    res.redirect('/settings/subscription');
  }
});

// Change subscription plan
router.post('/subscription/change-plan', isAuthenticated, async (req, res) => {
  try {
    const { planCode } = req.body;
    
    // Validate plan exists and is active
    const newPlan = await SubscriptionPlan.findOne({ code: planCode, isActive: true });
    if (!newPlan) {
      req.flash('error', 'Invalid plan selected');
      return res.redirect('/settings/subscription');
    }

    // Allow downgrading to free plan at any time
    if (planCode === 'free') {
      req.user.subscription.plan = planCode;
      req.user.subscription.status = 'active';
      await req.user.save();
      req.flash('success', 'Subscription plan updated successfully');
      return res.redirect('/settings/subscription');
    }

    // For paid plans, check if user has an active subscription
    if (!req.user.hasActiveSubscription()) {
      req.flash('error', 'Please activate your subscription before changing plans');
      return res.redirect('/settings/subscription');
    }

    // Update user's subscription plan
    req.user.subscription.plan = planCode;
    await req.user.save();

    req.flash('success', 'Subscription plan updated successfully');
    res.redirect('/settings/subscription');
  } catch (error) {
    console.error('Error changing subscription plan:', error);
    req.flash('error', 'Failed to update subscription plan');
    res.redirect('/settings/subscription');
  }
});

// GET /settings/security - Show security settings page
router.get('/security', isAuthenticated, async (req, res) => {
  try {
    const loginHistory = await LoginHistory.find({ user: req.user._id })
      .sort({ timestamp: -1 })
      .limit(10);

    res.locals.title = 'Security Settings';
    const success = req.flash('success');
    const error = req.flash('error');
    
    const renderData = {
      user: req.user,
      active: 'settings',
      title: 'Security Settings',
      path: '/settings/security',
      loginHistory
    };

    // Only include messages if they have actual content
    if (success && success.length > 0) {
      renderData.messages = { success };
    }
    if (error && error.length > 0) {
      renderData.messages = {
        ...renderData.messages,
        error
      };
    }
    
    res.render('settings/security', renderData);
  } catch (error) {
    console.error('Error loading security settings:', error);
    req.flash('error', 'Error loading security settings');
    res.redirect('/settings');
  }
});

// POST /settings/security/password - Update password
router.post('/security/password', isAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate password match
    if (newPassword !== confirmPassword) {
      req.flash('error', 'New passwords do not match');
      return res.redirect('/settings/security');
    }

    // Validate current password
    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      req.flash('error', 'Current password is incorrect');
      return res.redirect('/settings/security');
    }

    // Update password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    req.flash('success', 'Password updated successfully');
    res.redirect('/settings/security');
  } catch (error) {
    console.error('Error updating password:', error);
    req.flash('error', 'Error updating password');
    res.redirect('/settings/security');
  }
});

// GET /settings/security/2fa/setup - Setup 2FA
router.get('/security/2fa/setup', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.twoFactorEnabled) {
      req.flash('error', 'Two-factor authentication is already enabled');
      return res.redirect('/settings/security');
    }

    // Generate a secret key
    const secret = speakeasy.generateSecret({
      name: `StatusSaaS:${user.email}`
    });

    // Store the secret temporarily in the session
    req.session.temp2FASecret = secret.base32;

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.locals.title = 'Setup Two-Factor Authentication';
    res.render('settings/2fa-setup', {
      user: req.user,
      active: 'settings',
      title: 'Setup Two-Factor Authentication',
      path: '/settings/security',
      qrCodeUrl,
      secret: secret.base32
    });
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    req.flash('error', 'Error setting up two-factor authentication');
    res.redirect('/settings/security');
  }
});

// POST /settings/security/2fa/verify - Verify and enable 2FA
router.post('/security/2fa/verify', isAuthenticated, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user._id);

    if (!req.session.temp2FASecret) {
      req.flash('error', '2FA setup session expired. Please try again.');
      return res.redirect('/settings/security');
    }

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret: req.session.temp2FASecret,
      encoding: 'base32',
      token: code
    });

    if (!verified) {
      req.flash('error', 'Invalid verification code. Please try again.');
      return res.redirect('/settings/security/2fa/setup');
    }

    // Enable 2FA
    user.twoFactorEnabled = true;
    user.twoFactorSecret = req.session.temp2FASecret;
    await user.save();

    // Clear the temporary secret from the session
    delete req.session.temp2FASecret;

    req.flash('success', 'Two-factor authentication has been enabled successfully');
    res.redirect('/settings/security');
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    req.flash('error', 'Error verifying two-factor authentication');
    res.redirect('/settings/security');
  }
});

// POST /settings/security/2fa/disable - Disable 2FA
router.post('/security/2fa/disable', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.twoFactorEnabled) {
      req.flash('error', 'Two-factor authentication is not enabled');
      return res.redirect('/settings/security');
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    req.flash('success', 'Two-factor authentication has been disabled');
    res.redirect('/settings/security');
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    req.flash('error', 'Error disabling two-factor authentication');
    res.redirect('/settings/security');
  }
});

module.exports = router; 