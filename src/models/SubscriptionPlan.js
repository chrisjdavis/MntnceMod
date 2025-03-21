const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  stripePriceId: {
    type: String,
    required: false
  },
  features: [{
    type: String,
    required: true
  }],
  limits: {
    pages: {
      type: Number,
      required: true,
      default: 1
    },
    viewsPerPage: {
      type: Number,
      required: true,
      default: 1000
    }
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

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

module.exports = SubscriptionPlan; 