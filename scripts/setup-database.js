const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../src/models/User');
const Admin = require('../src/models/Admin');
const BotSettings = require('../src/models/BotSettings');
const logger = require('../src/utils/logger');

async function setupDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('✅ Connected to MongoDB');
        
        // Drop existing collections (optional - for fresh setup)
        if (process.argv.includes('--fresh')) {
            await mongoose.connection.dropDatabase();
            logger.info('🗑️  Dropped existing database');
        }
        
        // Create default admin account
        const adminExists = await Admin.findOne({ username: process.env.ADMIN_USERNAME || 'admin' });
        
        if (!adminExists) {
            const admin = new Admin({
                username: process.env.ADMIN_USERNAME || 'admin',
                password: process.env.ADMIN_PASSWORD || 'admin123',
                email: process.env.ADMIN_EMAIL || 'admin@shoppamall.com',
                fullName: 'System Administrator',
                role: 'superadmin',
                permissions: {
                    users: true,
                    deposits: true,
                    withdraws: true,
                    notifications: true,
                    bots: true,
                    settings: true
                },
                isActive: true
            });
            
            await admin.save();
            logger.info(`✅ Created default admin: ${admin.username}`);
        } else {
            logger.info('✅ Admin account already exists');
        }
        
        // Create bot settings if not exists
        const botSettingsExists = await BotSettings.findOne();
        if (!botSettingsExists) {
            const botSettings = new BotSettings();
            await botSettings.save();
            logger.info('✅ Created bot settings');
        } else {
            logger.info('✅ Bot settings already exist');
        }
        
        // Create sample users for testing (optional)
        if (process.argv.includes('--sample')) {
            const sampleUsers = [
                {
                    username: 'demo_user',
                    password: 'demo123',
                    email: 'demo@shoppamall.com',
                    fullName: 'Demo User',
                    level: 3,
                    balance: 1000000,
                    commission: 500000,
                    deposited: 2000000,
                    tasksCompleted: 50
                },
                {
                    username: 'test_user',
                    password: 'test123',
                    email: 'test@shoppamall.com',
                    fullName: 'Test User',
                    level: 2,
                    balance: 500000,
                    commission: 250000,
                    deposited: 1000000,
                    tasksCompleted: 25
                }
            ];
            
            for (const userData of sampleUsers) {
                const userExists = await User.findOne({ username: userData.username });
                if (!userExists) {
                    const user = new User(userData);
                    user.generateReferralCode();
                    await user.save();
                    logger.info(`✅ Created sample user: ${user.username}`);
                }
            }
        }
        
        logger.info('✅ Database setup completed successfully');
        process.exit(0);
        
    } catch (error) {
        logger.error('❌ Database setup failed:', error);
        process.exit(1);
    }
}

// Handle script arguments
if (require.main === module) {
    setupDatabase();
}

module.exports = setupDatabase;
