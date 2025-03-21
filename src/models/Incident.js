const mongoose = require('mongoose');

const incidentUpdateSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['investigating', 'identified', 'monitoring', 'resolved', 'post-mortem'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  impact: {
    type: String,
    enum: ['none', 'minor', 'major', 'critical'],
    required: true
  },
  affectedComponents: [{
    type: String,
    trim: true
  }],
  timestamp: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

const incidentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['investigating', 'identified', 'monitoring', 'resolved', 'post-mortem'],
    default: 'investigating'
  },
  impact: {
    type: String,
    enum: ['none', 'minor', 'major', 'critical'],
    required: true
  },
  affectedComponents: [{
    type: String,
    trim: true
  }],
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  resolvedAt: {
    type: Date
  },
  updates: [incidentUpdateSchema],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  page: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaintenancePage',
    required: true
  },
  postMortem: {
    summary: String,
    rootCause: String,
    resolution: String,
    prevention: String,
    createdAt: Date,
    updatedAt: Date
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
incidentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to add an update to the incident
incidentSchema.methods.addUpdate = async function(updateData) {
  this.updates.push(updateData);
  this.status = updateData.status;
  this.impact = updateData.impact;
  this.affectedComponents = updateData.affectedComponents;
  
  if (updateData.status === 'resolved') {
    this.resolvedAt = new Date();
    this.endTime = new Date();
  }
  
  await this.save();
};

// Method to check if user can create incidents
incidentSchema.statics.canCreateIncident = async function(userId) {
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  
  if (!user) {
    return false;
  }
  
  // Only allow Pro plan users to create incidents
  return user.subscription.plan === 'pro' && user.hasActiveSubscription();
};

const Incident = mongoose.model('Incident', incidentSchema);

module.exports = Incident; 