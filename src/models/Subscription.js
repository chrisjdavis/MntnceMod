const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  price: {
    type: Number,
    required: true
  },
  interval: {
    type: String,
    enum: ['month', 'year'],
    default: 'month'
  },
  stripePriceId: {
    type: String,
    required: true
  },
  features: {
    pages: {
      type: Number,
      required: true
    },
    viewsPerPage: {
      type: Number,
      required: true
    },
    customDomain: {
      type: Boolean,
      default: false
    },
    prioritySupport: {
      type: Boolean,
      default: false
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
subscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get all active subscriptions
subscriptionSchema.statics.getActiveSubscriptions = function() {
  return this.find({ isActive: true }).sort({ price: 1 });
};

// Static method to get subscription by name
subscriptionSchema.statics.getByName = function(name) {
  return this.findOne({ name, isActive: true });
};

module.exports = mongoose.model('Subscription', subscriptionSchema); 