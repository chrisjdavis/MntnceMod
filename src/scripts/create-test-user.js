require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function createTestUser() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);

        // Create test user
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const user = await User.create({
            email: 'admin@example.com',
            name: 'Admin User',
            password: hashedPassword,
            role: 'admin',
            status: 'active',
            subscription: {
                plan: 'enterprise',
                status: 'active'
            }
        });

        process.exit(0);
    } catch (error) {
        console.error('Error creating test user:', error);
        process.exit(1);
    }
}

createTestUser(); 