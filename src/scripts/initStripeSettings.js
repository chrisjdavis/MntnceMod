require('dotenv').config();
const mongoose = require('mongoose');
const Settings = require('../models/Settings');

async function initStripeSettings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const settings = await Settings.getSettings();
    
    // Update Stripe settings
    settings.stripe = {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    };

    await settings.save();
    console.log('Stripe settings initialized successfully');
  } catch (error) {
    console.error('Error initializing Stripe settings:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

initStripeSettings(); 