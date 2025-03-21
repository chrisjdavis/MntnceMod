const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['page_create', 'page_update', 'page_delete', 'page_toggle', 'page_deploy', 'page_redeploy', 'user_create', 'user_update', 'user_delete', 'login', 'logout', 'subscription_change'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Static method to create activity log
activitySchema.statics.log = async function(userId, type, description, metadata = {}) {
  return this.create({
    user: userId,
    type,
    description,
    metadata
  });
};

// Check if model exists before creating
const Activity = mongoose.models.Activity || mongoose.model('Activity', activitySchema);

module.exports = Activity; 