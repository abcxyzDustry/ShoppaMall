const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
require('dotenv').config();

const initAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        // Check if admin exists
        const existingAdmin = await Admin.findOne({ username: 'admin' });
        
        if (existingAdmin) {
            console.log('✅ Admin account already exists');
            process.exit(0);
        }

        // Create default admin
        const admin = new Admin({
            username: 'admin',
            password: 'admin123',
            email: 'admin@shoppamall.com',
            fullName: 'System Administrator',
            role: 'superadmin',
            permissions: {
                users: true,
                deposits: true,
                withdraws: true,
                notifications: true,
                bots: true,
                settings: true
            }
        });

        await admin.save();
        console.log('✅ Default admin account created successfully!');
        console.log('📝 Username: admin');
        console.log('🔐 Password: admin123');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin:', error.message);
        process.exit(1);
    }
};

initAdmin();
