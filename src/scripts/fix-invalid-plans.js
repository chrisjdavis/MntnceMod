require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function fixInvalidPlans() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);

    // Find users with invalid plans
    const users = await User.find({
      'subscription.plan': { $nin: ['free', 'basic', 'pro', 'enterprise'] }
    });

    console.log(`Found ${users.length} users with invalid plans`);

    // Update each user to the free plan
    for (const user of users) {
      console.log(`Updating user ${user._id} from ${user.subscription.plan} to free`);
      user.subscription.plan = 'free';
      user.subscription.status = 'active';
      await user.save();
    }

    console.log('Successfully updated all invalid plans');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing invalid plans:', error);
    process.exit(1);
  }
}

fixInvalidPlans(); 