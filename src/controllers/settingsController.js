const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const MaintenancePage = require('../models/MaintenancePage');
const LoginHistory = require('../models/LoginHistory');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

exports.getProfile = async (req, res) => {
  try {
    res.render('settings/profile', {
      user: req.user,
      active: 'profile',
      title: 'Profile Settings',
      path: '/settings'
    });
  } catch (error) {
    console.error('Error loading profile settings:', error);
    req.flash('error', 'Error loading profile settings');
    res.redirect('/dashboard');
  }
};

exports.updateProfile = async (req, res) => {
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
};

exports.getNotifications = async (req, res) => {
  try {
    res.render('settings/notifications', {
      user: req.user,
      active: 'notifications',
      title: 'Notification Settings',
      path: '/settings/notifications'
    });
  } catch (error) {
    console.error('Error loading notification settings:', error);
    req.flash('error', 'Error loading notification settings');
    res.redirect('/settings');
  }
};

exports.updateNotifications = async (req, res) => {
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
};

exports.getSubscription = async (req, res) => {
  try {
    const currentPlan = await req.user.getPlanDetails();
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    const pageCount = await MaintenancePage.countDocuments({ user: req.user._id });
    
    res.render('settings/subscription', {
      user: req.user,
      active: 'subscription',
      currentPlan,
      plans,
      pageCount,
      title: 'Subscription Settings',
      path: '/settings/subscription'
    });
  } catch (error) {
    console.error('Error loading subscription settings:', error);
    req.flash('error', 'Failed to load subscription settings');
    res.redirect('/settings');
  }
};

exports.updateSubscription = async (req, res) => {
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

    // Update user's subscription plan
    req.user.subscription.plan = planCode;
    await req.user.save();

    req.flash('success', 'Subscription plan updated successfully');
    res.redirect('/settings/subscription');
  } catch (error) {
    console.error('Error updating subscription:', error);
    req.flash('error', 'Failed to update subscription');
    res.redirect('/settings/subscription');
  }
};

exports.getSecurity = async (req, res) => {
  try {
    const loginHistory = await LoginHistory.find({ user: req.user._id })
      .sort({ timestamp: -1 })
      .limit(10);

    res.render('settings/security', {
      user: req.user,
      active: 'security',
      title: 'Security Settings',
      path: '/settings/security',
      loginHistory
    });
  } catch (error) {
    console.error('Error loading security settings:', error);
    req.flash('error', 'Error loading security settings');
    res.redirect('/settings');
  }
};

exports.updateSecurity = async (req, res) => {
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
};

exports.setupTwoFactor = async (req, res) => {
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

    res.render('settings/2fa-setup', {
      user: req.user,
      active: 'security',
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
};

exports.verifyTwoFactor = async (req, res) => {
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
};

exports.disableTwoFactor = async (req, res) => {
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
};

exports.getAppearance = async (req, res) => {
  try {
    res.render('settings/appearance', {
      user: req.user,
      active: 'appearance',
      title: 'Appearance Settings',
      path: '/settings/appearance'
    });
  } catch (error) {
    console.error('Error loading appearance settings:', error);
    req.flash('error', 'Error loading appearance settings');
    res.redirect('/settings');
  }
};

exports.updateAppearance = async (req, res) => {
  try {
    const { theme, accentColor } = req.body;
    const user = await User.findById(req.user._id);

    // Update appearance settings
    user.settings = user.settings || {};
    user.settings.theme = theme;
    user.settings.accentColor = accentColor;

    await user.save();
    req.flash('success', 'Appearance settings updated successfully');
    res.redirect('/settings/appearance');
  } catch (error) {
    console.error('Error updating appearance settings:', error);
    req.flash('error', 'Error updating appearance settings');
    res.redirect('/settings/appearance');
  }
}; 