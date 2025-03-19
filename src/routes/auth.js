const express = require('express');
const passport = require('passport');
const router = express.Router();

// Login page
router.get('/login', (req, res) => {
    res.render('auth/login', {
        title: 'Login',
        user: req.user,
        layout: 'layouts/default',
        error: req.flash('error')
    });
});

// Register page
router.get('/register', (req, res) => {
    res.render('auth/register', {
        title: 'Register',
        user: req.user,
        layout: 'layouts/default'
    });
});

// Login form submission
router.post('/login', passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/auth/login',
    failureFlash: true
}));

// Register form submission
router.post('/register', async (req, res) => {
    try {
        // TODO: Implement user registration logic
        res.redirect('/auth/login');
    } catch (error) {
        res.redirect('/auth/register');
    }
});

// Google OAuth routes
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    passport.authenticate('google', {
        successRedirect: '/dashboard',
        failureRedirect: '/auth/login'
    })
);

// GitHub OAuth routes
router.get('/github',
    passport.authenticate('github', { scope: ['user:email'] })
);

router.get('/github/callback',
    passport.authenticate('github', {
        successRedirect: '/dashboard',
        failureRedirect: '/auth/login'
    })
);

// Logout route
router.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

router.post('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

module.exports = router; 