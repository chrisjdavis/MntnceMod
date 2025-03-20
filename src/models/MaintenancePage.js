const mongoose = require('mongoose');

const maintenancePageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  domain: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  content: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'scheduled', 'archived'],
    default: 'draft'
  },
  deployed: {
    type: Boolean,
    default: false
  },
  scheduledFor: {
    type: Date
  },
  design: {
    backgroundColor: {
      type: String,
      default: '#000000'
    },
    textColor: {
      type: String,
      default: '#ffffff'
    },
    fontFamily: {
      type: String,
      default: 'Inter'
    },
    layout: {
      type: String,
      enum: ['centered', 'left-aligned', 'right-aligned'],
      default: 'centered'
    },
    logo: {
      type: String,
      default: ''
    },
    maxWidth: {
      type: Number,
      default: 768,
      min: 320,
      max: 1920
    },
    logoSize: {
      width: {
        type: Number,
        default: 200,
        min: 1,
        max: 1000
      },
      height: {
        type: Number,
        default: 50,
        min: 1,
        max: 1000
      }
    },
    customCSS: {
      type: String,
      default: ''
    }
  },
  analytics: {
    totalViews: {
      type: Number,
      default: 0
    },
    uniqueViews: {
      type: Number,
      default: 0
    }
  },
  slug: {
    type: String,
    unique: true,
    sparse: true
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
maintenancePageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (!this.slug && this.title) {
    this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

// Method to increment view counts
maintenancePageSchema.methods.incrementViews = async function(isUnique = false) {
  this.analytics.totalViews += 1;
  if (isUnique) {
    this.analytics.uniqueViews += 1;
  }
  await this.save();
};

const MaintenancePage = mongoose.model('MaintenancePage', maintenancePageSchema);

module.exports = MaintenancePage; 