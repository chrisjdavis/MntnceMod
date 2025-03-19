const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Settings = require('../models/Settings');
const SubscriptionPlan = require('../models/SubscriptionPlan');

// Helper to get Stripe instance
async function getStripe() {
  const settings = await Settings.findOne();
  if (!settings || !settings.stripeSecretKey) {
    throw new Error('Stripe settings not configured');
  }
  return require('stripe')(settings.stripeSecretKey);
}

// Webhook handler
router.post('/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  let event;
  try {
    const stripe = await getStripe();
    const sig = req.headers['stripe-signature'];
    const settings = await Settings.findOne();
    
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      settings.stripeWebhookSecret
    );
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const user = await User.findOne({ 'subscription.stripeCustomerId': subscription.customer });
        
        if (!user) {
          console.error('No user found for customer:', subscription.customer);
          return res.status(200).send();
        }

        // Get the plan code from metadata or price lookup
        const price = await stripe.prices.retrieve(subscription.items.data[0].price.id);
        const plan = await SubscriptionPlan.findOne({ stripePriceId: price.id });
        
        if (!plan) {
          console.error('No plan found for price:', price.id);
          return res.status(200).send();
        }

        // Update user subscription
        user.subscription = {
          ...user.subscription,
          plan: plan.code,
          status: subscription.status === 'active' ? 'active' : 'past_due',
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000)
        };

        await user.save(); // This will trigger the pre-save hook that emits events
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const user = await User.findOne({ 'subscription.stripeSubscriptionId': subscription.id });
        
        if (!user) {
          console.error('No user found for subscription:', subscription.id);
          return res.status(200).send();
        }

        // Update user subscription to free plan
        user.subscription = {
          ...user.subscription,
          plan: 'free',
          status: 'canceled',
          stripeSubscriptionId: null,
          currentPeriodEnd: null
        };

        await user.save(); // This will trigger the pre-save hook that emits events
        break;
      }
    }

    res.status(200).send();
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send();
  }
});

module.exports = router; 