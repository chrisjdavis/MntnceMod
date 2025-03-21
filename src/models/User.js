const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const eventEmitter = require('../utils/eventEmitter');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId && !this.githubId;
    }
  },
  googleId: String,
  githubId: String,
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  notifications: {
    type: Map,
    of: Boolean,
    default: {
      comments: true,
      mentions: true,
      updates: true
    }
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'pro'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid'],
      default: 'active'
    },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    currentPeriodEnd: Date
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

// Watch for subscription plan changes
userSchema.pre('save', function(next) {
  if (this.isModified('subscription.plan')) {
    eventEmitter.emit('userUpdate', {
      type: 'subscription',
      userId: this._id.toString(),
      plan: this.subscription.plan
    });
  }
  this.updatedAt = Date.now();
  next();
});

// Virtual for subscription limits
userSchema.virtual('subscriptionLimits').get(async function() {
  try {
    const SubscriptionPlan = mongoose.model('SubscriptionPlan');
    const plan = await SubscriptionPlan.findOne({ code: this.subscription.plan });
    
    if (!plan) {
      console.warn(`No plan found for code: ${this.subscription.plan}, falling back to free plan`);
      return { pages: 1 };
    }

    if (!plan.isActive) {
      console.warn(`Plan ${this.subscription.plan} is not active, falling back to free plan`);
      return { pages: 1 };
    }

    // Emit event when limits are fetched
    eventEmitter.emit('userUpdate', {
      type: 'limits',
      userId: this._id.toString(),
      limits: plan.limits
    });

    return plan.limits;
  } catch (error) {
    console.error('Error fetching subscription limits:', error);
    return { pages: 1 }; // Fallback to free plan limits
  }
});

// Virtual for isAdmin
userSchema.virtual('isAdmin').get(function() {
  return this.role === 'admin';
});

// Method to get full plan details
userSchema.methods.getPlanDetails = async function() {
  try {
    const SubscriptionPlan = mongoose.model('SubscriptionPlan');
    const plan = await SubscriptionPlan.findOne({ code: this.subscription.plan });
    
    if (!plan) {
      // Return free plan details if no plan is found
      return {
        name: 'Free Plan',
        code: 'free',
        description: 'Basic features for getting started',
        price: 0,
        interval: 'forever',
        features: [
          '1 maintenance page',
          'Basic analytics',
          'Email support'
        ],
        limits: {
          pages: 1,
          viewsPerPage: 1000
        },
        isActive: true
      };
    }

    return {
      name: plan.name,
      code: plan.code,
      description: plan.description,
      price: plan.price,
      interval: plan.interval,
      features: plan.features,
      limits: plan.limits,
      isActive: plan.isActive
    };
  } catch (error) {
    console.error('Error fetching plan details:', error);
    // Return free plan details on error
    return {
      name: 'Free Plan',
      code: 'free',
      description: 'Basic features for getting started',
      price: 0,
      interval: 'forever',
      features: [
        '1 maintenance page',
        'Basic analytics',
        'Email support'
      ],
      limits: {
        pages: 1,
        viewsPerPage: 1000
      },
      isActive: true
    };
  }
};

// Method to check if user can create more pages
userSchema.methods.canCreatePage = async function() {
  try {
    // Check if subscription is active
    if (this.subscription.status !== 'active') {
      return false;
    }

    const MaintenancePage = mongoose.model('MaintenancePage');
    const pageCount = await MaintenancePage.countDocuments({ user: this._id });
    const limits = await this.subscriptionLimits;
    
    // Emit event with current page count and limits
    eventEmitter.emit('userUpdate', {
      type: 'pageCount',
      userId: this._id.toString(),
      pageCount,
      canCreate: pageCount < limits.pages
    });
    
    return pageCount < limits.pages;
  } catch (error) {
    console.error('Error checking page creation ability:', error);
    return false; // Fail safe - don't allow page creation on error
  }
};

// Method to check if user has exceeded view limits
userSchema.methods.hasExceededViewLimit = async function(pageId) {
  try {
    const MaintenancePage = mongoose.model('MaintenancePage');
    const page = await MaintenancePage.findOne({ _id: pageId, user: this._id });
    
    if (!page) {
      return false;
    }

    const limits = await this.subscriptionLimits;
    return page.analytics.totalViews >= limits.viewsPerPage;
  } catch (error) {
    console.error('Error checking view limits:', error);
    return false; // Fail safe - don't block views on error
  }
};

// Method to check if subscription is active
userSchema.methods.hasActiveSubscription = function() {
  // If the plan is free, it's always considered active
  if (this.subscription.plan === 'free') {
    return true;
  }

  // For paid plans, check the status and period
  return this.subscription.status === 'active' && 
         (!this.subscription.currentPeriodEnd || new Date(this.subscription.currentPeriodEnd) > new Date());
};

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Check if model exists before creating
const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User; 