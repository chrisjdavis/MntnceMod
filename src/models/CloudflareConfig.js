const mongoose = require('mongoose');

const cloudflareConfigSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  apiToken: {
    type: String,
    required: true,
    select: false // Don't include in queries by default
  },
  email: {
    type: String,
    required: true
  },
  accountId: {
    type: String,
    required: true
  },
  zoneId: {
    type: String,
    required: true
  },
  kvNamespaceId: {
    type: String,
    required: true
  },
  workerName: {
    type: String,
    default: 'maintenance-worker'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
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
cloudflareConfigSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const CloudflareConfig = mongoose.model('CloudflareConfig', cloudflareConfigSchema);

module.exports = CloudflareConfig; 