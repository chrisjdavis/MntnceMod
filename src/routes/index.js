const express = require('express');
const router = express.Router();
const SubscriptionPlan = require('../models/SubscriptionPlan');

// Home page
router.get('/', (req, res) => {
    res.render('index', {
        title: 'Home',
        user: req.user,
        layout: 'layouts/default'
    });
});

// About page
router.get('/about', (req, res) => {
    res.render('about', {
        title: 'About',
        user: req.user,
        layout: 'layouts/default'
    });
});

// Pricing page
router.get('/pricing', async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
        const currentPlanCode = req.user ? req.user.subscription.plan : null;
        res.render('pricing', {
            title: 'Pricing',
            user: req.user,
            plans,
            currentPlanCode,
            layout: 'layouts/default'
        });
    } catch (error) {
        console.error('Error loading pricing page:', error);
        res.render('pricing', {
            title: 'Pricing',
            user: req.user,
            plans: [],
            currentPlanCode: null,
            layout: 'layouts/default'
        });
    }
});

module.exports = router; 