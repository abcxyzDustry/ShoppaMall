const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

// Import routes
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const adminRoutes = require('./src/routes/admin');
const depositRoutes = require('./src/routes/deposits');
const withdrawRoutes = require('./src/routes/withdraws');
const botRoutes = require('./src/routes/bots');

// Import middleware
const { authenticateUser } = require('./src/middleware/auth');
const { authenticateAdmin } = require('./src/middleware/auth');

// Import utilities
const connectDB = require('./src/utils/database');
const logger = require('./src/utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware - configured for Replit iframe environment
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration - allow all origins for Replit proxy
app.use(cors({
    origin: true,
    credentials: true,
    optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined', { stream: logger.stream }));

// Serve static files from public directory
app.use(express.static('public'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateUser, userRoutes);
app.use('/api/admin', authenticateAdmin, adminRoutes);
app.use('/api/deposits', authenticateUser, depositRoutes);
app.use('/api/withdraws', authenticateUser, withdrawRoutes);
app.use('/api/bots', authenticateAdmin, botRoutes);

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/public/admin.html');
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.url}`
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(err.stack);
    
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' 
        ? 'Something went wrong!' 
        : err.message;
    
    res.status(statusCode).json({
        error: 'Server Error',
        message: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// Database connection
connectDB()
    .then(() => {
        // Start server only after DB connection
        app.listen(PORT, '0.0.0.0', () => {
            logger.info(`🚀 Server running on port ${PORT}`);
            logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`📊 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
        });
    })
    .catch(err => {
        logger.error('Failed to start server:', err);
        process.exit(1);
    });

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Starting graceful shutdown...');
    mongoose.connection.close(false, () => {
        logger.info('MongoDB connection closed.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received. Starting graceful shutdown...');
    mongoose.connection.close(false, () => {
        logger.info('MongoDB connection closed.');
        process.exit(0);
    });
});

module.exports = app; // For testing
