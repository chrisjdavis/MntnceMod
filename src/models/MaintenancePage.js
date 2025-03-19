const mongoose = require('mongoose');

const maintenancePageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
  message: String,
  customDomain: String,
  design: {
    type: Object,
    default: {
      backgroundColor: '#000000',
      textColor: '#ffffff',
      fontFamily: 'Inter',
      layout: 'centered',
      logo: '',
      maxWidth: 768,
      logoSize: {
        width: 200,
        height: 50
      },
      customCSS: ''
    }
  },
  analytics: {
    totalViews: {
      type: Number,
      default: 0
    },
    uniqueVisitors: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    viewsByDate: [{
      date: Date,
      count: Number
    }],
    visitorsByDate: [{
      date: Date,
      count: Number
    }]
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
maintenancePageSchema.pre('save', function(next) {
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
maintenancePageSchema.methods.incrementViews = async function(isUnique = false) {
  this.views += 1;
  if (isUnique) {
    this.analytics.totalViews += 1;
  }
  this.lastViewed = Date.now();
  
  // Update views by date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const viewsByDateIndex = this.analytics.viewsByDate.findIndex(
    v => v.date.getTime() === today.getTime()
  );

  if (viewsByDateIndex === -1) {
    this.analytics.viewsByDate.push({ date: today, count: 1 });
  } else {
    this.analytics.viewsByDate[viewsByDateIndex].count += 1;
  }

  // Update last updated timestamp
  this.analytics.lastUpdated = new Date();
  
  await this.save();
};

// Method to increment unique visitors
maintenancePageSchema.methods.incrementUniqueVisitors = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Update unique visitors
  this.analytics.uniqueVisitors += 1;

  // Update visitors by date
  const visitorsByDateIndex = this.analytics.visitorsByDate.findIndex(
    v => v.date.getTime() === today.getTime()
  );

  if (visitorsByDateIndex === -1) {
    this.analytics.visitorsByDate.push({ date: today, count: 1 });
  } else {
    this.analytics.visitorsByDate[visitorsByDateIndex].count += 1;
  }

  // Update last updated timestamp
  this.analytics.lastUpdated = new Date();

  await this.save();
};

// Static method to find by slug
maintenancePageSchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug });
};

// Check if model exists before creating
const MaintenancePage = mongoose.models.MaintenancePage || mongoose.model('MaintenancePage', maintenancePageSchema);

module.exports = MaintenancePage; 