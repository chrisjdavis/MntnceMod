require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function updateAdminRole() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);

        // Update admin user
        const user = await User.findOneAndUpdate(
            { email: 'admin@example.com' },
            { 
                role: 'admin',
                status: 'active'
            },
            { new: true }
        );

        if (!user) {
            console.error('Admin user not found');
            process.exit(1);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error updating admin user:', error);
        process.exit(1);
    }
}

updateAdminRole(); 