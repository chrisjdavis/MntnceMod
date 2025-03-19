const Settings = require('../models/Settings');

async function getStripe() {
  const settings = await Settings.findOne();
  if (!settings || !settings.stripeSecretKey) {
    throw new Error('Stripe settings not configured');
  }
  
  const stripe = require('stripe')(settings.stripeSecretKey);
  return stripe;
}

async function createSubscription(customerId, priceId) {
  try {
    const stripe = await getStripe();
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
    return subscription;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
}

async function createCustomer(email, paymentMethodId) {
  try {
    const stripe = await getStripe();
    const customer = await stripe.customers.create({
      email,
      payment_method: paymentMethodId,
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    return customer;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
}

async function cancelSubscription(subscriptionId) {
  try {
    const stripe = await getStripe();
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}

module.exports = {
  createSubscription,
  createCustomer,
  cancelSubscription,
  getStripe
}; 