const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Page = require('../models/MaintenancePage');
const Analytics = require('../models/Analytics');
const User = require('../models/User');
const mongoose = require('mongoose');
const eventEmitter = require('../utils/eventEmitter');

// Validation middleware
const validatePage = [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('status').isIn(['operational', 'degraded', 'down', 'maintenance']).withMessage('Invalid status'),
    body('design.backgroundColor').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid background color'),
    body('design.textColor').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid text color'),
    body('design.fontFamily').optional().isIn(['Inter', 'Roboto', 'Open Sans']).withMessage('Invalid font family'),
    body('design.layout').optional().isIn(['centered', 'left-aligned', 'right-aligned']).withMessage('Invalid layout'),
    body('design.logo').optional().isURL().withMessage('Invalid logo URL')
];

// Error handler middleware
const handleErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Pages API Endpoints
router.get('/pages', isAuthenticated, async (req, res) => {
    try {
        const pages = await Page.find({ user: req.user._id });
        res.json(pages);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pages' });
    }
});

router.get('/pages/:id', isAuthenticated, async (req, res) => {
    try {
        const page = await Page.findOne({ _id: req.params.id, user: req.user._id });
        if (!page) {
            return res.status(404).json({ error: 'Page not found' });
        }
        res.json(page);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch page' });
    }
});

router.post('/pages', isAuthenticated, validatePage, handleErrors, async (req, res) => {
    try {
        const page = new Page({
            ...req.body,
            user: req.user._id
        });
        await page.save();
        res.status(201).json(page);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create page' });
    }
});

router.put('/pages/:id', isAuthenticated, validatePage, handleErrors, async (req, res) => {
    try {
        const page = await Page.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { ...req.body },
            { new: true, runValidators: true }
        );
        if (!page) {
            return res.status(404).json({ error: 'Page not found' });
        }
        res.json(page);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update page' });
    }
});

router.delete('/pages/:id', isAuthenticated, async (req, res) => {
    try {
        const page = await Page.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        if (!page) {
            return res.status(404).json({ error: 'Page not found' });
        }
        res.json({ message: 'Page deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete page' });
    }
});

// Analytics API Endpoints
router.get('/analytics/page/:pageId', isAuthenticated, async (req, res) => {
    try {
        const analytics = await Analytics.find({ page: req.params.pageId })
            .sort('-timestamp')
            .limit(30); // Last 30 days
        res.json(analytics);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

router.get('/analytics/summary', isAuthenticated, async (req, res) => {
    try {
        const summary = await Analytics.aggregate([
            { $match: { user: mongoose.Types.ObjectId(req.user._id) } },
            {
                $group: {
                    _id: '$page',
                    totalViews: { $sum: '$views' },
                    avgResponseTime: { $avg: '$responseTime' }
                }
            }
        ]);
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch analytics summary' });
    }
});

// User API Endpoints
router.get('/user/profile', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

router.put('/user/profile', isAuthenticated, [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Invalid email')
], handleErrors, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: { name: req.body.name, email: req.body.email } },
            { new: true, runValidators: true }
        ).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Admin API Endpoints
router.get('/admin/users', isAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.get('/admin/analytics', isAdmin, async (req, res) => {
    try {
        const analytics = await Analytics.aggregate([
            {
                $group: {
                    _id: null,
                    totalViews: { $sum: '$views' },
                    avgResponseTime: { $avg: '$responseTime' },
                    totalPages: { $addToSet: '$page' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalViews: 1,
                    avgResponseTime: 1,
                    totalPages: { $size: '$totalPages' }
                }
            }
        ]);
        res.json(analytics[0] || { totalViews: 0, avgResponseTime: 0, totalPages: 0 });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch admin analytics' });
    }
});

// Preview API Endpoint
router.get('/preview', isAuthenticated, async (req, res) => {
    try {
        const { title, description, status, design } = req.query;
        res.render('preview', {
            title,
            description,
            status,
            design: {
                backgroundColor: design?.backgroundColor || '#000000',
                textColor: design?.textColor || '#ffffff',
                fontFamily: design?.fontFamily || 'Inter',
                layout: design?.layout || 'centered',
                logo: design?.logo || ''
            },
            layout: false
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});

// SSE endpoint for real-time updates
router.get('/events', isAuthenticated, (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial connection message
  res.write('data: {"type": "connected"}\n\n');

  // Handle user-specific updates
  const handleUserUpdate = (data) => {
    if (data.userId === req.user._id.toString()) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  // Subscribe to events
  eventEmitter.on('userUpdate', handleUserUpdate);

  // Handle client disconnect
  req.on('close', () => {
    eventEmitter.removeListener('userUpdate', handleUserUpdate);
  });
});

module.exports = router; 