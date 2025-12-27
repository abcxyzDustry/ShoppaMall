const Deposit = require('../models/Deposit');
const User = require('../models/User');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const qr = require('qr-image');

class DepositController {
    async createDeposit(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { amount, paymentMethod } = req.body;
            const userId = req.userId;

            const deposit = new Deposit({
                user: userId,
                amount,
                paymentMethod,
                status: 'pending'
            });

            if (paymentMethod === 'qr_code') {
                deposit.qrCodeUrl = Deposit.generateQRCodeUrl(amount);
            }

            await deposit.save();

            logger.info(`Deposit created for user ${userId}, amount: ${amount}`);

            res.status(201).json({
                success: true,
                message: 'Tạo yêu cầu nạp tiền thành công',
                deposit
            });
        } catch (error) {
            logger.error('Create deposit error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    async getUserDeposits(req, res) {
        try {
            const { page = 1, limit = 20, status } = req.query;
            const userId = req.userId;

            let query = { user: userId };
            if (status) {
                query.status = status;
            }

            const deposits = await Deposit.find(query)
                .sort({ createdAt: -1 })
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
            logger.error('Get user deposits error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    async getDepositById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;

            const deposit = await Deposit.findOne({ _id: id, user: userId });

            if (!deposit) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy yêu cầu nạp tiền'
                });
            }

            res.json({
                success: true,
                deposit
            });
        } catch (error) {
            logger.error('Get deposit by ID error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    async generateQRCode(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { amount } = req.body;
            const qrCodeUrl = Deposit.generateQRCodeUrl(amount);

            res.json({
                success: true,
                qrCodeUrl,
                amount
            });
        } catch (error) {
            logger.error('Generate QR code error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    async confirmPayment(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;

            const deposit = await Deposit.findOne({ _id: id, user: userId });

            if (!deposit) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy yêu cầu nạp tiền'
                });
            }

            if (deposit.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'Yêu cầu nạp tiền không ở trạng thái chờ xử lý'
                });
            }

            deposit.note = 'Người dùng xác nhận đã thanh toán';
            await deposit.save();

            res.json({
                success: true,
                message: 'Xác nhận thanh toán thành công. Vui lòng chờ admin duyệt.',
                deposit
            });
        } catch (error) {
            logger.error('Confirm payment error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    async cancelDeposit(req, res) {
        try {
            const { id } = req.params;
            const userId = req.userId;

            const deposit = await Deposit.findOne({ _id: id, user: userId });

            if (!deposit) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy yêu cầu nạp tiền'
                });
            }

            if (deposit.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'Chỉ có thể hủy yêu cầu đang chờ xử lý'
                });
            }

            deposit.status = 'cancelled';
            await deposit.save();

            res.json({
                success: true,
                message: 'Hủy yêu cầu nạp tiền thành công',
                deposit
            });
        } catch (error) {
            logger.error('Cancel deposit error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    async getDepositStats(req, res) {
        try {
            const userId = req.userId;

            const [totalDeposits, pendingDeposits, completedDeposits] = await Promise.all([
                Deposit.aggregate([
                    { $match: { user: userId } },
                    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
                ]),
                Deposit.aggregate([
                    { $match: { user: userId, status: 'pending' } },
                    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
                ]),
                Deposit.aggregate([
                    { $match: { user: userId, status: 'completed' } },
                    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
                ])
            ]);

            res.json({
                success: true,
                stats: {
                    total: {
                        amount: totalDeposits[0]?.total || 0,
                        count: totalDeposits[0]?.count || 0
                    },
                    pending: {
                        amount: pendingDeposits[0]?.total || 0,
                        count: pendingDeposits[0]?.count || 0
                    },
                    completed: {
                        amount: completedDeposits[0]?.total || 0,
                        count: completedDeposits[0]?.count || 0
                    }
                }
            });
        } catch (error) {
            logger.error('Get deposit stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }
}

module.exports = new DepositController();
