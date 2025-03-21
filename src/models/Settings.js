const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  siteName: {
    type: String,
    default: 'Maintenance Mode'
  },
  siteUrl: {
    type: String,
    default: 'http://localhost:3000'
  },
  siteDescription: {
    type: String,
    default: 'Professional Status Page Management'
  },
  stripe: {
    secretKey: {
      type: String,
      required: true
    },
    webhookSecret: {
      type: String,
      required: true
    }
  },
  email: {
    from: {
      type: String,
      default: 'noreply@example.com'
    },
    smtp: {
      host: String,
      port: Number,
      secure: Boolean,
      auth: {
        user: String,
        pass: String
      }
    }
  },
  maintenance: {
    defaultTitle: {
      type: String,
      default: 'We\'re under maintenance'
    },
    defaultDescription: {
      type: String,
      default: 'We\'re performing some maintenance on our site. We\'ll be back shortly.'
    },
    defaultContent: {
      type: String,
      default: 'Thank you for your patience.'
    }
  },
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
  // Incident Management Settings
  enableIncidentManagement: {
    type: Boolean,
    default: true
  },
  incidentManagementPlan: {
    type: String,
    enum: ['free', 'basic', 'pro', 'enterprise'],
    default: 'pro'
  },
  incidentEmailNotifications: [{
    type: String,
    enum: ['new', 'updates', 'resolved']
  }],
  incidentSlackWebhook: String,
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