const User = require('../models/User');
const Deposit = require('../models/Deposit');
const Withdraw = require('../models/Withdraw');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const FakeTransactionGenerator = require('../utils/fakeTransactions');
const logger = require('../utils/logger');

class UserController {
    // Get user profile
    async getProfile(req, res) {
        try {
            const user = await User.findById(req.userId)
                .select('-password -__v');
            
            res.json({
                success: true,
                user
            });
        } catch (error) {
            logger.error('Get profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Update user profile
    async updateProfile(req, res) {
        try {
            const { fullName, email, phone } = req.body;
            
            const user = await User.findById(req.userId);
            
            if (email && email !== user.email) {
                const emailExists = await User.findOne({ email, _id: { $ne: user._id } });
                if (emailExists) {
                    return res.status(400).json({
                        success: false,
                        error: 'Email đã tồn tại'
                    });
                }
                user.email = email;
            }
            
            if (phone && phone !== user.phone) {
                const phoneExists = await User.findOne({ phone, _id: { $ne: user._id } });
                if (phoneExists) {
                    return res.status(400).json({
                        success: false,
                        error: 'Số điện thoại đã tồn tại'
                    });
                }
                user.phone = phone;
            }
            
            if (fullName) {
                user.fullName = fullName;
            }
            
            await user.save();
            
            res.json({
                success: true,
                message: 'Cập nhật thông tin thành công',
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    phone: user.phone,
                    fullName: user.fullName
                }
            });
        } catch (error) {
            logger.error('Update profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Update bank information
    async updateBankInfo(req, res) {
        try {
            const { bankName, accountNumber, accountHolder, branch } = req.body;
            
            const user = await User.findById(req.userId);
            user.bankInfo = {
                bankName,
                accountNumber,
                accountHolder,
                branch
            };
            
            await user.save();
            
            res.json({
                success: true,
                message: 'Cập nhật thông tin ngân hàng thành công'
            });
        } catch (error) {
            logger.error('Update bank info error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get user statistics
    async getUserStats(req, res) {
        try {
            const userId = req.userId;
            
            const [
                totalDeposits,
                totalWithdraws,
                totalTasks,
                recentDeposits,
                recentWithdraws
            ] = await Promise.all([
                Deposit.aggregate([
                    { $match: { user: userId, status: 'completed' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Withdraw.aggregate([
                    { $match: { user: userId, status: 'completed' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Task.countDocuments({ user: userId, status: 'completed' }),
                Deposit.find({ user: userId })
                    .sort({ createdAt: -1 })
                    .limit(5),
                Withdraw.find({ user: userId })
                    .sort({ createdAt: -1 })
                    .limit(5)
            ]);
            
            const user = await User.findById(userId);
            
            res.json({
                success: true,
                stats: {
                    totalDeposited: totalDeposits[0]?.total || 0,
                    totalWithdrawn: totalWithdraws[0]?.total || 0,
                    totalTasksCompleted: totalTasks,
                    currentBalance: user.balance + user.commission,
                    commissionEarned: user.commission,
                    level: user.level,
                    tasksCompleted: user.tasksCompleted
                },
                recentDeposits,
                recentWithdraws
            });
        } catch (error) {
            logger.error('Get user stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get user transactions
    async getTransactions(req, res) {
        try {
            const { type, page = 1, limit = 20 } = req.query;
            const userId = req.userId;
            
            let query = { user: userId };
            let model;
            
            if (type === 'deposit') {
                model = Deposit;
            } else if (type === 'withdraw') {
                model = Withdraw;
            } else if (type === 'task') {
                model = Task;
            } else {
                // Get all transactions combined
                const [deposits, withdraws, tasks] = await Promise.all([
                    Deposit.find({ user: userId })
                        .sort({ createdAt: -1 })
                        .skip((page - 1) * limit)
                        .limit(parseInt(limit)),
                    Withdraw.find({ user: userId })
                        .sort({ createdAt: -1 })
                        .skip((page - 1) * limit)
                        .limit(parseInt(limit)),
                    Task.find({ user: userId })
                        .sort({ createdAt: -1 })
                        .skip((page - 1) * limit)
                        .limit(parseInt(limit))
                ]);
                
                // Combine and sort all transactions
                const allTransactions = [
                    ...deposits.map(d => ({ ...d.toObject(), type: 'deposit' })),
                    ...withdraws.map(w => ({ ...w.toObject(), type: 'withdraw' })),
                    ...tasks.map(t => ({ ...t.toObject(), type: 'task' }))
                ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                const total = await Promise.all([
                    Deposit.countDocuments({ user: userId }),
                    Withdraw.countDocuments({ user: userId }),
                    Task.countDocuments({ user: userId })
                ]).then(counts => counts.reduce((a, b) => a + b, 0));
                
                return res.json({
                    success: true,
                    transactions: allTransactions,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                });
            }
            
            const transactions = await model.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit));
            
            const total = await model.countDocuments(query);
            
            res.json({
                success: true,
                transactions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            logger.error('Get transactions error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get referral information
    async getReferralInfo(req, res) {
        try {
            const user = await User.findById(req.userId);
            
            const referredUsers = await User.find({ referredBy: user._id })
                .select('username createdAt level deposited')
                .sort({ createdAt: -1 });
            
            const totalReferrals = referredUsers.length;
            const totalDeposited = referredUsers.reduce((sum, u) => sum + (u.deposited || 0), 0);
            
            res.json({
                success: true,
                referralCode: user.referralCode,
                referralLink: `${req.protocol}://${req.get('host')}/register?ref=${user.referralCode}`,
                stats: {
                    totalReferrals,
                    totalDeposited,
                    activeReferrals: referredUsers.filter(u => u.deposited > 0).length
                },
                referredUsers
            });
        } catch (error) {
            logger.error('Get referral info error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Change password
    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            
            const user = await User.findById(req.userId);
            
            // Check current password
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    error: 'Mật khẩu hiện tại không đúng'
                });
            }
            
            // Update password
            user.password = newPassword;
            await user.save();
            
            res.json({
                success: true,
                message: 'Đổi mật khẩu thành công'
            });
        } catch (error) {
            logger.error('Change password error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get level information
    async getLevelInfo(req, res) {
        try {
            const user = await User.findById(req.userId);
            
            const commissionRates = {
                1: 1500,
                2: 2200,
                3: 3300,
                4: 4000,
                5: 5500
            };
            
            const levelRequirements = {
                1: { deposited: 0, tasks: 0 },
                2: { deposited: 500000, tasks: 10 },
                3: { deposited: 2000000, tasks: 50 },
                4: { deposited: 5000000, tasks: 200 },
                5: { deposited: 10000000, tasks: 500 }
            };
            
            const levels = [];
            for (let level = 1; level <= 5; level++) {
                const requirement = levelRequirements[level];
                const isUnlocked = user.level >= level;
                const canUnlock = user.deposited >= requirement.deposited && 
                                  user.tasksCompleted >= requirement.tasks;
                
                levels.push({
                    level,
                    commission: commissionRates[level],
                    requirement,
                    isUnlocked,
                    canUnlock: level > user.level && canUnlock,
                    deposited: user.deposited,
                    tasksCompleted: user.tasksCompleted
                });
            }
            
            res.json({
                success: true,
                currentLevel: user.level,
                levels
            });
        } catch (error) {
            logger.error('Get level info error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get platform tasks
    async getPlatformTasks(req, res) {
        try {
            const { platform } = req.params;
            const user = await User.findById(req.userId);
            
            const platforms = {
                shopee: { name: 'Shopee', color: '#ee4d2d' },
                lazada: { name: 'Lazada', color: '#0f6cb2' },
                tiki: { name: 'Tiki', color: '#1a9431' },
                taobao: { name: 'Taobao', color: '#ff6600' }
            };
            
            if (!platforms[platform]) {
                return res.status(400).json({
                    success: false,
                    error: 'Nền tảng không hợp lệ'
                });
            }
            
            const commissionRates = {
                1: 1500,
                2: 2200,
                3: 3300,
                4: 4000,
                5: 5500
            };
            
            const tasks = [];
            for (let level = 1; level <= 5; level++) {
                const isAvailable = user.level >= level;
                
                tasks.push({
                    level,
                    platform: platforms[platform].name,
                    commission: commissionRates[level],
                    isAvailable,
                    description: `Đặt đơn ${platforms[platform].name} Free`
                });
            }
            
            res.json({
                success: true,
                platform: platforms[platform],
                tasks
            });
        } catch (error) {
            logger.error('Get platform tasks error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Complete a task
    async completeTask(req, res) {
        try {
            const { platform, level } = req.body;
            const userId = req.userId;
            
            const user = await User.findById(userId);
            
            // Check if user level is sufficient
            if (user.level < level) {
                return res.status(400).json({
                    success: false,
                    error: 'Bạn cần nâng cấp cấp độ để thực hiện nhiệm vụ này'
                });
            }
            
            // Check 24-hour cooldown for this platform and level
            const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentTask = await Task.findOne({
                user: userId,
                platform,
                level,
                status: 'completed',
                completedAt: { $gte: last24Hours }
            });
            
            if (recentTask) {
                const timeSinceCompletion = Date.now() - recentTask.completedAt.getTime();
                const minutesLeft = Math.ceil((24 * 60 * 60 * 1000 - timeSinceCompletion) / (60 * 1000));
                const hoursLeft = Math.floor(minutesLeft / 60);
                
                return res.status(400).json({
                    success: false,
                    error: `Bạn đã hoàn thành nhiệm vụ này. Vui lòng chờ ${hoursLeft} giờ ${minutesLeft % 60} phút nữa để thực hiện lại.`,
                    nextAvailable: new Date(recentTask.completedAt.getTime() + 24 * 60 * 60 * 1000)
                });
            }
            
            const commissionRates = {
                1: 1500,
                2: 2200,
                3: 3300,
                4: 4000,
                5: 5500
            };
            
            const commission = commissionRates[level];
            
            // Create task record
            const task = new Task({
                user: userId,
                platform,
                level,
                commission,
                status: 'completed',
                completedAt: new Date()
            });
            
            await task.save();
            
            // Update user commission and tasks count
            user.commission += commission;
            user.tasksCompleted += 1;
            await user.save();
            
            logger.info(`User ${user.username} completed ${platform} task at level ${level}`);
            
            res.json({
                success: true,
                message: 'Hoàn thành nhiệm vụ thành công',
                commission,
                task: {
                    id: task._id,
                    platform,
                    level,
                    commission,
                    completedAt: task.completedAt
                },
                user: {
                    commission: user.commission,
                    totalBalance: user.totalBalance,
                    tasksCompleted: user.tasksCompleted
                }
            });
        } catch (error) {
            logger.error('Complete task error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get fake activity for display
    async getFakeActivity(req, res) {
        try {
            const activity = FakeTransactionGenerator.getFakeActivity(20);
            const stats = FakeTransactionGenerator.getFakeStats();
            
            res.json({
                success: true,
                activity,
                stats
            });
        } catch (error) {
            logger.error('Get fake activity error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get dashboard stats
    async getDashboardStats(req, res) {
        try {
            const userId = req.userId;
            
            const user = await User.findById(userId);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const [
                todayTasks,
                totalDeposits,
                totalWithdraws,
                recentNotifications
            ] = await Promise.all([
                Task.countDocuments({ 
                    user: userId, 
                    completedAt: { $gte: today } 
                }),
                Deposit.aggregate([
                    { $match: { user: userId, status: 'completed' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Withdraw.aggregate([
                    { $match: { user: userId, status: 'completed' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Notification.find({ 
                    $or: [
                        { targetUsers: userId },
                        { targetUsers: { $size: 0 } }
                    ],
                    isActive: true,
                    $or: [
                        { startDate: { $exists: false } },
                        { startDate: { $lte: new Date() } }
                    ],
                    $or: [
                        { endDate: { $exists: false } },
                        { endDate: { $gte: new Date() } }
                    ]
                })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('title content type priority createdAt')
            ]);
            
            res.json({
                success: true,
                stats: {
                    totalBalance: user.totalBalance,
                    commission: user.commission,
                    deposited: user.deposited,
                    tasksCompleted: user.tasksCompleted,
                    todayTasks: todayTasks,
                    totalDeposited: totalDeposits[0]?.total || 0,
                    totalWithdrawn: totalWithdraws[0]?.total || 0,
                    level: user.level
                },
                notifications: recentNotifications,
                note: 'Bạn cần duy trì số tiền nạp tối thiểu 50K để có thể rút tiền khỏi tài khoản.'
            });
        } catch (error) {
            logger.error('Get dashboard stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }
}

module.exports = new UserController();
