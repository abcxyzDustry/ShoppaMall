const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            logger.info(`🔗 Attempting MongoDB connection (attempt ${retryCount + 1}/${maxRetries})...`);
            
            const options = {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 30000,
                socketTimeoutMS: 45000,
                maxPoolSize: 10,
                minPoolSize: 2,
                retryWrites: true,
                w: 'majority',
                appName: 'ShoppaMall'
            };
            
            await mongoose.connect(process.env.MONGODB_URI, options);
            
            logger.info('✅ MongoDB connected successfully!');
            logger.info(`📊 Database: ${mongoose.connection.name}`);
            logger.info(`🎯 Host: ${mongoose.connection.host}`);
            logger.info(`📈 Ready State: ${mongoose.connection.readyState}`);
            
            // Event listeners
            mongoose.connection.on('connected', () => {
                logger.info('📈 Mongoose connected to DB');
            });
            
            mongoose.connection.on('error', (err) => {
                logger.error('❌ Mongoose connection error:', err);
            });
            
            mongoose.connection.on('disconnected', () => {
                logger.warn('🔌 Mongoose disconnected from DB');
            });
            
            return mongoose.connection;
            
        } catch (error) {
            retryCount++;
            logger.error(`❌ MongoDB connection failed (attempt ${retryCount}/${maxRetries}):`, error.message);
            
            if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
                logger.info(`⏳ Retrying in ${delay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                logger.error('💥 Failed to connect to MongoDB after all retries');
                throw error;
            }
        }
    }
};

module.exports = connectDB;
