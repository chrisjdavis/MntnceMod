const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const { isAuthenticated } = require('../middleware/auth');

// All routes require authentication
router.use(isAuthenticated);

// Get all maintenance pages
router.get('/pages', maintenanceController.getPages);

// Get a specific maintenance page
router.get('/pages/:id', maintenanceController.getPage);

// Create a new maintenance page
router.post('/pages', maintenanceController.deployPage);

// Update a maintenance page
router.put('/pages/:id', maintenanceController.updatePage);

// Delete a maintenance page
router.delete('/pages/:id', maintenanceController.deletePage);

module.exports = router; 