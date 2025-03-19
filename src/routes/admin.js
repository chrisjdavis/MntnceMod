const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');
const User = require('../models/User');
const MaintenancePage = require('../models/MaintenancePage');
const Activity = require('../models/Activity');
const Settings = require('../models/Settings');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');

// Helper function to get admin dashboard stats
async function getAdminStats() {
  try {
    // Get total users
    const totalUsers = await User.countDocuments();
    
    // Debug: Check all pages and their status
    const allPages = await MaintenancePage.find({}, 'title status');
    
    // Get published pages
    const activePages = await MaintenancePage.countDocuments({ status: 'published' });
    
    // Get active subscriptions
    const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });
    
    // Calculate 30-day revenue
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentSubscriptions = await Subscription.find({
      createdAt: { $gte: thirtyDaysAgo },
      status: 'active'
    });
    
    const revenue = recentSubscriptions.reduce((total, sub) => {
      return total + (sub.amount || 0);
    }, 0);

    const stats = {
      totalUsers,
      activePages,
      activeSubscriptions,
      revenue
    };
    
    return stats;
  } catch (error) {
    console.error('Error in getAdminStats:', error);
    console.error('Error stack:', error.stack);
    // Return default values in case of error
    return {
      totalUsers: 0,
      activePages: 0,
      activeSubscriptions: 0,
      revenue: 0
    };
  }
}

// Helper function to get analytics data
async function getAnalyticsData() {
  // Get total views with a default of 0 if no data
  const totalViews = await MaintenancePage.aggregate([
    { $group: { _id: null, total: { $sum: '$views' } } }
  ]);
  
  // Get active users count
  let activeUsers = await User.countDocuments({ 
    lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
  });
  
  // Get subscription breakdown
  let subscriptionBreakdown = await Subscription.aggregate([
    { $group: { _id: '$plan', count: { $sum: 1 } } }
  ]);

  // Get historical usage data for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const historicalData = await MaintenancePage.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        views: { $sum: '$views' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  // Format historical data for the chart
  const chartData = {
    labels: historicalData.map(d => d._id),
    views: historicalData.map(d => d.views)
  };

  // Ensure totalViews is always an array with at least one object
  const formattedTotalViews = totalViews.length > 0 ? totalViews : [{ _id: null, total: 0 }];

  // Add sample data for testing if no real data exists
  if (formattedTotalViews[0].total === 0) {
    formattedTotalViews[0].total = 1234; // Sample total views
  }

  if (activeUsers === 0) {
    activeUsers = 42; // Sample active users
  }

  if (subscriptionBreakdown.length === 0) {
    subscriptionBreakdown = [
      { _id: 'free', count: 25 },
      { _id: 'pro', count: 15 },
      { _id: 'enterprise', count: 5 }
    ];
  }

  // Add sample chart data if no real data exists
  if (chartData.labels.length === 0) {
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      chartData.labels.push(date.toISOString().split('T')[0]);
      chartData.views.push(Math.floor(Math.random() * 100) + 50); // Random sample data
    }
  }

  return {
    totalViews: formattedTotalViews,
    activeUsers,
    subscriptionBreakdown,
    chartData
  };
}

// Redirect root admin path to dashboard
router.get('/', isAdmin, (req, res) => {
  res.redirect('/admin/dashboard');
});

// Admin Dashboard
router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    const stats = await getAdminStats();
    
    const recentActivity = await Activity.find()
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    const renderData = {
      stats,
      recentActivity,
      path: '/admin',
      user: req.user,
      messages: {
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
      }
    };

    res.render('admin/dashboard', renderData);
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    console.error('Error stack:', error.stack);
    req.flash('error', 'Error loading admin dashboard');
    res.redirect('/dashboard');
  }
});

// User Management
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.render('admin/users', { 
      users, 
      path: '/admin/users',
      user: req.user,
      messages: {
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
      }
    });
  } catch (error) {
    console.error('Error loading users:', error);
    req.flash('error', 'Error loading users');
    res.redirect('/admin/dashboard');
  }
});

// New User Form
router.get('/users/new', isAdmin, async (req, res) => {
  try {
    res.render('admin/user-form', { 
      editUser: null,
      user: req.user,
      currentUser: req.user,
      active: 'admin',
      path: '/admin/users',
      messages: {
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
      }
    });
  } catch (error) {
    console.error('New User Form Error:', error);
    req.flash('error_msg', 'Error loading new user form');
    res.redirect('/admin/users');
  }
});

