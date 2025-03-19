const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  interval: {
    type: String,
    enum: ['month', 'year'],
    required: true
  },
  features: [{
    type: String,
    required: true
  }],
  limits: {
    pages: {
      type: Number,
      required: true
    },
    viewsPerPage: {
      type: Number,
      required: true
    }
  },
  stripePriceId: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
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

// Update the updatedAt timestamp before saving
subscriptionPlanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const SubscriptionPlan = mongoose.models.SubscriptionPlan || mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

module.exports = SubscriptionPlan; 