const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const Page = require('../models/MaintenancePage');
const Activity = require('../models/Activity');
const User = require('../models/User');

// List all pages
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const pages = await Page.find({ user: req.user._id }).sort({ createdAt: -1 });
    const subscriptionLimits = await req.user.subscriptionLimits;
    const canCreatePage = await req.user.canCreatePage();
    
    res.render('pages/index', { 
      pages,
      user: {
        ...req.user.toObject(),
        subscriptionLimits,
        canCreatePage
      },
      active: 'pages'
    });
  } catch (error) {
    console.error('Pages Error:', error);
    req.flash('error_msg', 'Error loading pages');
    res.redirect('/dashboard');
  }
});

// Create new page form
router.get('/new', isAuthenticated, async (req, res) => {
  try {
    // Check if user can create more pages
    const canCreate = await req.user.canCreatePage();
    if (!canCreate) {
      if (req.user.subscription.status !== 'active') {
        req.flash('error_msg', 'Your subscription is not active. Please update your subscription to create new pages.');
      } else {
        req.flash('error_msg', 'You have reached your page limit. Please upgrade your plan to create more pages.');
      }
      return res.redirect('/pages');
    }
    res.render('pages/new', {
      user: req.user,
      active: 'pages'
    });
  } catch (error) {
    console.error('New Page Error:', error);
    req.flash('error_msg', 'Error loading page editor');
    res.redirect('/pages');
  }
});

// Create new page
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { title, description, content, status, design } = req.body;

    // Check if user can create more pages
    const canCreate = await req.user.canCreatePage();
    if (!canCreate) {
      req.flash('error_msg', 'You have reached your page limit. Please upgrade your plan.');
      return res.redirect('/pages');
    }

    const page = await Page.create({
      title,
      description,
      content,
      status,
      user: req.user._id,
      design: {
        backgroundColor: design?.backgroundColor || '#000000',
        textColor: design?.textColor || '#ffffff',
        fontFamily: design?.fontFamily || 'Inter',
        layout: design?.layout || 'centered',
        logo: design?.logo || '',
        customCSS: design?.customCSS || ''
      }
    });

    // Log activity
    await Activity.log(req.user._id, 'page_create', `Created new page: ${title}`);

    req.flash('success_msg', 'Page created successfully');
    res.redirect(`/pages/${page._id}`);
  } catch (error) {
    console.error('Create Page Error:', error);
    req.flash('error_msg', 'Error creating page');
    res.redirect('/pages/new');
  }
});

// View page
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const page = await Page.findOne({ _id: req.params.id, user: req.user._id });
    if (!page) {
      req.flash('error_msg', 'Page not found');
      return res.redirect('/pages');
    }
    res.render('pages/view', { 
      page,
      user: req.user,
      active: 'pages'
    });
  } catch (error) {
    console.error('View Page Error:', error);
    req.flash('error_msg', 'Error loading page');
    res.redirect('/pages');
  }
});

// Edit page form
router.get('/:id/edit', isAuthenticated, async (req, res) => {
  try {
    const page = await Page.findOne({ _id: req.params.id, user: req.user._id });
    if (!page) {
      req.flash('error_msg', 'Page not found');
      return res.redirect('/pages');
    }
    res.render('pages/edit', { 
      page,
      user: req.user,
      active: 'pages'
    });
  } catch (error) {
    console.error('Edit Page Error:', error);
    req.flash('error_msg', 'Error loading page editor');
    res.redirect('/pages');
  }
});

// Update page
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const { title, description, content, status, design, isPublished } = req.body;

    const page = await Page.findOne({ _id: req.params.id, user: req.user._id });
    if (!page) {
      req.flash('error_msg', 'Page not found');
      return res.redirect('/pages');
    }

    // Update basic fields
    page.title = title;
    page.description = description;
    page.content = content;
    
    // Handle status and publish state
    if (isPublished === 'on') {
      page.status = 'published';
    } else if (status === 'archived') {
      page.status = 'archived';
    } else {
      page.status = 'draft';
    }

    // Ensure slug exists
    if (!page.slug) {
      page.slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    if (design) {
      page.design = {
        backgroundColor: design.backgroundColor,
        textColor: design.textColor,
        fontFamily: design.fontFamily || page.design?.fontFamily || 'Inter',
        layout: design.layout || page.design?.layout || 'centered',
        logo: design.logo || page.design?.logo || '',
        maxWidth: design.maxWidth || page.design?.maxWidth || 768,
        logoSize: {
          width: design.logoSize?.width || page.design?.logoSize?.width || 200,
          height: design.logoSize?.height || page.design?.logoSize?.height || 50
        },
        customCSS: design.customCSS || page.design?.customCSS || ''
      };
    }

    await page.save();

    // Log activity
    await Activity.log(req.user._id, 'page_update', `Updated page: ${title}`);

    req.flash('success_msg', 'Page updated successfully');
    res.redirect(`/pages/${page._id}`);
  } catch (error) {
    console.error('Update Page Error:', error);
    req.flash('error_msg', 'Error updating page');
    res.redirect(`/pages/${req.params.id}/edit`);
  }
});

