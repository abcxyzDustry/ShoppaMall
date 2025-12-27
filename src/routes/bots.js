const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const botController = require('../controllers/botController');
const { authenticateAdmin, hasPermission } = require('../middleware/auth');

// Get bot status and settings
router.get('/status', authenticateAdmin, hasPermission('bots'), botController.getBotStatus);

// Update bot settings
router.put('/settings', authenticateAdmin, hasPermission('bots'), [
    body('frequency').optional().isInt({ min: 5, max: 60 }),
    body('transactionCount').optional().isInt({ min: 10, max: 1000 }),
    body('maxAmount').optional().isInt({ min: 100000, max: 100000000 })
], botController.updateBotSettings);

// Toggle bot
router.put('/toggle/:type', authenticateAdmin, hasPermission('bots'), botController.toggleBot);

// Generate fake users
router.post('/generate-users', authenticateAdmin, hasPermission('bots'), [
    body('count').optional().isInt({ min: 1, max: 100 })
], botController.generateFakeUsers);

// Generate fake transactions
router.post('/generate-transactions', authenticateAdmin, hasPermission('bots'), [
    body('count').optional().isInt({ min: 1, max: 1000 })
], botController.generateFakeTransactions);

// Clear bot data
router.delete('/clear-data', authenticateAdmin, hasPermission('bots'), botController.clearBotData);

// Get bot logs
router.get('/logs', authenticateAdmin, hasPermission('bots'), botController.getBotLogs);

// Clear bot logs
router.delete('/logs', authenticateAdmin, hasPermission('bots'), botController.clearBotLogs);

// Get fake activity for display
router.get('/fake-activity', authenticateAdmin, hasPermission('bots'), botController.getFakeActivity);

// Get bot statistics
router.get('/stats', authenticateAdmin, hasPermission('bots'), botController.getBotStats);

// Start/stop all bots
router.put('/control/all', authenticateAdmin, hasPermission('bots'), botController.controlAllBots);

// Simulate single transaction
router.post('/simulate-transaction', authenticateAdmin, hasPermission('bots'), botController.simulateTransaction);

module.exports = router;
