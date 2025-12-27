const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Admin = require('../models/Admin');
const logger = require('../utils/logger');

// User registration
router.post('/register', [
    body('username')
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters')
        .trim()
        .escape(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    body('confirmPassword')
        .custom((value, { req }) => value === req.body.password)
        .withMessage('Passwords do not match')
], async (req, res) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Create user
        const user = new User({
            username,
            password,
            createdAt: new Date()
        });

        // Generate referral code
        user.generateReferralCode();

        await user.save();

        // Create token
        const token = jwt.sign(
            { userId: user._id, role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '30d' }
        );

        // Update user login info
        user.lastLogin = new Date();
        user.loginCount += 1;
        await user.save();

        logger.info(`New user registered: ${username}`);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                level: user.level,
                balance: user.balance,
                commission: user.commission,
                totalBalance: user.totalBalance,
                referralCode: user.referralCode
            }
        });

    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

// User login
router.post('/login', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if user is active
        if (user.status !== 'active') {
            return res.status(403).json({ 
                error: 'Account suspended', 
                message: 'Your account has been suspended. Please contact support.' 
            });
        }

        // Create token
        const token = jwt.sign(
            { userId: user._id, role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '30d' }
        );

        // Update login info
        user.lastLogin = new Date();
        user.loginCount += 1;
        await user.save();

        logger.info(`User logged in: ${username}`);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                level: user.level,
                balance: user.balance,
                commission: user.commission,
                deposited: user.deposited,
                totalBalance: user.totalBalance,
                tasksCompleted: user.tasksCompleted,
                referralCode: user.referralCode
            }
        });

    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

// Admin login
router.post('/admin/login', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        // Find admin - case insensitive search
        const admin = await Admin.findOne({ username: new RegExp(`^${username}$`, 'i') });
        if (!admin) {
            logger.warn(`Admin login failed: admin not found for username: ${username}`);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
            logger.warn(`Admin login failed: invalid password for username: ${username}`);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Check if admin is active
        if (!admin.isActive) {
            logger.warn(`Admin login failed: account deactivated for username: ${username}`);
            return res.status(403).json({ 
                success: false,
                error: 'Account deactivated', 
                message: 'Your admin account has been deactivated.' 
            });
        }

        // Create token
        const token = jwt.sign(
            { adminId: admin._id, role: admin.role },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Update login info
        admin.lastLogin = new Date();
        admin.loginCount += 1;
        await admin.save();

        logger.info(`Admin logged in: ${username}`);

        res.json({
            success: true,
            message: 'Admin login successful',
            token,
            admin: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                fullName: admin.fullName,
                role: admin.role,
                permissions: admin.permissions
            }
        });

    } catch (error) {
        logger.error('Admin login error:', error);
        res.status(500).json({ success: false, error: 'Server error', message: error.message });
    }
});

// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Create new token
        const newToken = jwt.sign(
            { userId: decoded.userId, role: decoded.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '30d' }
        );

        res.json({
            success: true,
            token: newToken
        });

    } catch (error) {
        logger.error('Token refresh error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Check username availability
router.get('/check-username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        const user = await User.findOne({ username });
        const isAvailable = !user;
        
        res.json({
            success: true,
            isAvailable
        });

    } catch (error) {
        logger.error('Username check error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