// Create User
router.post('/users', isAdmin, async (req, res) => {
  try {
    const { name, email, role, status, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error_msg', 'User with that email already exists');
      return res.redirect('/admin/users/new');
    }

    // Create new user
    const user = new User({
      name,
      email,
      role,
      status,
      password // This will be hashed by the User model's pre-save hook
    });
    await user.save();

    req.flash('success_msg', 'User created successfully');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Create User Error:', error);
    req.flash('error_msg', 'Error creating user');
    res.redirect('/admin/users/new');
  }
});

// Edit User
router.get('/users/:id/edit', isAdmin, async (req, res) => {
  try {
    const editUser = await User.findById(req.params.id);
    if (!editUser) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin/users');
    }
    res.render('admin/user-form', { 
      editUser,
      user: req.user,
      currentUser: req.user,
      active: 'admin',
      path: '/admin/users',
      messages: {
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
      }
    });
  } catch (error) {
    console.error('Edit User Error:', error);
    req.flash('error_msg', 'Error loading user');
    res.redirect('/admin/users');
  }
});

// Update User
router.put('/users/:id', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin/users');
    }

    // Update user fields
    user.name = req.body.name;
    user.email = req.body.email;
    user.role = req.body.role;
    user.status = req.body.status;
    
    // Update subscription if provided
    if (req.body.subscription) {
      user.subscription = {
        ...user.subscription,
        plan: req.body.subscription,
        status: req.body.subscriptionStatus
      };
    }

    await user.save();
    req.flash('success_msg', 'User updated successfully');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Update User Error:', error);
    req.flash('error_msg', 'Error updating user');
    res.redirect(`/admin/users/${req.params.id}/edit`);
  }
});

// Delete User
router.delete('/users/:id', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin/users');
    }

    await user.remove();
    req.flash('success_msg', 'User deleted successfully');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Delete User Error:', error);
    req.flash('error_msg', 'Error deleting user');
    res.redirect('/admin/users');
  }
});

// Admin Settings
router.get('/settings', isAdmin, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = {
        siteName: 'StatusSaaS',
        siteUrl: '',
        smtpHost: '',
        smtpPort: '',
        smtpUser: '',
        smtpPass: '',
        stripeSecretKey: '',
        stripePublishableKey: '',
        maintenanceBackgroundColor: '',
        maintenanceTextColor: '',
        maintenanceLogo: '',
        showMaintenanceLogo: false
      };
    }
    res.render('admin/settings', { 
      settings, 
      path: '/admin/settings',
      user: req.user,
      messages: {
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
      }
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    req.flash('error', 'Error loading settings');
    res.redirect('/admin/dashboard');
  }
});

// Update Settings
router.post('/settings', isAdmin, async (req, res) => {
  try {
    const {
      siteName,
      siteUrl,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      stripeSecretKey,
      stripePublishableKey,
      maintenanceBackgroundColor,
      maintenanceTextColor,
      maintenanceLogo,
      showMaintenanceLogo,
      messageTimeout
    } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    settings.siteName = siteName;
    settings.siteUrl = siteUrl;
    settings.smtpHost = smtpHost;
    settings.smtpPort = smtpPort ? parseInt(smtpPort) : null;
    settings.smtpUser = smtpUser;
    if (smtpPass) settings.smtpPass = smtpPass;
    if (stripeSecretKey) settings.stripeSecretKey = stripeSecretKey;
    if (stripePublishableKey) settings.stripePublishableKey = stripePublishableKey;
    settings.maintenanceBackgroundColor = maintenanceBackgroundColor;
    settings.maintenanceTextColor = maintenanceTextColor;
    settings.maintenanceLogo = maintenanceLogo;
    settings.showMaintenanceLogo = !!showMaintenanceLogo;
    settings.messageTimeout = messageTimeout ? parseInt(messageTimeout) * 1000 : 0; // Convert seconds to milliseconds

    await settings.save();

    req.flash('success', 'Settings updated successfully');
    res.redirect('/admin/settings');
  } catch (error) {
    console.error('Error updating settings:', error);
    req.flash('error', 'Error updating settings');
    res.redirect('/admin/settings');
  }
});

// Test Email Settings
router.post('/settings/test-email', isAdmin, async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings) {
      req.flash('error_msg', 'Settings not found');
      return res.redirect('/admin/settings');
    }

    // Send test email
    await sendTestEmail(settings);
    req.flash('success_msg', 'Test email sent successfully');
    res.redirect('/admin/settings');
  } catch (error) {
    console.error('Test Email Error:', error);
    req.flash('error_msg', 'Error sending test email');
    res.redirect('/admin/settings');
  }
});

