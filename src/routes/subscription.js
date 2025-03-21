const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { isAuthenticated } = require('../middleware/auth');

// Get all subscription plans
router.get('/plans', subscriptionController.getSubscriptionPlans);

// Create a new subscription
router.post('/create', isAuthenticated, subscriptionController.createSubscription);

// Update an existing subscription
router.post('/update', isAuthenticated, subscriptionController.updateSubscription);

// Cancel a subscription
router.post('/cancel', isAuthenticated, subscriptionController.cancelSubscription);

module.exports = router; 