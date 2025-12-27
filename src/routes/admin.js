const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const adminController = require('../controllers/adminController');
const { authenticateAdmin, authorize, hasPermission } = require('../middleware/auth');

// Dashboard statistics
router.get('/dashboard', authenticateAdmin, adminController.getDashboardStats);

// User management
router.get('/users', authenticateAdmin, hasPermission('users'), adminController.getUsers);
router.get('/users/:id', authenticateAdmin, hasPermission('users'), adminController.getUserDetail);
router.put('/users/:id/balance', authenticateAdmin, hasPermission('users'), adminController.adjustUserBalance);
router.put('/users/:id/status', authenticateAdmin, hasPermission('users'), adminController.updateUserStatus);
router.delete('/users/:id', authenticateAdmin, hasPermission('users'), adminController.deleteUser);

// Deposit management
router.get('/deposits', authenticateAdmin, hasPermission('deposits'), adminController.getDeposits);
router.put('/deposits/:id/approve', authenticateAdmin, hasPermission('deposits'), adminController.approveDeposit);
router.put('/deposits/:id/reject', authenticateAdmin, hasPermission('deposits'), adminController.rejectDeposit);

// Withdraw management
router.get('/withdraws', authenticateAdmin, hasPermission('withdraws'), adminController.getWithdraws);
router.put('/withdraws/:id/approve', authenticateAdmin, hasPermission('withdraws'), adminController.approveWithdraw);
router.put('/withdraws/:id/reject', authenticateAdmin, hasPermission('withdraws'), adminController.rejectWithdraw);
router.put('/withdraws/:id/complete', authenticateAdmin, hasPermission('withdraws'), adminController.completeWithdraw);

// Notification management
router.post('/notifications', authenticateAdmin, hasPermission('notifications'), [
    body('title').notEmpty().withMessage('Tiêu đề không được để trống'),
    body('content').notEmpty().withMessage('Nội dung không được để trống')
], adminController.createNotification);

router.get('/notifications', authenticateAdmin, hasPermission('notifications'), adminController.getNotifications);
router.put('/notifications/:id', authenticateAdmin, hasPermission('notifications'), adminController.updateNotification);
router.delete('/notifications/:id', authenticateAdmin, hasPermission('notifications'), adminController.deleteNotification);

// Admin account management
router.get('/admins', authenticateAdmin, authorize('superadmin'), adminController.getAdmins);
router.post('/admins', authenticateAdmin, authorize('superadmin'), [
    body('username').notEmpty().withMessage('Tên đăng nhập không được để trống'),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
    body('email').isEmail().withMessage('Email không hợp lệ'),
    body('fullName').notEmpty().withMessage('Họ tên không được để trống')
], adminController.createAdmin);

router.put('/admins/:id', authenticateAdmin, authorize('superadmin'), adminController.updateAdmin);
router.delete('/admins/:id', authenticateAdmin, authorize('superadmin'), adminController.deleteAdmin);

// System settings
router.get('/settings', authenticateAdmin, hasPermission('settings'), adminController.getSettings);
router.put('/settings', authenticateAdmin, hasPermission('settings'), adminController.updateSettings);

// Reports
router.get('/reports/daily', authenticateAdmin, hasPermission('settings'), adminController.getDailyReport);
router.get('/reports/monthly', authenticateAdmin, hasPermission('settings'), adminController.getMonthlyReport);

// Search users
router.get('/search/users', authenticateAdmin, hasPermission('users'), adminController.searchUsers);

// Export data
router.get('/export/users', authenticateAdmin, hasPermission('users'), adminController.exportUsers);
router.get('/export/transactions', authenticateAdmin, hasPermission('settings'), adminController.exportTransactions);

module.exports = router;