// Admin Analytics
router.get('/analytics', isAdmin, async (req, res) => {
  try {
    const analytics = await getAnalyticsData();
    
    res.render('admin/analytics', {
      analytics,
      path: '/admin/analytics',
      user: req.user,
      messages: {
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
      }
    });
  } catch (error) {
    console.error('Error loading analytics:', error);
    req.flash('error_msg', 'Error loading analytics data');
    res.redirect('/admin/dashboard');
  }
});

// System Logs
router.get('/logs', isAdmin, async (req, res) => {
  try {
    const logs = await Activity.find()
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(50);
    res.render('admin/logs', { 
      logs, 
      path: '/admin/logs',
      user: req.user,
      messages: {
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
      }
    });
  } catch (error) {
    console.error('Error loading logs:', error);
    req.flash('error', 'Error loading logs');
    res.redirect('/admin/dashboard');
  }
});

// Subscription Plans Management
router.get('/plans', isAdmin, async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ price: 1 });
    res.render('admin/plans', { 
      plans,
      user: req.user,
      active: 'admin',
      path: '/admin/plans',
      messages: {
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
      }
    });
  } catch (error) {
    console.error('Error loading subscription plans:', error);
    req.flash('error_msg', 'Error loading subscription plans');
    res.redirect('/admin/dashboard');
  }
});

// Create Subscription Plan
router.get('/plans/new', isAdmin, async (req, res) => {
  try {
    res.render('admin/plan-form', { 
      plan: null,
      user: req.user,
      active: 'admin',
      messages: {
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
      }
    });
  } catch (error) {
    console.error('Error loading plan form:', error);
    req.flash('error_msg', 'Error loading plan form');
    res.redirect('/admin/plans');
  }
});

// Edit Subscription Plan
router.get('/plans/:id/edit', isAdmin, async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) {
      req.flash('error_msg', 'Subscription plan not found');
      return res.redirect('/admin/plans');
    }
    res.render('admin/plan-form', { 
      plan,
      user: req.user,
      active: 'admin',
      messages: {
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
      }
    });
  } catch (error) {
    console.error('Error loading plan:', error);
    req.flash('error_msg', 'Error loading plan');
    res.redirect('/admin/plans');
  }
});

// Create/Update Subscription Plan
router.post('/plans', isAdmin, async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      price,
      interval,
      features,
      pages,
      viewsPerPage,
      stripePriceId,
      isActive
    } = req.body;

    const planData = {
      name,
      code,
      description,
      price: parseFloat(price),
      interval,
      features: features.split('\n').filter(f => f.trim()),
      limits: {
        pages: parseInt(pages),
        viewsPerPage: parseInt(viewsPerPage)
      },
      stripePriceId,
      isActive: isActive === 'true'
    };

    if (req.body._id) {
      // Update existing plan
      const plan = await SubscriptionPlan.findById(req.body._id);
      if (!plan) {
        req.flash('error_msg', 'Subscription plan not found');
        return res.redirect('/admin/plans');
      }
      Object.assign(plan, planData);
      await plan.save();
      req.flash('success_msg', 'Subscription plan updated successfully');
    } else {
      // Create new plan
      const plan = new SubscriptionPlan(planData);
      await plan.save();
      req.flash('success_msg', 'Subscription plan created successfully');
    }

    res.redirect('/admin/plans');
  } catch (error) {
    console.error('Error saving subscription plan:', error);
    req.flash('error_msg', 'Error saving subscription plan');
    res.redirect('/admin/plans');
  }
});

// Delete Subscription Plan
router.delete('/plans/:id', isAdmin, async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) {
      req.flash('error_msg', 'Subscription plan not found');
      return res.redirect('/admin/plans');
    }

    // Check if any users are subscribed to this plan
    const usersWithPlan = await User.countDocuments({
      'subscription.plan': plan.code
    });

    if (usersWithPlan > 0) {
      req.flash('error_msg', 'Cannot delete plan: There are users subscribed to this plan');
      return res.redirect('/admin/plans');
    }

    await plan.remove();
    req.flash('success_msg', 'Subscription plan deleted successfully');
    res.redirect('/admin/plans');
  } catch (error) {
    console.error('Error deleting subscription plan:', error);
    req.flash('error_msg', 'Error deleting subscription plan');
    res.redirect('/admin/plans');
  }
});

module.exports = router; 