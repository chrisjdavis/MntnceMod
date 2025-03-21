const Incident = require('../models/Incident');
const MaintenancePage = require('../models/MaintenancePage');
const { body, validationResult } = require('express-validator');

// Validation middleware
exports.validateIncident = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('impact').isIn(['none', 'minor', 'major', 'critical']).withMessage('Invalid impact level'),
  body('affectedComponents').isArray().withMessage('Affected components must be an array'),
  body('pageId').isMongoId().withMessage('Invalid page ID')
];

exports.validateUpdate = [
  body('status').isIn(['investigating', 'identified', 'monitoring', 'resolved', 'post-mortem']).withMessage('Invalid status'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('impact').isIn(['none', 'minor', 'major', 'critical']).withMessage('Invalid impact level'),
  body('affectedComponents').isArray().withMessage('Affected components must be an array')
];

// Get all incidents for a page
exports.getIncidents = async (req, res) => {
  try {
    const { pageId } = req.params;
    const incidents = await Incident.find({ page: pageId, user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('updates.createdBy', 'name email');
    
    res.json({ incidents });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
};

// Get a specific incident
exports.getIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const incident = await Incident.findOne({ _id: id, user: req.user._id })
      .populate('updates.createdBy', 'name email');
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    res.json({ incident });
  } catch (error) {
    console.error('Error fetching incident:', error);
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
};

// Create a new incident
exports.createIncident = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user can create incidents
    const canCreate = await Incident.canCreateIncident(req.user._id);
    if (!canCreate) {
      return res.status(403).json({ error: 'Incident management is only available for Pro plan users' });
    }

    const { title, description, impact, affectedComponents, pageId } = req.body;

    // Verify page ownership
    const page = await MaintenancePage.findOne({ _id: pageId, user: req.user._id });
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const incident = await Incident.create({
      title,
      description,
      impact,
      affectedComponents,
      page: pageId,
      user: req.user._id,
      startTime: new Date(),
      updates: [{
        status: 'investigating',
        message: 'Initial incident report',
        impact,
        affectedComponents,
        createdBy: req.user._id
      }]
    });

    res.status(201).json({ incident });
  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).json({ error: 'Failed to create incident' });
  }
};

// Add an update to an incident
exports.addUpdate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status, message, impact, affectedComponents } = req.body;

    const incident = await Incident.findOne({ _id: id, user: req.user._id });
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    await incident.addUpdate({
      status,
      message,
      impact,
      affectedComponents,
      createdBy: req.user._id
    });

    res.json({ incident });
  } catch (error) {
    console.error('Error adding incident update:', error);
    res.status(500).json({ error: 'Failed to add incident update' });
  }
};

// Update post-mortem
exports.updatePostMortem = async (req, res) => {
  try {
    const { id } = req.params;
    const { summary, rootCause, resolution, prevention } = req.body;

    const incident = await Incident.findOne({ _id: id, user: req.user._id });
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    if (incident.status !== 'resolved') {
      return res.status(400).json({ error: 'Can only add post-mortem to resolved incidents' });
    }

    incident.postMortem = {
      summary,
      rootCause,
      resolution,
      prevention,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await incident.save();
    res.json({ incident });
  } catch (error) {
    console.error('Error updating post-mortem:', error);
    res.status(500).json({ error: 'Failed to update post-mortem' });
  }
};

// Delete an incident
exports.deleteIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const incident = await Incident.findOneAndDelete({ _id: id, user: req.user._id });
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting incident:', error);
    res.status(500).json({ error: 'Failed to delete incident' });
  }
}; 