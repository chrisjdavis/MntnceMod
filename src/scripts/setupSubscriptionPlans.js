const mongoose = require('mongoose');
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
require('dotenv').config();

const plans = [
  {
    name: 'Free',
    code: 'free',
    description: 'Basic maintenance page with limited features',
    price: 0,
    interval: 'month',
    features: [
      '1 maintenance page',
      'Basic customization',
      'Standard support'
    ],
    limits: {
      pages: 1
    },
    stripePriceId: 'free',
    isActive: true
  },
  {
    name: 'Basic',
    code: 'basic',
    description: 'Perfect for small businesses',
    price: 9.99,
    interval: 'month',
    features: [
      '5 maintenance pages',
      'Advanced customization',
      'Priority support',
      'Custom domains'
    ],
    limits: {
      pages: 5
    },
    stripePriceId: 'price_basic_monthly',
    isActive: true
  },
  {
    name: 'Pro',
    code: 'pro',
    description: 'For growing businesses',
    price: 29.99,
    interval: 'month',
    features: [
      '20 maintenance pages',
      'Advanced customization',
      'Priority support',
      'Custom domains',
      'Analytics dashboard',
      'API access'
    ],
    limits: {
      pages: 20
    },
    stripePriceId: 'price_pro_monthly',
    isActive: true
  },
  {
    name: 'Enterprise',
    code: 'enterprise',
    description: 'For large organizations',
    price: 99.99,
    interval: 'month',
    features: [
      'Unlimited maintenance pages',
      'Advanced customization',
      '24/7 priority support',
      'Custom domains',
      'Advanced analytics',
      'API access',
      'Dedicated account manager'
    ],
    limits: {
      pages: 999999
    },
    stripePriceId: 'price_enterprise_monthly',
    isActive: true
  }
];

async function setupSubscriptionPlans() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // Clear existing plans
    await SubscriptionPlan.deleteMany({});

    // Insert new plans
    const insertedPlans = await SubscriptionPlan.insertMany(plans);

    // Update existing users
    const users = await User.find({});

    for (const user of users) {
      // Skip if user already has a plan
      if (user.subscription && user.subscription.plan) {
        continue;
      }

      // Set default plan based on user's role
      const planCode = user.role === 'admin' ? 'enterprise' : 'free';
      user.subscription = {
        plan: planCode,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      };

      await user.save();
    }

    process.exit(0);
  } catch (error) {
    console.error('Error setting up subscription plans:', error);
    process.exit(1);
  }
}

// Run the script
setupSubscriptionPlans(); 