const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const cloudflareController = require('../controllers/cloudflareController');

// All routes require authentication
router.use(isAuthenticated);

// Get Cloudflare configuration
router.get('/config', cloudflareController.getConfig);

// Save Cloudflare configuration
router.post('/save', cloudflareController.saveConfig);

// Delete Cloudflare configuration
router.post('/delete', cloudflareController.deleteConfig);

// Test Cloudflare configuration
router.post('/test', cloudflareController.testConnection);

module.exports = router; 