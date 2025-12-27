const User = require('../models/User');
const Admin = require('../models/Admin');
const JWTService = require('../utils/jwt');
const logger = require('../utils/logger');

class AuthController {
    // User registration
    async register(req, res) {
        try {
            const { username, password, email, phone } = req.body;

            // Check if user exists
            const existingUser = await User.findOne({ 
                $or: [
                    { username },
                    { email },
                    { phone }
                ]
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    error: 'Tên đăng nhập, email hoặc số điện thoại đã tồn tại'
                });
            }

            // Create user
            const user = new User({
                username,
                password,
                email,
                phone,
                fullName: req.body.fullName
            });

            // Generate referral code
            user.generateReferralCode();

            await user.save();

            // Generate token
            const token = JWTService.generateUserToken(user._id);

            logger.info(`New user registered: ${username}`);

            res.status(201).json({
                success: true,
                message: 'Đăng ký thành công',
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
            res.status(500).json({
                success: false,
                error: 'Lỗi server',
                message: error.message
            });
        }
    }

    // User login
    async login(req, res) {
        try {
            const { username, password } = req.body;

            // Find user
            const user = await User.findOne({ username });
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Sai tên đăng nhập hoặc mật khẩu'
                });
            }

            // Check password
            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    error: 'Sai tên đăng nhập hoặc mật khẩu'
                });
            }

            // Check if user is active
            if (user.status !== 'active') {
                return res.status(403).json({
                    success: false,
                    error: 'Tài khoản bị khoá',
                    message: 'Tài khoản của bạn đã bị khoá. Vui lòng liên hệ hỗ trợ.'
                });
            }

            // Generate token
            const token = JWTService.generateUserToken(user._id);

            // Update login info
            user.lastLogin = new Date();
            user.loginCount += 1;
            await user.save();

            logger.info(`User logged in: ${username}`);

            res.json({
                success: true,
                message: 'Đăng nhập thành công',
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
            res.status(500).json({
                success: false,
                error: 'Lỗi server',
                message: error.message
            });
        }
    }

    // Admin login
    async adminLogin(req, res) {
        try {
            const { username, password } = req.body;

            // Find admin
            const admin = await Admin.findOne({ username });
            if (!admin) {
                return res.status(401).json({
                    success: false,
                    error: 'Sai tên đăng nhập hoặc mật khẩu'
                });
            }

            // Check password
            const isMatch = await admin.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    error: 'Sai tên đăng nhập hoặc mật khẩu'
                });
            }

            // Check if admin is active
            if (!admin.isActive) {
                return res.status(403).json({
                    success: false,
                    error: 'Tài khoản bị khoá',
                    message: 'Tài khoản admin của bạn đã bị khoá.'
                });
            }

            // Generate token
            const token = JWTService.generateAdminToken(admin._id, admin.role);

            // Update login info
            admin.lastLogin = new Date();
            admin.loginCount += 1;
            await admin.save();

            logger.info(`Admin logged in: ${username}`);

            res.json({
                success: true,
                message: 'Đăng nhập admin thành công',
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
            res.status(500).json({
                success: false,
                error: 'Lỗi server',
                message: error.message
            });
        }
    }

    // Get current user profile
    async getProfile(req, res) {
        try {
            res.json({
                success: true,
                user: req.user
            });
        } catch (error) {
            logger.error('Get profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Refresh token
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;
            
            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    error: 'Refresh token không tồn tại'
                });
            }

            const decoded = JWTService.verifyRefreshToken(refreshToken);
            const user = await User.findById(decoded.userId);
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Người dùng không tồn tại'
                });
            }

            const newToken = JWTService.generateUserToken(user._id);
            const newRefreshToken = JWTService.generateRefreshToken(user._id);

            res.json({
                success: true,
                token: newToken,
                refreshToken: newRefreshToken
            });

        } catch (error) {
            logger.error('Refresh token error:', error);
            res.status(401).json({
                success: false,
                error: 'Refresh token không hợp lệ'
            });
        }
    }

    // Check username availability
    async checkUsername(req, res) {
        try {
            const { username } = req.params;
            
            const user = await User.findOne({ username });
            const isAvailable = !user;
            
            res.json({
                success: true,
                isAvailable
            });

        } catch (error) {
            logger.error('Check username error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Logout
    async logout(req, res) {
        try {
            // In production, you might want to add token to blacklist
            res.json({
                success: true,
                message: 'Đăng xuất thành công'
            });
        } catch (error) {
            logger.error('Logout error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }
}

module.exports = new AuthController();