// Archive page
router.post('/:id/archive', isAuthenticated, async (req, res) => {
  try {
    const page = await Page.findOne({ _id: req.params.id, user: req.user._id });
    if (!page) {
      req.flash('error_msg', 'Page not found');
      return res.redirect('/pages');
    }

    page.status = 'archived';
    await page.save();

    // Log activity
    await Activity.log(req.user._id, 'page_archive', `Archived page: ${page.title}`);

    req.flash('success_msg', 'Page archived successfully');
    res.redirect('/pages');
  } catch (error) {
    console.error('Archive Page Error:', error);
    req.flash('error_msg', 'Error archiving page');
    res.redirect('/pages');
  }
});

// Delete page
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const page = await Page.findOne({ _id: req.params.id, user: req.user._id });
    if (!page) {
      req.flash('error_msg', 'Page not found');
      return res.redirect('/pages');
    }

    await page.remove();

    // Log activity
    await Activity.log(req.user._id, 'page_delete', `Deleted page: ${page.title}`);

    req.flash('success_msg', 'Page deleted successfully');
    res.redirect('/pages');
  } catch (error) {
    console.error('Delete Page Error:', error);
    req.flash('error_msg', 'Error deleting page');
    res.redirect('/pages');
  }
});

// Preview page
router.get('/:id/preview', isAuthenticated, async (req, res) => {
  try {
    const page = await Page.findOne({ _id: req.params.id, user: req.user._id });
    if (!page) {
      req.flash('error_msg', 'Page not found');
      return res.redirect('/pages');
    }
    res.render('pages/preview', { 
      page,
      user: req.user,
      active: 'pages',
      layout: false
    });
  } catch (error) {
    console.error('Preview Page Error:', error);
    req.flash('error_msg', 'Error loading page preview');
    res.redirect('/pages');
  }
});

// Public view page
router.get('/:id/view', async (req, res) => {
  try {
    const page = await Page.findOne({ _id: req.params.id });
    if (!page) {
      return res.redirect('/');
    }

    // Check if page has reached view limit
    const user = await User.findById(page.user);
    if (!user) {
      return res.redirect('/');
    }

    const subscriptionLimits = await user.subscriptionLimits;
    const viewsPerPage = subscriptionLimits.viewsPerPage || 1000;

    if (page.analytics.totalViews >= viewsPerPage) {
      return res.redirect('/');
    }

    // Check if this is a unique visitor using a cookie
    const visitorCookie = `visitor_${page._id}`;
    const isUnique = !req.cookies[visitorCookie];

    // Increment view count
    await page.incrementViews(isUnique);

    // Set cookie to mark this visitor
    res.cookie(visitorCookie, '1', {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true
    });

    res.render('pages/public', { 
      page,
      layout: false
    });
  } catch (error) {
    console.error('Public View Error:', error);
    res.redirect('/');
  }
});

// API endpoint to track page views
router.post('/:id/view', async (req, res) => {
  try {
    const page = await Page.findOne({ _id: req.params.id });
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Check if page has reached view limit
    const user = await User.findById(page.user);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscriptionLimits = await user.subscriptionLimits;
    const viewsPerPage = subscriptionLimits.viewsPerPage || 1000;

    if (page.analytics.totalViews >= viewsPerPage) {
      return res.status(403).json({ error: 'View limit reached' });
    }

    // Check if this is a unique visitor using a cookie
    const visitorCookie = `visitor_${page._id}`;
    const isUnique = !req.cookies[visitorCookie];

    // Increment view count
    await page.incrementViews(isUnique);

    // Set cookie to mark this visitor
    res.cookie(visitorCookie, '1', {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Track View Error:', error);
    res.status(500).json({ error: 'Error tracking view' });
  }
});

module.exports = router;