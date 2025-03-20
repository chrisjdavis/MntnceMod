const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const MaintenancePage = require('../models/MaintenancePage');

// Get analytics for a specific page
router.get('/:pageId', isAuthenticated, async (req, res) => {
  try {
    const page = await MaintenancePage.findOne({ 
      _id: req.params.pageId,
      user: req.user._id 
    });

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({
      analytics: page.analytics || {
        totalViews: 0,
        uniqueViews: 0
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
