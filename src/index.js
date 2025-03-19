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
const loadSettings = require('./middleware/settings');

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {})
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/default');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);
app.set('layout extractMetas', true);
app.set('layout extractSections', true);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));

// Webhook route must be before body parsing middleware
app.use('/webhook', require('./routes/webhook'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
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

// Passport configuration
require('./config/passport');

// Global variables middleware
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user;
  next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));
app.use('/admin', require('./routes/admin'));
app.use('/pages', require('./routes/pages'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/settings', require('./routes/settings'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    error: 'Something went wrong!',
    layout: 'layouts/default'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {}); 