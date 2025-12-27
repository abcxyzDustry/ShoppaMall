const Withdraw = require('../models/Withdraw');
const User = require('../models/User');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

class WithdrawController {
    async createWithdraw(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { amount, bankName, accountNumber, accountHolder, branch } = req.body;
            const userId = req.userId;

            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy người dùng'
                });
            }

            const totalBalance = user.balance + user.commission;
            if (totalBalance < amount) {
                return res.status(400).json({
                    success: false,
                    error: 'Số dư không đủ để thực hiện rút tiền'
                });
            }

            if (user.deposited < 50000) {
                return res.status(400).json({
                    success: false,
                    error: 'Bạn cần nạp tối thiểu 50,000 VNĐ để có thể rút tiền'
                });
            }

            const withdraw = new Withdraw({
                user: userId,
                amount,
                bankName,
                accountNumber,
                accountHolder,
                branch,
                status: 'pending'
            });

            await withdraw.save();

            logger.info(`Withdraw created for user ${userId}, amount: ${amount}`);

            res.status(201).json({
                success: true,
                message: 'Tạo yêu cầu rút tiền thành công',
                withdraw
            });
        } catch (error) {
            logger.error('Create withdraw error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    async getUserWithdraws(req, res) {
        try {
            const { page = 1, limit = 20, status } = req.query;
            const userId = req.userId;

            let query = { user: userId };
            if (status) {
                query.status = status;
            }

            const withdraws = await Withdraw.find(query)
                .sort({ createdAt: -1 })
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
            logger.error('Get user withdraws error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    async getWithdrawById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;

            const withdraw = await Withdraw.findOne({ _id: id, user: userId });

            if (!withdraw) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy yêu cầu rút tiền'
                });
            }

            res.json({
                success: true,
                withdraw
            });
        } catch (error) {
            logger.error('Get withdraw by ID error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    async cancelWithdraw(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;

            const withdraw = await Withdraw.findOne({ _id: id, user: userId });

            if (!withdraw) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy yêu cầu rút tiền'
                });
            }

            if (withdraw.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'Chỉ có thể hủy yêu cầu đang chờ xử lý'
                });
            }

            withdraw.status = 'cancelled';
            await withdraw.save();

            res.json({
                success: true,
                message: 'Hủy yêu cầu rút tiền thành công',
                withdraw
            });
        } catch (error) {
            logger.error('Cancel withdraw error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    async getWithdrawStats(req, res) {
        try {
            const userId = req.userId;

            const [totalWithdraws, pendingWithdraws, completedWithdraws] = await Promise.all([
                Withdraw.aggregate([
                    { $match: { user: userId } },
                    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
                ]),
                Withdraw.aggregate([
                    { $match: { user: userId, status: 'pending' } },
                    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
                ]),
                Withdraw.aggregate([
                    { $match: { user: userId, status: 'completed' } },
                    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
                ])
            ]);

            res.json({
                success: true,
                stats: {
                    total: {
                        amount: totalWithdraws[0]?.total || 0,
                        count: totalWithdraws[0]?.count || 0
                    },
                    pending: {
                        amount: pendingWithdraws[0]?.total || 0,
                        count: pendingWithdraws[0]?.count || 0
                    },
                    completed: {
                        amount: completedWithdraws[0]?.total || 0,
                        count: completedWithdraws[0]?.count || 0
                    }
                }
            });
        } catch (error) {
            logger.error('Get withdraw stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    async checkEligibility(req, res) {
        try {
            const userId = req.userId;
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy người dùng'
                });
            }

            const totalBalance = user.balance + user.commission;
            const minDeposit = 50000;
            const minWithdraw = 100000;
            const maxWithdraw = 5000000;

            const isEligible = user.deposited >= minDeposit && totalBalance >= minWithdraw;

            res.json({
                success: true,
                eligibility: {
                    isEligible,
                    totalBalance,
                    deposited: user.deposited,
                    minDepositRequired: minDeposit,
                    minWithdrawAmount: minWithdraw,
                    maxWithdrawAmount: Math.min(maxWithdraw, totalBalance),
                    reasons: !isEligible ? [
                        user.deposited < minDeposit ? `Bạn cần nạp tối thiểu ${minDeposit.toLocaleString('vi-VN')} VNĐ` : null,
                        totalBalance < minWithdraw ? `Số dư tối thiểu để rút là ${minWithdraw.toLocaleString('vi-VN')} VNĐ` : null
                    ].filter(Boolean) : []
                }
            });
        } catch (error) {
            logger.error('Check eligibility error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }
}

module.exports = new WithdrawController();
