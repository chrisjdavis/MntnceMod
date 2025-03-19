const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true
  },
  revenue: {
    total: {
      type: Number,
      default: 0
    },
    byPlan: {
      free: { type: Number, default: 0 },
      basic: { type: Number, default: 0 },
      pro: { type: Number, default: 0 },
      enterprise: { type: Number, default: 0 }
    }
  },
  users: {
    total: {
      type: Number,
      default: 0
    },
    new: {
      type: Number,
      default: 0
    },
    byPlan: {
      free: { type: Number, default: 0 },
      basic: { type: Number, default: 0 },
      pro: { type: Number, default: 0 },
      enterprise: { type: Number, default: 0 }
    }
  },
  pages: {
    total: {
      type: Number,
      default: 0
    },
    new: {
      type: Number,
      default: 0
    },
    byStatus: {
      draft: { type: Number, default: 0 },
      published: { type: Number, default: 0 },
      maintenance: { type: Number, default: 0 },
      down: { type: Number, default: 0 },
      degraded: { type: Number, default: 0 },
      operational: { type: Number, default: 0 }
    }
  },
  views: {
    total: {
      type: Number,
      default: 0
    },
    unique: {
      type: Number,
      default: 0
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
analyticsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get analytics for a date range
analyticsSchema.statics.getDateRange = function(startDate, endDate) {
  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: 1 });
};

// Static method to get today's analytics
analyticsSchema.statics.getToday = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let analytics = await this.findOne({ date: today });

  if (!analytics) {
    analytics = new this({
      date: today
    });
    await analytics.save();
  }

  return analytics;
};

// Static method to update analytics
analyticsSchema.statics.updateAnalytics = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const User = require('./User');
  const MaintenancePage = require('./MaintenancePage');
  const Subscription = require('./Subscription');

  // Get today's analytics document
  let analytics = await this.getToday();

  // Update user counts
  const users = await User.find();
  analytics.users.total = users.length;
  analytics.users.new = users.filter(user => 
    user.createdAt.toDateString() === today.toDateString()
  ).length;

  // Update user counts by plan
  analytics.users.byPlan = {
    free: users.filter(user => user.subscription.plan === 'free').length,
    basic: users.filter(user => user.subscription.plan === 'basic').length,
    pro: users.filter(user => user.subscription.plan === 'pro').length,
    enterprise: users.filter(user => user.subscription.plan === 'enterprise').length
  };

  // Update page counts
  const pages = await MaintenancePage.find();
  analytics.pages.total = pages.length;
  analytics.pages.new = pages.filter(page => 
    page.createdAt.toDateString() === today.toDateString()
  ).length;

  // Update page counts by status
  analytics.pages.byStatus = {
    draft: pages.filter(page => page.status === 'draft').length,
    published: pages.filter(page => page.status === 'published').length,
    maintenance: pages.filter(page => page.status === 'maintenance').length,
    down: pages.filter(page => page.status === 'down').length,
    degraded: pages.filter(page => page.status === 'degraded').length,
    operational: pages.filter(page => page.status === 'operational').length
  };

  // Update view counts
  analytics.views.total = pages.reduce((sum, page) => sum + page.analytics.totalViews, 0);
  analytics.views.unique = pages.reduce((sum, page) => sum + page.analytics.uniqueVisitors, 0);

  // Update revenue
  const subscriptions = await Subscription.find({ isActive: true });
  analytics.revenue.total = subscriptions.reduce((sum, sub) => sum + sub.price, 0);
  analytics.revenue.byPlan = {
    free: 0,
    basic: subscriptions.find(s => s.name === 'basic')?.price || 0,
    pro: subscriptions.find(s => s.name === 'pro')?.price || 0,
    enterprise: subscriptions.find(s => s.name === 'enterprise')?.price || 0
  };

  await analytics.save();
  return analytics;
};

module.exports = mongoose.model('Analytics', analyticsSchema); 