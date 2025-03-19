const express = require('express');
const passport = require('passport');
const router = express.Router();
const speakeasy = require('speakeasy');
const User = require('../models/User');

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
router.post('/login', (req, res, next) => {
    passport.authenticate('local', async (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            req.flash('error', info.message);
            return res.redirect('/auth/login');
        }

        // Check if 2FA is enabled
        if (user.twoFactorEnabled) {
            // Store user ID in session for 2FA verification
            req.session.tempUserId = user._id;
            return res.render('auth/2fa-verify', {
                title: 'Two-Factor Authentication',
                user: null,
                layout: 'layouts/default'
            });
        }

        // If no 2FA, proceed with normal login
        req.logIn(user, (err) => {
            if (err) return next(err);
            return res.redirect('/dashboard');
        });
    })(req, res, next);
});

// 2FA verification
router.post('/2fa/verify', async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.session.tempUserId;

        if (!userId) {
            req.flash('error', 'Session expired. Please login again.');
            return res.redirect('/auth/login');
        }

        const user = await User.findById(userId);
        if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
            req.flash('error', 'Invalid session. Please login again.');
            return res.redirect('/auth/login');
        }

        // Verify the code
        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: code
        });

        if (!verified) {
            req.flash('error', 'Invalid verification code. Please try again.');
            return res.render('auth/2fa-verify', {
                title: 'Two-Factor Authentication',
                user: null,
                layout: 'layouts/default'
            });
        }

        // Clear temporary user ID
        delete req.session.tempUserId;

        // Log the user in
        req.logIn(user, (err) => {
            if (err) {
                req.flash('error', 'Error logging in. Please try again.');
                return res.redirect('/auth/login');
            }
            return res.redirect('/dashboard');
        });
    } catch (error) {
        console.error('2FA verification error:', error);
        req.flash('error', 'Error verifying code. Please try again.');
        res.redirect('/auth/login');
    }
});

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