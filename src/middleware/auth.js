const LoginHistory = require('../models/LoginHistory');

// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'Please log in to access this page');
    res.redirect('/auth/login');
};

// Admin middleware
const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'admin') {
        return next();
    }
    req.flash('error', 'You do not have permission to access this page');
    res.redirect('/dashboard');
};

// Middleware to track login history
async function trackLoginHistory(req, res, next) {
    if (!req.user) return next();

    try {
        await LoginHistory.create({
            user: req.user._id,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            successful: true
        });
    } catch (error) {
        console.error('Error tracking login history:', error);
    }
    next();
}

module.exports = {
    isAuthenticated,
    isAdmin,
    trackLoginHistory
}; 