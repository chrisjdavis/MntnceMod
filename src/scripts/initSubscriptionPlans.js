require('dotenv').config();
const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');

async function initSubscriptionPlans() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Delete existing plans
    await SubscriptionPlan.deleteMany({});
    console.log('Cleared existing subscription plans');

    // Create plans
    const plans = [
      {
        name: 'Free Plan',
        code: 'free',
        description: 'Basic features for getting started',
        price: 0,
        stripePriceId: null, // Free plan doesn't need a Stripe price ID
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
      },
      {
        name: 'Hobby Plan',
        code: 'hobby',
        description: 'Perfect for hobbyists and small projects',
        price: 4.99,
        stripePriceId: process.env.STRIPE_HOBBY_PRICE_ID,
        features: [
          '3 maintenance pages',
          'Basic analytics',
          'Email support',
          'Custom CSS'
        ],
        limits: {
          pages: 3,
          viewsPerPage: 2000
        },
        isActive: true
      },
      {
        name: 'Basic Plan',
        code: 'basic',
        description: 'Perfect for small businesses',
        price: 9.99,
        stripePriceId: process.env.STRIPE_BASIC_PRICE_ID,
        features: [
          '5 maintenance pages',
          'Advanced analytics',
          'Priority support',
          'Custom CSS'
        ],
        limits: {
          pages: 5,
          viewsPerPage: 5000
        },
        isActive: true
      },
      {
        name: 'Pro Plan',
        code: 'pro',
        description: 'For growing businesses',
        price: 29.99,
        stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
        features: [
          'Unlimited maintenance pages',
          'Advanced analytics',
          'Priority support',
          'Custom CSS',
          'Custom domains',
          'API access'
        ],
        limits: {
          pages: 999999, // Effectively unlimited
          viewsPerPage: 999999 // Effectively unlimited
        },
        isActive: true
      }
    ];

    // Insert plans
    await SubscriptionPlan.insertMany(plans);
    console.log('Subscription plans initialized successfully');

    // Log the plans for verification
    const createdPlans = await SubscriptionPlan.find({});
    console.log('\nCreated plans:');
    createdPlans.forEach(plan => {
      console.log(`\n${plan.name} (${plan.code}):`);
      console.log(`Price: $${plan.price}`);
      console.log(`Stripe Price ID: ${plan.stripePriceId}`);
      console.log('Features:', plan.features);
      console.log('Limits:', plan.limits);
    });

  } catch (error) {
    console.error('Error initializing subscription plans:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

initSubscriptionPlans(); 