const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  siteName: {
    type: String,
    default: 'StatusSaaS'
  },
  siteUrl: String,
  siteDescription: {
    type: String,
    default: 'Professional Status Page Management'
  },
  smtpHost: String,
  smtpPort: Number,
  smtpUser: String,
  smtpPass: String,
  stripeSecretKey: String,
  stripePublishableKey: String,
  requireEmailVerification: {
    type: Boolean,
    default: false
  },
  enableTwoFactor: {
    type: Boolean,
    default: false
  },
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  maintenanceMessage: {
    type: String
  },
  maintenanceBackgroundColor: {
    type: String,
    default: '#0f172a'
  },
  maintenanceTextColor: {
    type: String,
    default: '#ffffff'
  },
  maintenanceLogo: String,
  showMaintenanceLogo: {
    type: Boolean,
    default: false
  },
  messageTimeout: {
    type: Number,
    default: 5000, // 5 seconds in milliseconds
    min: 0,
    max: 30000 // Max 30 seconds
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update the updatedAt timestamp before saving
settingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get or create settings
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

// Check if model exists before creating
const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);

module.exports = Settings; 