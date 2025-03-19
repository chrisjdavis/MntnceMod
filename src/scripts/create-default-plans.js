const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const defaultPlans = [
  {
    name: 'Free',
    code: 'free',
    description: 'Perfect for personal projects and small businesses',
    price: 0,
    interval: 'month',
    features: [
      '1 maintenance page',
      '1,000 views per page',
      'Basic customization',
      'Email support'
    ],
    limits: {
      pages: 1,
      viewsPerPage: 1000
    },
    stripePriceId: 'price_free',
    isActive: true
  },
  {
    name: 'Basic',
    code: 'basic',
    description: 'Ideal for growing businesses',
    price: 9.99,
    interval: 'month',
    features: [
      '5 maintenance pages',
      '10,000 views per page',
      'Advanced customization',
      'Priority email support',
      'Custom domain support'
    ],
    limits: {
      pages: 5,
      viewsPerPage: 10000
    },
    stripePriceId: 'price_basic',
    isActive: true
  },
  {
    name: 'Pro',
    code: 'pro',
    description: 'For professional organizations',
    price: 29.99,
    interval: 'month',
    features: [
      '20 maintenance pages',
      '50,000 views per page',
      'Full customization',
      'Priority support',
      'Custom domain support',
      'Analytics dashboard',
      'API access'
    ],
    limits: {
      pages: 20,
      viewsPerPage: 50000
    },
    stripePriceId: 'price_pro',
    isActive: true
  },
  {
    name: 'Enterprise',
    code: 'enterprise',
    description: 'For large organizations with custom needs',
    price: 99.99,
    interval: 'month',
    features: [
      '100 maintenance pages',
      '100,000 views per page',
      'Full customization',
      '24/7 priority support',
      'Custom domain support',
      'Advanced analytics',
      'API access',
      'Dedicated account manager',
      'Custom integrations'
    ],
    limits: {
      pages: 100,
      viewsPerPage: 100000
    },
    stripePriceId: 'price_enterprise',
    isActive: true
  }
];

async function createDefaultPlans() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/statussaas', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // Clear existing plans
    await SubscriptionPlan.deleteMany({});

    // Create new plans
    for (const plan of defaultPlans) {
      await SubscriptionPlan.create(plan);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error creating default plans:', error);
    process.exit(1);
  }
}

createDefaultPlans(); 