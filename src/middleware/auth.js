// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error_msg', 'Please log in to view this resource');
    res.redirect('/auth/login');
};

// Admin middleware
const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'admin') {
        return next();
    }
    req.flash('error_msg', 'You do not have permission to access this resource');
    res.redirect('/');
};

module.exports = {
    isAuthenticated,
    isAdmin
}; 