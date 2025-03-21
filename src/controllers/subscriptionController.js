const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const paymentService = require('../services/paymentService');

exports.createSubscription = async (req, res) => {
  try {
    const { planCode, paymentMethodId } = req.body;
    const user = req.user;

    // Get the plan details
    const plan = await SubscriptionPlan.findOne({ code: planCode });
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // If it's a free plan, just update the user
    if (planCode === 'free') {
      user.subscription = {
        plan: 'free',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      };
      await user.save();
      return res.json({ success: true });
    }

    // Create or get Stripe customer
    let customerId = user.subscription?.stripeCustomerId;
    if (!customerId) {
      const customer = await paymentService.createCustomer(user.email, paymentMethodId);
      customerId = customer.id;
    }

    // Create subscription
    const subscription = await paymentService.createSubscription(customerId, plan.stripePriceId);

    // Update user subscription
    user.subscription = {
      ...user.subscription,
      plan: planCode,
      status: subscription.status === 'active' ? 'active' : 'past_due',
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    };

    await user.save();

    res.json({
      success: true,
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
};

exports.updateSubscription = async (req, res) => {
  try {
    const { planCode } = req.body;
    const user = req.user;

    // Get the plan details
    const plan = await SubscriptionPlan.findOne({ code: planCode });
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // If it's a free plan, just update the user
    if (planCode === 'free') {
      user.subscription = {
        plan: 'free',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      };
      await user.save();
      return res.json({ success: true });
    }

    // Check if user has an active subscription
    if (!user.subscription?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Update subscription
    const subscription = await paymentService.updateSubscription(
      user.subscription.stripeSubscriptionId,
      plan.stripePriceId
    );

    // Update user subscription
    user.subscription = {
      ...user.subscription,
      plan: planCode,
      status: subscription.status === 'active' ? 'active' : 'past_due',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    };

    await user.save();

    res.json({
      success: true,
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const user = req.user;

    if (!user.subscription?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Cancel subscription
    await paymentService.cancelSubscription(user.subscription.stripeSubscriptionId);

    // Update user subscription
    user.subscription = {
      ...user.subscription,
      plan: 'free',
      status: 'canceled',
      stripeSubscriptionId: null,
      currentPeriodEnd: null
    };

    await user.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

exports.getSubscriptionPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true });
    res.json(plans);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
}; 