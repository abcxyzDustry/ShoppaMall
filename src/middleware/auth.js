const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const logger = require('../utils/logger');

// User authentication middleware
const authenticateUser = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if token is for user
        if (decoded.role !== 'user') {
            return res.status(401).json({ error: 'Invalid token type' });
        }

        const user = await User.findById(decoded.userId);
        
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Check if user is active
        if (user.status !== 'active') {
            return res.status(403).json({ 
                error: 'Account suspended', 
                message: 'Your account has been suspended.' 
            });
        }

        req.user = user;
        req.userId = user._id;
        req.token = token;
        
        next();
    } catch (error) {
        logger.error('Authentication error:', error.message);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        
        res.status(500).json({ error: 'Authentication failed' });
    }
};

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if token is for admin
        if (!['superadmin', 'admin', 'moderator', 'support'].includes(decoded.role)) {
            return res.status(401).json({ error: 'Invalid token type' });
        }

        const admin = await Admin.findById(decoded.adminId);
        
        if (!admin) {
            return res.status(401).json({ error: 'Admin not found' });
        }

        // Check if admin is active
        if (!admin.isActive) {
            return res.status(403).json({ 
                error: 'Account deactivated', 
                message: 'Your admin account has been deactivated.' 
            });
        }

        req.admin = admin;
        req.adminId = admin._id;
        req.adminRole = admin.role;
        req.token = token;
        
        next();
    } catch (error) {
        logger.error('Admin authentication error:', error.message);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        
        res.status(500).json({ error: 'Authentication failed' });
    }
};

// Role-based authorization middleware
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.adminRole)) {
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: 'You do not have permission to perform this action' 
            });
        }
        next();
    };
};

// Permission-based authorization middleware
const hasPermission = (permission) => {
    return (req, res, next) => {
        if (req.adminRole === 'superadmin') {
            return next();
        }
        
        if (!req.admin.hasPermission(permission)) {
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: `You do not have ${permission} permission` 
            });
        }
        next();
    };
};

module.exports = {
    authenticateUser,
    authenticateAdmin,
    authorize,
    hasPermission
};
