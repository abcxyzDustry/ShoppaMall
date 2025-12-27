const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticateUser } = require('../middleware/auth');

// Get user profile
router.get('/profile', authenticateUser, userController.getProfile);

// Update user profile
router.put('/profile', authenticateUser, [
    body('email').optional().isEmail().withMessage('Email không hợp lệ'),
    body('phone').optional().isMobilePhone('vi-VN').withMessage('Số điện thoại không hợp lệ'),
    body('fullName').optional().trim().escape()
], userController.updateProfile);

// Update bank information
router.put('/bank-info', authenticateUser, [
    body('bankName').notEmpty().withMessage('Tên ngân hàng không được để trống'),
    body('accountNumber').notEmpty().withMessage('Số tài khoản không được để trống'),
    body('accountHolder').notEmpty().withMessage('Tên chủ tài khoản không được để trống')
], userController.updateBankInfo);

// Get user statistics
router.get('/stats', authenticateUser, userController.getUserStats);

// Get user transactions
router.get('/transactions', authenticateUser, userController.getTransactions);

// Get referral information
router.get('/referral', authenticateUser, userController.getReferralInfo);

// Change password
router.put('/change-password', authenticateUser, [
    body('currentPassword').notEmpty().withMessage('Mật khẩu hiện tại không được để trống'),
    body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới phải có ít nhất 6 ký tự'),
    body('confirmPassword').custom((value, { req }) => value === req.body.newPassword)
        .withMessage('Mật khẩu xác nhận không khớp')
], userController.changePassword);

// Get user level information
router.get('/levels', authenticateUser, userController.getLevelInfo);

// Get platform tasks
router.get('/platforms/:platform/tasks', authenticateUser, userController.getPlatformTasks);

// Complete a task
router.post('/tasks/complete', authenticateUser, [
    body('platform').notEmpty().withMessage('Nền tảng không được để trống'),
    body('level').isInt({ min: 1, max: 5 }).withMessage('Cấp độ không hợp lệ')
], userController.completeTask);

// Get fake activity (for frontend display)
router.get('/fake-activity', authenticateUser, userController.getFakeActivity);

// Get dashboard stats
router.get('/dashboard', authenticateUser, userController.getDashboardStats);

module.exports = router;
