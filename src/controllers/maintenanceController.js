const cloudflare = require('../services/cloudflare');
const MaintenancePage = require('../models/MaintenancePage');

exports.getPages = async (req, res) => {
  try {
    const pages = await MaintenancePage.find({ user: req.user._id });
    res.json({ pages });
  } catch (error) {
    console.error('Error fetching maintenance pages:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance pages' });
  }
};

exports.deployPage = async (req, res) => {
  try {
    const { 
      domain, 
      title, 
      message, 
      status, 
      backgroundColor, 
      textColor, 
      statusBadgeColor, 
      statusTextColor,
      design,
      isActive 
    } = req.body;
    
    // Create maintenance page record
    const page = await MaintenancePage.create({
      user: req.user._id,
      domain,
      title,
      message,
      status,
      backgroundColor,
      textColor,
      statusBadgeColor,
      statusTextColor,
      design,
      isActive: isActive || true
    });

    // Initialize Cloudflare client with user's credentials
    await cloudflare.initializeForUser(req.user._id);

    // Deploy to Cloudflare
    await cloudflare.deployMaintenancePage(domain, page);

    res.json({ success: true, page });
  } catch (error) {
    console.error('Error deploying maintenance page:', error);
    res.status(500).json({ error: 'Failed to deploy maintenance page' });
  }
};

exports.updatePage = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      domain,
      title, 
      message, 
      status, 
      backgroundColor, 
      textColor, 
      statusBadgeColor, 
      statusTextColor,
      design,
      isActive 
    } = req.body;

    // Update page in database
    const page = await MaintenancePage.findOneAndUpdate(
      { _id: id, user: req.user._id },
      {
        domain,
        title,
        message,
        status,
        backgroundColor,
        textColor,
        statusBadgeColor,
        statusTextColor,
        design,
        isActive
      },
      { new: true }
    );

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Initialize Cloudflare client with user's credentials
    await cloudflare.initializeForUser(req.user._id);

    // Update in Cloudflare
    await cloudflare.updateMaintenancePage(page.domain, page);

    res.json({ success: true, page });
  } catch (error) {
    console.error('Error updating maintenance page:', error);
    res.status(500).json({ error: 'Failed to update maintenance page' });
  }
};

exports.deletePage = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get page details before deletion
    const page = await MaintenancePage.findOne({ _id: id, user: req.user._id });
    
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Initialize Cloudflare client with user's credentials
    await cloudflare.initializeForUser(req.user._id);

    // Delete from Cloudflare first
    await cloudflare.deleteMaintenancePage(page.domain);

    // Delete from database
    await MaintenancePage.deleteOne({ _id: id, user: req.user._id });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting maintenance page:', error);
    res.status(500).json({ error: 'Failed to delete maintenance page' });
  }
};

exports.getPage = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await MaintenancePage.findOne({ _id: id, user: req.user._id });
    
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ page });
  } catch (error) {
    console.error('Error fetching maintenance page:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance page' });
  }
}; 