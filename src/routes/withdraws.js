const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const withdrawController = require('../controllers/withdrawController');
const { authenticateUser } = require('../middleware/auth');

// Create withdraw request
router.post('/', authenticateUser, [
    body('amount')
        .isInt({ min: 100000, max: 5000000 })
        .withMessage('Số tiền rút phải từ 100,000 đến 5,000,000 VNĐ'),
    body('bankName').notEmpty().withMessage('Tên ngân hàng không được để trống'),
    body('accountNumber').notEmpty().withMessage('Số tài khoản không được để trống'),
    body('accountHolder').notEmpty().withMessage('Tên chủ tài khoản không được để trống')
], withdrawController.createWithdraw);

// Get user withdraws
router.get('/', authenticateUser, withdrawController.getUserWithdraws);

// Get withdraw by ID
router.get('/:id', authenticateUser, withdrawController.getWithdrawById);

// Cancel withdraw request
router.delete('/:id/cancel', authenticateUser, withdrawController.cancelWithdraw);

// Get withdraw statistics
router.get('/stats/summary', authenticateUser, withdrawController.getWithdrawStats);

// Check withdraw eligibility
router.get('/check-eligibility', authenticateUser, withdrawController.checkEligibility);

module.exports = router;
