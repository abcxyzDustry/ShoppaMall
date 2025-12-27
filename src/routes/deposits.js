const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const depositController = require('../controllers/depositController');
const { authenticateUser } = require('../middleware/auth');

// Create deposit request
router.post('/', authenticateUser, [
    body('amount')
        .isInt({ min: 50000 })
        .withMessage('Số tiền nạp tối thiểu là 50,000 VNĐ'),
    body('paymentMethod')
        .isIn(['bank_transfer', 'qr_code'])
        .withMessage('Phương thức thanh toán không hợp lệ')
], depositController.createDeposit);

// Get user deposits
router.get('/', authenticateUser, depositController.getUserDeposits);

// Get deposit by ID
router.get('/:id', authenticateUser, depositController.getDepositById);

// Generate QR code for deposit
router.post('/qr-code', authenticateUser, [
    body('amount')
        .isInt({ min: 50000 })
        .withMessage('Số tiền nạp tối thiểu là 50,000 VNĐ')
], depositController.generateQRCode);

// Confirm deposit payment
router.post('/:id/confirm', authenticateUser, depositController.confirmPayment);

// Cancel deposit
router.delete('/:id/cancel', authenticateUser, depositController.cancelDeposit);

// Get deposit statistics
router.get('/stats/summary', authenticateUser, depositController.getDepositStats);

module.exports = router;
