const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'scheduled'],
    default: 'draft'
  },
  scheduledFor: {
    type: Date
  },
  design: {
    type: Object,
    default: {
      backgroundColor: '#000000',
      textColor: '#ffffff',
      fontFamily: 'Inter',
      layout: 'centered',
      logo: ''
    }
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  views: {
    type: Number,
    default: 0
  },
  lastViewed: {
    type: Date
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
pageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Check if the page is scheduled and update status accordingly
  if (this.scheduledFor) {
    const now = new Date();
    if (this.scheduledFor <= now) {
      this.status = 'published';
      this.scheduledFor = null;
    } else {
      this.status = 'scheduled';
    }
  }
  
  next();
});

// Method to increment view count
pageSchema.methods.incrementViews = async function() {
  this.views += 1;
  this.lastViewed = Date.now();
  await this.save();
};

// Static method to find by slug
pageSchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug });
};

// Check if model exists before creating
const Page = mongoose.models.Page || mongoose.model('Page', pageSchema);

module.exports = Page; 