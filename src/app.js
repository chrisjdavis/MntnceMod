require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const methodOverride = require('method-override');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
const csrf = require('csurf');
const loadSettings = require('./middleware/settings');

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/default');
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use(methodOverride('_method'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    clientPromise: Promise.resolve(mongoose.connection.getClient()),
    collectionName: 'sessions',
    ttl: 24 * 60 * 60 // 1 day
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// Flash messages middleware
app.use(flash());
app.use(loadSettings);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// CSRF protection
app.use(csrf());

// Pass CSRF token to all views
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Passport configuration
require('./config/passport');

// Global variables middleware
app.use((req, res, next) => {
  const success = req.flash('success') || req.flash('success_msg');
  const error = req.flash('error') || req.flash('error_msg');
  
  res.locals.messages = {};
  if (success && success.length > 0) {
    res.locals.messages.success = success;
  }
  if (error && error.length > 0) {
    res.locals.messages.error = error;
  }
  
  res.locals.user = req.user;
  next();
});

// Import routes
const authRoutes = require('./routes/auth');
const maintenanceRoutes = require('./routes/maintenance');
const indexRoutes = require('./routes/index');
const apiRoutes = require('./routes/api');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const pagesRoutes = require('./routes/pages');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhook');
const analyticsRoutes = require('./routes/analytics');

// Routes
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/settings', settingsRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/pages', pagesRoutes);
app.use('/admin', adminRoutes);
app.use('/webhook', webhookRoutes);
app.use('/analytics', analyticsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    error: 'Something went wrong!',
    layout: 'layouts/default'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; 