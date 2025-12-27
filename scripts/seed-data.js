const mongoose = require('mongoose');
require('dotenv').config();

// Import models and generator
const User = require('../src/models/User');
const Deposit = require('../src/models/Deposit');
const Withdraw = require('../src/models/Withdraw');
const Task = require('../src/models/Task');
const FakeTransactionGenerator = require('../src/utils/fakeTransactions');
const logger = require('../src/utils/logger');

async function seedData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('✅ Connected to MongoDB');
        
        // Parse command line arguments
        const args = process.argv.slice(2);
        const userCount = parseInt(args.find(arg => arg.startsWith('--users='))?.split('=')[1]) || 50;
        const transactionsPerUser = parseInt(args.find(arg => arg.startsWith('--transactions='))?.split('=')[1]) || 10;
        
        logger.info(`🌱 Starting data seeding with ${userCount} users and ${transactionsPerUser} transactions per user`);
        
        // Step 1: Create fake users
        logger.info('📝 Creating fake users...');
        const fakeUsers = await FakeTransactionGenerator.createFakeUsers(userCount);
        
        // Step 2: Create fake transactions for each user
        logger.info('💸 Creating fake transactions...');
        const transactions = await FakeTransactionGenerator.createFakeTransactions(fakeUsers, transactionsPerUser);
        
        // Step 3: Create some fake admin accounts (optional)
        if (args.includes('--with-admins')) {
            logger.info('👨‍💼 Creating fake admin accounts...');
            // Add admin creation logic if needed
        }
        
        // Step 4: Create bot settings if not exists
        const BotSettings = require('../src/models/BotSettings');
        const botSettingsExists = await BotSettings.findOne();
        if (!botSettingsExists) {
            const botSettings = new BotSettings();
            await botSettings.save();
            logger.info('🤖 Created bot settings');
        }
        
        // Summary
        const totalUsers = await User.countDocuments();
        const totalDeposits = await Deposit.countDocuments();
        const totalWithdraws = await Withdraw.countDocuments();
        const totalTasks = await Task.countDocuments();
        
        logger.info('✅ Data seeding completed successfully!');
        logger.info('📊 Summary:');
        logger.info(`   👥 Total Users: ${totalUsers}`);
        logger.info(`   💰 Total Deposits: ${totalDeposits}`);
        logger.info(`   💳 Total Withdraws: ${totalWithdraws}`);
        logger.info(`   ✅ Total Tasks: ${totalTasks}`);
        
        process.exit(0);
        
    } catch (error) {
        logger.error('❌ Data seeding failed:', error);
        process.exit(1);
    }
}

// Handle script arguments
if (require.main === module) {
    seedData();
}

module.exports = seedData;
