const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const incidentController = require('../controllers/incidentController');

// Get all incidents for a page
router.get('/pages/:pageId/incidents', isAuthenticated, incidentController.getIncidents);

// Get a specific incident
router.get('/incidents/:id', isAuthenticated, incidentController.getIncident);

// Create a new incident
router.post('/incidents', isAuthenticated, incidentController.validateIncident, incidentController.createIncident);

// Add an update to an incident
router.post('/incidents/:id/updates', isAuthenticated, incidentController.validateUpdate, incidentController.addUpdate);

// Update post-mortem
router.put('/incidents/:id/post-mortem', isAuthenticated, incidentController.updatePostMortem);

// Delete an incident
router.delete('/incidents/:id', isAuthenticated, incidentController.deleteIncident);

module.exports = router; 