const User = require('../models/User');
const Admin = require('../models/Admin');
const Deposit = require('../models/Deposit');
const Withdraw = require('../models/Withdraw');
const Notification = require('../models/Notification');
const Task = require('../models/Task');
const BotSettings = require('../models/BotSettings');
const logger = require('../utils/logger');

class AdminController {
    // Get dashboard statistics
    async getDashboardStats(req, res) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const [
                totalUsers,
                totalDeposits,
                totalWithdraws,
                pendingDeposits,
                pendingWithdraws,
                todayRevenue,
                recentActivity
            ] = await Promise.all([
                User.countDocuments(),
                Deposit.aggregate([
                    { $match: { status: 'completed' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Withdraw.aggregate([
                    { $match: { status: 'completed' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Deposit.countDocuments({ status: 'pending' }),
                Withdraw.countDocuments({ status: 'pending' }),
                Deposit.aggregate([
                    { 
                        $match: { 
                            status: 'completed',
                            createdAt: { $gte: today }
                        }
                    },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                // Recent activity (last 10 transactions)
                Promise.all([
                    Deposit.find()
                        .populate('user', 'username')
                        .sort({ createdAt: -1 })
                        .limit(5),
                    Withdraw.find()
                        .populate('user', 'username')
                        .sort({ createdAt: -1 })
                        .limit(5)
                ]).then(([deposits, withdraws]) => {
                    return [
                        ...deposits.map(d => ({ ...d.toObject(), type: 'deposit' })),
                        ...withdraws.map(w => ({ ...w.toObject(), type: 'withdraw' }))
                    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                     .slice(0, 10);
                })
            ]);
            
            res.json({
                success: true,
                stats: {
                    totalUsers,
                    totalSystemBalance: totalDeposits[0]?.total || 0,
                    pendingRequests: pendingDeposits + pendingWithdraws,
                    todayRevenue: todayRevenue[0]?.total || 0,
                    totalWithdrawn: totalWithdraws[0]?.total || 0
                },
                recentActivity
            });
        } catch (error) {
            logger.error('Get dashboard stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get users with pagination
    async getUsers(req, res) {
        try {
            const { page = 1, limit = 20, search = '', sort = '-createdAt' } = req.query;
            
            let query = {};
            
            if (search) {
                query = {
                    $or: [
                        { username: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } },
                        { phone: { $regex: search, $options: 'i' } },
                        { fullName: { $regex: search, $options: 'i' } }
                    ]
                };
            }
            
            const users = await User.find(query)
                .select('-password -__v')
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(parseInt(limit));
            
            const total = await User.countDocuments(query);
            
            res.json({
                success: true,
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            logger.error('Get users error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get user detail
    async getUserDetail(req, res) {
        try {
            const { id } = req.params;
            
            const user = await User.findById(id)
                .select('-password -__v');
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Người dùng không tồn tại'
                });
            }
            
            // Get user transactions
            const [deposits, withdraws, tasks] = await Promise.all([
                Deposit.find({ user: id }).sort({ createdAt: -1 }).limit(10),
                Withdraw.find({ user: id }).sort({ createdAt: -1 }).limit(10),
                Task.find({ user: id }).sort({ createdAt: -1 }).limit(10)
            ]);
            
            res.json({
                success: true,
                user,
                transactions: {
                    deposits,
                    withdraws,
                    tasks
                }
            });
        } catch (error) {
            logger.error('Get user detail error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Adjust user balance
    async adjustUserBalance(req, res) {
        try {
            const { id } = req.params;
            const { amount, type, note } = req.body;
            
            if (!amount || !type) {
                return res.status(400).json({
                    success: false,
                    error: 'Thiếu thông tin số tiền hoặc loại điều chỉnh'
                });
            }
            
            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Người dùng không tồn tại'
                });
            }
            
            const admin = await Admin.findById(req.adminId);
            
            if (type === 'add_balance') {
                user.balance += parseFloat(amount);
            } else if (type === 'subtract_balance') {
                if (user.balance < amount) {
                    return res.status(400).json({
                        success: false,
                        error: 'Số dư không đủ để trừ'
                    });
                }
                user.balance -= parseFloat(amount);
            } else if (type === 'add_commission') {
                user.commission += parseFloat(amount);
            } else if (type === 'subtract_commission') {
                if (user.commission < amount) {
                    return res.status(400).json({
                        success: false,
                        error: 'Hoa hồng không đủ để trừ'
                    });
                }
                user.commission -= parseFloat(amount);
            } else if (type === 'set_balance') {
                user.balance = parseFloat(amount);
            } else if (type === 'set_commission') {
                user.commission = parseFloat(amount);
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Loại điều chỉnh không hợp lệ'
                });
            }
            
            await user.save();
            
            logger.info(`Admin ${admin.username} adjusted balance for user ${user.username}: ${type} ${amount}`);
            
            res.json({
                success: true,
                message: 'Điều chỉnh số dư thành công',
                user: {
                    id: user._id,
                    username: user.username,
                    balance: user.balance,
                    commission: user.commission,
                    totalBalance: user.totalBalance
                }
            });
        } catch (error) {
            logger.error('Adjust user balance error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Update user status
    async updateUserStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, reason } = req.body;
            
            const validStatuses = ['active', 'suspended', 'banned', 'pending'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Trạng thái không hợp lệ'
                });
            }
            
            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Người dùng không tồn tại'
                });
            }
            
            const admin = await Admin.findById(req.adminId);
            const oldStatus = user.status;
            
            user.status = status;
            user.metadata.statusChange = {
                oldStatus,
                newStatus: status,
                changedBy: admin._id,
                changedAt: new Date(),
                reason
            };
            
            await user.save();
            
            logger.info(`Admin ${admin.username} changed user ${user.username} status from ${oldStatus} to ${status}`);
            
            res.json({
                success: true,
                message: 'Cập nhật trạng thái thành công',
                user: {
                    id: user._id,
                    username: user.username,
                    status: user.status
                }
            });
        } catch (error) {
            logger.error('Update user status error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Delete user
    async deleteUser(req, res) {
        try {
            const { id } = req.params;
            
            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Người dùng không tồn tại'
                });
            }
            
            // Check if user has active transactions
            const [activeDeposits, activeWithdraws] = await Promise.all([
                Deposit.countDocuments({ user: id, status: 'pending' }),
                Withdraw.countDocuments({ user: id, status: 'pending' })
            ]);
            
            if (activeDeposits > 0 || activeWithdraws > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Không thể xoá người dùng có giao dịch đang chờ xử lý'
                });
            }
            
            // Soft delete by changing status
            user.status = 'banned';
            user.metadata.deleted = {
                deletedBy: req.adminId,
                deletedAt: new Date(),
                reason: 'Admin deleted'
            };
            
            await user.save();
            
            logger.info(`Admin deleted user ${user.username}`);
            
            res.json({
                success: true,
                message: 'Đã khoá tài khoản người dùng'
            });
        } catch (error) {
            logger.error('Delete user error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get deposits with filters
    async getDeposits(req, res) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status, 
                startDate, 
                endDate,
                sort = '-createdAt'
            } = req.query;
            
            let query = {};
            
            if (status) {
                query.status = status;
            }
            
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) {
                    query.createdAt.$gte = new Date(startDate);
                }
                if (endDate) {
                    query.createdAt.$lte = new Date(endDate);
                }
            }
            
            const deposits = await Deposit.find(query)
                .populate('user', 'username')
                .populate('approvedBy', 'username')
                .populate('rejectedBy', 'username')
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(parseInt(limit));
            
            const total = await Deposit.countDocuments(query);
            
            res.json({
                success: true,
                deposits,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            logger.error('Get deposits error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Approve deposit
    async approveDeposit(req, res) {
        try {
            const { id } = req.params;
            const { note } = req.body;
            
            const deposit = await Deposit.findById(id).populate('user');
            if (!deposit) {
                return res.status(404).json({
                    success: false,
                    error: 'Giao dịch nạp tiền không tồn tại'
                });
            }
            
            if (deposit.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'Giao dịch không ở trạng thái chờ duyệt'
                });
            }
            
            const admin = await Admin.findById(req.adminId);
            
            // Update deposit status
            deposit.status = 'completed';
            deposit.approvedAt = new Date();
            deposit.approvedBy = admin._id;
            if (note) deposit.note = note;
            
            // Update user balance
            const user = deposit.user;
            user.balance += deposit.amount;
            user.deposited += deposit.amount;
            
            await Promise.all([
                deposit.save(),
                user.save()
            ]);
            
            logger.info(`Admin ${admin.username} approved deposit ${id} for user ${user.username}`);
            
            res.json({
                success: true,
                message: 'Duyệt nạp tiền thành công',
                deposit
            });
        } catch (error) {
            logger.error('Approve deposit error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Reject deposit
    async rejectDeposit(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            
            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Vui lòng nhập lý do từ chối'
                });
            }
            
            const deposit = await Deposit.findById(id);
            if (!deposit) {
                return res.status(404).json({
                    success: false,
                    error: 'Giao dịch nạp tiền không tồn tại'
                });
            }
            
            if (deposit.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'Giao dịch không ở trạng thái chờ duyệt'
                });
            }
            
            const admin = await Admin.findById(req.adminId);
            
            deposit.status = 'failed';
            deposit.rejectedAt = new Date();
            deposit.rejectedBy = admin._id;
            deposit.rejectionReason = reason;
            
            await deposit.save();
            
            logger.info(`Admin ${admin.username} rejected deposit ${id}`);
            
            res.json({
                success: true,
                message: 'Từ chối nạp tiền thành công',
                deposit
            });
        } catch (error) {
            logger.error('Reject deposit error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get withdraws with filters
    async getWithdraws(req, res) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status, 
                startDate, 
                endDate,
                sort = '-createdAt'
            } = req.query;
            
            let query = {};
            
            if (status) {
                query.status = status;
            }
            
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) {
                    query.createdAt.$gte = new Date(startDate);
                }
                if (endDate) {
                    query.createdAt.$lte = new Date(endDate);
                }
            }
            
            const withdraws = await Withdraw.find(query)
                .populate('user', 'username')
                .populate('approvedBy', 'username')
                .populate('processedBy', 'username')
                .populate('rejectedBy', 'username')
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(parseInt(limit));
            
            const total = await Withdraw.countDocuments(query);
            
            res.json({
                success: true,
                withdraws,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            logger.error('Get withdraws error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Approve withdraw
    async approveWithdraw(req, res) {
        try {
            const { id } = req.params;
            
            const withdraw = await Withdraw.findById(id).populate('user');
            if (!withdraw) {
                return res.status(404).json({
                    success: false,
                    error: 'Giao dịch rút tiền không tồn tại'
                });
            }
            
            if (withdraw.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'Giao dịch không ở trạng thái chờ duyệt'
                });
            }
            
            const admin = await Admin.findById(req.adminId);
            
            withdraw.status = 'processing';
            withdraw.approvedAt = new Date();
            withdraw.approvedBy = admin._id;
            
            await withdraw.save();
            
            logger.info(`Admin ${admin.username} approved withdraw ${id} for processing`);
            
            res.json({
                success: true,
                message: 'Duyệt rút tiền thành công',
                withdraw
            });
        } catch (error) {
            logger.error('Approve withdraw error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Reject withdraw
    async rejectWithdraw(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            
            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Vui lòng nhập lý do từ chối'
                });
            }
            
            const withdraw = await Withdraw.findById(id).populate('user');
            if (!withdraw) {
                return res.status(404).json({
                    success: false,
                    error: 'Giao dịch rút tiền không tồn tại'
                });
            }
            
            if (withdraw.status !== 'pending' && withdraw.status !== 'processing') {
                return res.status(400).json({
                    success: false,
                    error: 'Giao dịch không thể bị từ chối'
                });
            }
            
            const admin = await Admin.findById(req.adminId);
            
            withdraw.status = 'failed';
            withdraw.rejectedAt = new Date();
            withdraw.rejectedBy = admin._id;
            withdraw.rejectionReason = reason;
            
            // Refund user balance
            const user = withdraw.user;
            if (withdraw.amount <= user.commission) {
                user.commission += withdraw.amount;
            } else {
                const remaining = withdraw.amount - user.commission;
                user.commission = 0;
                user.balance += remaining;
            }
            
            await Promise.all([
                withdraw.save(),
                user.save()
            ]);
            
            logger.info(`Admin ${admin.username} rejected withdraw ${id}`);
            
            res.json({
                success: true,
                message: 'Từ chối rút tiền thành công. Tiền đã được hoàn lại cho người dùng.',
                withdraw
            });
        } catch (error) {
            logger.error('Reject withdraw error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Complete withdraw (mark as transferred)
    async completeWithdraw(req, res) {
        try {
            const { id } = req.params;
            const { transactionId } = req.body;
            
            const withdraw = await Withdraw.findById(id);
            if (!withdraw) {
                return res.status(404).json({
                    success: false,
                    error: 'Giao dịch rút tiền không tồn tại'
                });
            }
            
            if (withdraw.status !== 'processing') {
                return res.status(400).json({
                    success: false,
                    error: 'Giao dịch không ở trạng thái đang xử lý'
                });
            }
            
            const admin = await Admin.findById(req.adminId);
            
            withdraw.status = 'completed';
            withdraw.completedAt = new Date();
            withdraw.processedBy = admin._id;
            if (transactionId) withdraw.transactionId = transactionId;
            
            await withdraw.save();
            
            logger.info(`Admin ${admin.username} completed withdraw ${id}`);
            
            res.json({
                success: true,
                message: 'Hoàn tất rút tiền thành công',
                withdraw
            });
        } catch (error) {
            logger.error('Complete withdraw error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Create notification
    async createNotification(req, res) {
        try {
            const { title, content, type, priority, targetUsers, startDate, endDate } = req.body;
            
            const admin = await Admin.findById(req.adminId);
            
            const notification = new Notification({
                title,
                content,
                type: type || 'general',
                priority: priority || 'medium',
                targetUsers: targetUsers || [],
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                createdBy: admin._id,
                isActive: true
            });
            
            await notification.save();
            
            logger.info(`Admin ${admin.username} created notification: ${title}`);
            
            res.status(201).json({
                success: true,
                message: 'Tạo thông báo thành công',
                notification
            });
        } catch (error) {
            logger.error('Create notification error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get notifications
    async getNotifications(req, res) {
        try {
            const { page = 1, limit = 20, isActive, type } = req.query;
            
            let query = {};
            
            if (isActive !== undefined) {
                query.isActive = isActive === 'true';
            }
            
            if (type) {
                query.type = type;
            }
            
            const notifications = await Notification.find(query)
                .populate('createdBy', 'username')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit));
            
            const total = await Notification.countDocuments(query);
            
            res.json({
                success: true,
                notifications,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            logger.error('Get notifications error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Update notification
    async updateNotification(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            const notification = await Notification.findById(id);
            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'Thông báo không tồn tại'
                });
            }
            
            // Update fields
            Object.keys(updates).forEach(key => {
                if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt') {
                    notification[key] = updates[key];
                }
            });
            
            await notification.save();
            
            res.json({
                success: true,
                message: 'Cập nhật thông báo thành công',
                notification
            });
        } catch (error) {
            logger.error('Update notification error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Delete notification
    async deleteNotification(req, res) {
        try {
            const { id } = req.params;
            
            const notification = await Notification.findById(id);
            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'Thông báo không tồn tại'
                });
            }
            
            await notification.deleteOne();
            
            res.json({
                success: true,
                message: 'Xoá thông báo thành công'
            });
        } catch (error) {
            logger.error('Delete notification error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get admins
    async getAdmins(req, res) {
        try {
            const admins = await Admin.find()
                .select('-password -__v')
                .sort({ createdAt: -1 });
            
            res.json({
                success: true,
                admins
            });
        } catch (error) {
            logger.error('Get admins error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Create admin
    async createAdmin(req, res) {
        try {
            const { username, password, email, fullName, role, permissions } = req.body;
            
            // Check if admin exists
            const existingAdmin = await Admin.findOne({
                $or: [{ username }, { email }]
            });
            
            if (existingAdmin) {
                return res.status(400).json({
                    success: false,
                    error: 'Tên đăng nhập hoặc email đã tồn tại'
                });
            }
            
            const createdBy = await Admin.findById(req.adminId);
            
            const admin = new Admin({
                username,
                password,
                email,
                fullName,
                role: role || 'admin',
                permissions: permissions || {
                    users: true,
                    deposits: true,
                    withdraws: true,
                    notifications: true,
                    bots: true,
                    settings: true
                },
                createdBy: createdBy._id,
                isActive: true
            });
            
            await admin.save();
            
            logger.info(`Admin ${createdBy.username} created new admin: ${username}`);
            
            res.status(201).json({
                success: true,
                message: 'Tạo tài khoản admin thành công',
                admin: {
                    id: admin._id,
                    username: admin.username,
                    email: admin.email,
                    fullName: admin.fullName,
                    role: admin.role
                }
            });
        } catch (error) {
            logger.error('Create admin error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Update admin
    async updateAdmin(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            // Don't allow self-update of role or status if not superadmin
            if (id === req.adminId && updates.role && updates.role !== 'superadmin') {
                const currentAdmin = await Admin.findById(req.adminId);
                if (currentAdmin.role === 'superadmin') {
                    return res.status(403).json({
                        success: false,
                        error: 'Không thể thay đổi vai trò của chính mình'
                    });
                }
            }
            
            const admin = await Admin.findById(id);
            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: 'Admin không tồn tại'
                });
            }
            
            // Update fields
            Object.keys(updates).forEach(key => {
                if (key !== '_id' && key !== 'password') {
                    admin[key] = updates[key];
                }
            });
            
            // Update password if provided
            if (updates.password) {
                admin.password = updates.password;
            }
            
            await admin.save();
            
            res.json({
                success: true,
                message: 'Cập nhật admin thành công',
                admin: {
                    id: admin._id,
                    username: admin.username,
                    email: admin.email,
                    fullName: admin.fullName,
                    role: admin.role,
                    isActive: admin.isActive
                }
            });
        } catch (error) {
            logger.error('Update admin error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Delete admin
    async deleteAdmin(req, res) {
        try {
            const { id } = req.params;
            
            // Don't allow self-delete
            if (id === req.adminId) {
                return res.status(400).json({
                    success: false,
                    error: 'Không thể xoá chính mình'
                });
            }
            
            const admin = await Admin.findById(id);
            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: 'Admin không tồn tại'
                });
            }
            
            await admin.deleteOne();
            
            logger.info(`Admin ${req.adminId} deleted admin ${id}`);
            
            res.json({
                success: true,
                message: 'Xoá admin thành công'
            });
        } catch (error) {
            logger.error('Delete admin error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get system settings
    async getSettings(req, res) {
        try {
            const settings = {
                commissionRates: {
                    1: 1500,
                    2: 2200,
                    3: 3300,
                    4: 4000,
                    5: 5500
                },
                withdrawLimits: {
                    min: 100000,
                    max: 5000000
                },
                depositLimits: {
                    min: 50000
                },
                minimumBalanceForWithdraw: 50000,
                qrCode: {
                    bank: 'VIB',
                    account: '068394585',
                    template: 'compact'
                }
            };
            
            res.json({
                success: true,
                settings
            });
        } catch (error) {
            logger.error('Get settings error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Update system settings
    async updateSettings(req, res) {
        try {
            // In a real application, you would save these to a database
            // For now, we'll just return success
            
            res.json({
                success: true,
                message: 'Cập nhật cài đặt thành công'
            });
        } catch (error) {
            logger.error('Update settings error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get daily report
    async getDailyReport(req, res) {
        try {
            const { date } = req.query;
            const targetDate = date ? new Date(date) : new Date();
            targetDate.setHours(0, 0, 0, 0);
            
            const nextDay = new Date(targetDate);
            nextDay.setDate(nextDay.getDate() + 1);
            
            const [
                newUsers,
                deposits,
                withdraws,
                tasks
            ] = await Promise.all([
                User.countDocuments({
                    createdAt: { $gte: targetDate, $lt: nextDay }
                }),
                Deposit.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: targetDate, $lt: nextDay },
                            status: 'completed'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            count: { $sum: 1 },
                            total: { $sum: '$amount' }
                        }
                    }
                ]),
                Withdraw.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: targetDate, $lt: nextDay },
                            status: 'completed'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            count: { $sum: 1 },
                            total: { $sum: '$amount' }
                        }
                    }
                ]),
                Task.countDocuments({
                    completedAt: { $gte: targetDate, $lt: nextDay },
                    status: 'completed'
                })
            ]);
            
            res.json({
                success: true,
                date: targetDate.toISOString().split('T')[0],
                report: {
                    newUsers: newUsers,
                    deposits: {
                        count: deposits[0]?.count || 0,
                        total: deposits[0]?.total || 0
                    },
                    withdraws: {
                        count: withdraws[0]?.count || 0,
                        total: withdraws[0]?.total || 0
                    },
                    tasks: tasks
                }
            });
        } catch (error) {
            logger.error('Get daily report error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get monthly report
    async getMonthlyReport(req, res) {
        try {
            const { year, month } = req.query;
            const targetYear = parseInt(year) || new Date().getFullYear();
            const targetMonth = parseInt(month) || new Date().getMonth() + 1;
            
            const startDate = new Date(targetYear, targetMonth - 1, 1);
            const endDate = new Date(targetYear, targetMonth, 0);
            endDate.setHours(23, 59, 59, 999);
            
            const [
                newUsers,
                deposits,
                withdraws,
                tasks,
                dailyStats
            ] = await Promise.all([
                User.countDocuments({
                    createdAt: { $gte: startDate, $lte: endDate }
                }),
                Deposit.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: startDate, $lte: endDate },
                            status: 'completed'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            count: { $sum: 1 },
                            total: { $sum: '$amount' }
                        }
                    }
                ]),
                Withdraw.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: startDate, $lte: endDate },
                            status: 'completed'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            count: { $sum: 1 },
                            total: { $sum: '$amount' }
                        }
                    }
                ]),
                Task.countDocuments({
                    completedAt: { $gte: startDate, $lte: endDate },
                    status: 'completed'
                }),
                Deposit.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: startDate, $lte: endDate },
                            status: 'completed'
                        }
                    },
                    {
                        $group: {
                            _id: { $dayOfMonth: '$createdAt' },
                            count: { $sum: 1 },
                            total: { $sum: '$amount' }
                        }
                    },
                    { $sort: { '_id': 1 } }
                ])
            ]);
            
            res.json({
                success: true,
                period: `${targetMonth}/${targetYear}`,
                report: {
                    newUsers: newUsers,
                    deposits: {
                        count: deposits[0]?.count || 0,
                        total: deposits[0]?.total || 0
                    },
                    withdraws: {
                        count: withdraws[0]?.count || 0,
                        total: withdraws[0]?.total || 0
                    },
                    tasks: tasks,
                    dailyStats: dailyStats
                }
            });
        } catch (error) {
            logger.error('Get monthly report error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Search users
    async searchUsers(req, res) {
        try {
            const { q } = req.query;
            
            if (!q || q.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Vui lòng nhập ít nhất 2 ký tự để tìm kiếm'
                });
            }
            
            const users = await User.find({
                $or: [
                    { username: { $regex: q, $options: 'i' } },
                    { email: { $regex: q, $options: 'i' } },
                    { phone: { $regex: q, $options: 'i' } },
                    { fullName: { $regex: q, $options: 'i' } },
                    { referralCode: { $regex: q, $options: 'i' } }
                ]
            })
            .select('username email phone fullName level balance commission deposited status createdAt')
            .limit(20);
            
            res.json({
                success: true,
                users
            });
        } catch (error) {
            logger.error('Search users error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Export users
    async exportUsers(req, res) {
        try {
            const users = await User.find()
                .select('-password -__v -metadata')
                .sort({ createdAt: -1 });
            
            // Convert to CSV format
            const csvData = users.map(user => ({
                'ID': user._id,
                'Username': user.username,
                'Email': user.email,
                'Phone': user.phone,
                'Full Name': user.fullName,
                'Level': user.level,
                'Balance': user.balance,
                'Commission': user.commission,
                'Deposited': user.deposited,
                'Tasks Completed': user.tasksCompleted,
                'Status': user.status,
                'Created At': user.createdAt
            }));
            
            res.json({
                success: true,
                count: users.length,
                data: csvData
            });
        } catch (error) {
            logger.error('Export users error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Export transactions
    async exportTransactions(req, res) {
        try {
            const { type, startDate, endDate } = req.query;
            
            let query = {};
            
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) {
                    query.createdAt.$gte = new Date(startDate);
                }
                if (endDate) {
                    query.createdAt.$lte = new Date(endDate);
                }
            }
            
            let data;
            
            if (!type || type === 'deposit') {
                const deposits = await Deposit.find(query)
                    .populate('user', 'username')
                    .sort({ createdAt: -1 });
                
                data = deposits.map(deposit => ({
                    'Type': 'Deposit',
                    'ID': deposit._id,
                    'User': deposit.user?.username || 'N/A',
                    'Amount': deposit.amount,
                    'Status': deposit.status,
                    'Payment Method': deposit.paymentMethod,
                    'Created At': deposit.createdAt,
                    'Approved At': deposit.approvedAt
                }));
            } else if (type === 'withdraw') {
                const withdraws = await Withdraw.find(query)
                    .populate('user', 'username')
                    .sort({ createdAt: -1 });
                
                data = withdraws.map(withdraw => ({
                    'Type': 'Withdraw',
                    'ID': withdraw._id,
                    'User': withdraw.user?.username || 'N/A',
                    'Amount': withdraw.amount,
                    'Bank': withdraw.bankName,
                    'Account Number': withdraw.accountNumber,
                    'Status': withdraw.status,
                    'Created At': withdraw.createdAt,
                    'Completed At': withdraw.completedAt
                }));
            }
            
            res.json({
                success: true,
                count: data.length,
                data
            });
        } catch (error) {
            logger.error('Export transactions error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }
}

module.exports = new AdminController();
