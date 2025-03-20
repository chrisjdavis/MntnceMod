const authRoutes = require('./routes/auth');
const maintenanceRoutes = require('./routes/maintenance');

// Routes
app.use('/auth', authRoutes);
app.use('/api/maintenance', maintenanceRoutes); 