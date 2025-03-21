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
const settingsController = require('../controllers/settingsController');
const cloudflareController = require('../controllers/cloudflareController');

// All routes require authentication
router.use(isAuthenticated);

// Profile settings
router.get('/', settingsController.getProfile);
router.post('/profile', settingsController.updateProfile);

// Appearance settings
router.get('/appearance', settingsController.getAppearance);
router.post('/appearance', settingsController.updateAppearance);

// Notification settings
router.get('/notifications', settingsController.getNotifications);
router.post('/notifications', settingsController.updateNotifications);

// Subscription settings
router.get('/subscription', settingsController.getSubscription);
router.post('/subscription/confirm', settingsController.confirmSubscriptionChange);
router.post('/subscription/change-plan', settingsController.updateSubscription);

// Security settings
router.get('/security', settingsController.getSecurity);
router.post('/security', settingsController.updateSecurity);

// Two-factor authentication
router.get('/security/2fa/setup', settingsController.setupTwoFactor);
router.post('/security/2fa/verify', settingsController.verifyTwoFactor);
router.post('/security/2fa/disable', settingsController.disableTwoFactor);

// Cloudflare routes
router.get('/cloudflare', cloudflareController.getConfig);
router.get('/cloudflare/edit', cloudflareController.editConfig);
router.post('/cloudflare/save', cloudflareController.saveConfig);
router.post('/cloudflare/delete', cloudflareController.deleteConfig);
router.get('/cloudflare/test', cloudflareController.testConnectionPage);
router.post('/cloudflare/test', cloudflareController.testConnection);
router.get('/cloudflare/test-result', cloudflareController.testResult);

module.exports = router; 