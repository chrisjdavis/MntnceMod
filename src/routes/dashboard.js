const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const Page = require('../models/MaintenancePage');
const Activity = require('../models/Activity');

// Dashboard home
router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Get user's pages
    const pages = await Page.find({ user: req.user._id }).sort({ updatedAt: -1 }).limit(5);
    
    // Get recent activity
    const activities = await Activity.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get subscription limits
    const subscriptionLimits = await req.user.subscriptionLimits;

    // Check if user can create more pages
    const canCreatePage = await req.user.canCreatePage();

    res.render('dashboard/index', {
      pages,
      activities,
      user: {
        ...req.user.toObject(),
        subscriptionLimits,
        canCreatePage
      }
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/');
  }
});

module.exports = router; 