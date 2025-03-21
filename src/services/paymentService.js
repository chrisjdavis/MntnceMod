const stripe = require('stripe');
const Settings = require('../models/Settings');
const SubscriptionPlan = require('../models/SubscriptionPlan');

let stripeInstance = null;

const getStripe = async () => {
  try {
    if (!stripeInstance) {
      const settings = await Settings.getSettings();
      if (!settings.stripe?.secretKey) {
        throw new Error('Stripe secret key not configured. Please configure Stripe settings in the admin panel.');
      }
      stripeInstance = stripe(settings.stripe.secretKey);
    }
    return stripeInstance;
  } catch (error) {
    console.error('Error initializing Stripe:', error);
    throw new Error('Stripe settings not configured');
  }
};

async function createCustomer(email, paymentMethodId) {
  try {
    const stripe = await getStripe();
    
    // First, try to find an existing customer with this email
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1
    });

    let customer;
    if (existingCustomers.data.length > 0) {
      // Use existing customer
      customer = existingCustomers.data[0];
      
      // Attach the new payment method
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id
      });

      // Set as default payment method
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
    } else {
      // Create new customer with payment method
      customer = await stripe.customers.create({
        email,
        payment_method: paymentMethodId,
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });

      // Confirm the payment method is attached
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id
      });
    }

    return customer;
  } catch (error) {
    console.error('Error creating/updating customer:', error);
    throw error;
  }
}

async function createSubscription(customerId, priceId, paymentMethodId) {
  try {
    const stripe = await getStripe();
    
    // First, check if customer has any existing subscriptions
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1
    });

    let subscription;
    if (existingSubscriptions.data.length > 0) {
      // Update existing subscription
      subscription = await stripe.subscriptions.update(
        existingSubscriptions.data[0].id,
        {
          items: [{
            id: existingSubscriptions.data[0].items.data[0].id,
            price: priceId
          }],
          proration_behavior: 'always_invoice',
          payment_behavior: 'default_incomplete',
          payment_settings: { save_default_payment_method: 'on_subscription' },
          expand: ['latest_invoice.payment_intent']
        }
      );
    } else {
      // Create new subscription
      subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent']
      });
    }

    // If there's a payment intent and we have a payment method, confirm it
    if (subscription.latest_invoice.payment_intent && paymentMethodId) {
      await stripe.paymentIntents.confirm(subscription.latest_invoice.payment_intent.id, {
        payment_method: paymentMethodId
      });
    }

    return subscription;
  } catch (error) {
    console.error('Error creating/updating subscription:', error);
    throw error;
  }
}

async function updateSubscription(subscriptionId, priceId, paymentMethodId) {
  try {
    const stripe = await getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // If subscription is inactive, create a new one
    if (subscription.status !== 'active') {
      const newSubscription = await stripe.subscriptions.create({
        customer: subscription.customer,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent']
      });

      // If there's a payment intent and we have a payment method, confirm it
      if (newSubscription.latest_invoice.payment_intent && paymentMethodId) {
        await stripe.paymentIntents.confirm(newSubscription.latest_invoice.payment_intent.id, {
          payment_method: paymentMethodId
        });
      }

      return newSubscription;
    }

    // For active subscriptions, update as before
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: priceId
      }],
      proration_behavior: 'always_invoice',
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent']
    });

    // If there's a payment intent and we have a payment method, confirm it
    if (updatedSubscription.latest_invoice.payment_intent && paymentMethodId) {
      await stripe.paymentIntents.confirm(updatedSubscription.latest_invoice.payment_intent.id, {
        payment_method: paymentMethodId
      });
    }

    return updatedSubscription;
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
}

async function cancelSubscription(subscriptionId) {
  try {
    const stripe = await getStripe();
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}

async function createPaymentIntent(amount, currency = 'usd') {
  try {
    const stripe = await getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency
    });
    return paymentIntent;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
}

async function attachPaymentMethod(customerId, paymentMethodId) {
  try {
    const stripe = await getStripe();
    
    // Attach the payment method to the customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    return true;
  } catch (error) {
    console.error('Error attaching payment method:', error);
    throw new Error('Failed to attach payment method');
  }
}

module.exports = {
  createCustomer,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  createPaymentIntent,
  getStripe,
  attachPaymentMethod
}; 