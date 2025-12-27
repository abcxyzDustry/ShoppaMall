const BotSettings = require('../models/BotSettings');
const User = require('../models/User');
const Deposit = require('../models/Deposit');
const Withdraw = require('../models/Withdraw');
const Task = require('../models/Task');
const FakeTransactionGenerator = require('../utils/fakeTransactions');
const logger = require('../utils/logger');

class BotController {
    // Get bot status and settings
    async getBotStatus(req, res) {
        try {
            const botSettings = await BotSettings.getSettings();
            
            res.json({
                success: true,
                settings: botSettings
            });
        } catch (error) {
            logger.error('Get bot status error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Update bot settings
    async updateBotSettings(req, res) {
        try {
            const { frequency, transactionCount, maxAmount } = req.body;
            
            const botSettings = await BotSettings.getSettings();
            
            if (frequency !== undefined) {
                botSettings.frequency = frequency;
            }
            
            if (transactionCount !== undefined) {
                botSettings.transactionCount = transactionCount;
            }
            
            if (maxAmount !== undefined) {
                botSettings.maxAmount = maxAmount;
            }
            
            await botSettings.save();
            
            res.json({
                success: true,
                message: 'Cập nhật cài đặt bot thành công',
                settings: botSettings
            });
        } catch (error) {
            logger.error('Update bot settings error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Toggle bot
    async toggleBot(req, res) {
        try {
            const { type } = req.params;
            const { enabled } = req.body;
            
            const validTypes = ['withdraw', 'task', 'notification'];
            if (!validTypes.includes(type)) {
                return res.status(400).json({
                    success: false,
                    error: 'Loại bot không hợp lệ'
                });
            }
            
            const botSettings = await BotSettings.getSettings();
            botSettings.status[type] = enabled !== undefined ? enabled : !botSettings.status[type];
            
            await botSettings.save();
            
            // Add log
            await botSettings.addLog(
                `Đã ${botSettings.status[type] ? 'bật' : 'tắt'} bot ${type}`,
                botSettings.status[type] ? 'success' : 'warning'
            );
            
            res.json({
                success: true,
                message: `Đã ${botSettings.status[type] ? 'bật' : 'tắt'} bot ${type}`,
                status: botSettings.status[type]
            });
        } catch (error) {
            logger.error('Toggle bot error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Generate fake users
    async generateFakeUsers(req, res) {
        try {
            const { count = 10 } = req.body;
            
            const botSettings = await BotSettings.getSettings();
            const fakeUsers = await FakeTransactionGenerator.createFakeUsers(count);
            
            // Update stats
            await botSettings.updateStats('withdraw', 0);
            
            // Add log
            await botSettings.addLog(
                `Đã tạo ${fakeUsers.length} người dùng ảo`,
                'success',
                { count: fakeUsers.length }
            );
            
            res.json({
                success: true,
                message: `Đã tạo ${fakeUsers.length} người dùng ảo`,
                users: fakeUsers
            });
        } catch (error) {
            logger.error('Generate fake users error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Generate fake transactions
    async generateFakeTransactions(req, res) {
        try {
            const { count = 100 } = req.body;
            
            const botSettings = await BotSettings.getSettings();
            
            // Get random users
            const users = await User.aggregate([{ $sample: { size: 10 } }]);
            
            if (users.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Không có người dùng để tạo giao dịch ảo'
                });
            }
            
            const transactions = await FakeTransactionGenerator.createFakeTransactions(users, Math.ceil(count / users.length));
            
            // Update stats
            const totalAmount = transactions.reduce((sum, t) => sum + (t.data.amount || 0), 0);
            await botSettings.updateStats('withdraw', totalAmount);
            
            // Update last run
            botSettings.lastRun = new Date();
            botSettings.nextRun = new Date(Date.now() + botSettings.frequency * 1000);
            await botSettings.save();
            
            // Add log
            await botSettings.addLog(
                `Đã tạo ${transactions.length} giao dịch ảo`,
                'success',
                { count: transactions.length, totalAmount }
            );
            
            res.json({
                success: true,
                message: `Đã tạo ${transactions.length} giao dịch ảo`,
                transactions: transactions.slice(0, 20) // Return only first 20 for preview
            });
        } catch (error) {
            logger.error('Generate fake transactions error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Clear bot data
    async clearBotData(req, res) {
        try {
            const { type } = req.query;
            
            if (type === 'users') {
                // Delete fake users (users created by bot)
                await User.deleteMany({ 
                    username: { $regex: /^user_\d+_\d+$/ } 
                });
                
                res.json({
                    success: true,
                    message: 'Đã xoá tất cả người dùng ảo'
                });
            } else if (type === 'transactions') {
                // Delete fake transactions
                await Promise.all([
                    Deposit.deleteMany({ note: 'Deposit từ tài khoản ảo' }),
                    Withdraw.deleteMany({ note: 'Rút tiền từ tài khoản ảo' }),
                    Task.deleteMany({ 'metadata.isFake': true })
                ]);
                
                res.json({
                    success: true,
                    message: 'Đã xoá tất cả giao dịch ảo'
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Loại dữ liệu không hợp lệ'
                });
            }
        } catch (error) {
            logger.error('Clear bot data error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Get bot logs
    async getBotLogs(req, res) {
        try {
            const botSettings = await BotSettings.getSettings();
            
            res.json({
                success: true,
                logs: botSettings.logs
            });
        } catch (error) {
            logger.error('Get bot logs error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Clear bot logs
    async clearBotLogs(req, res) {
        try {
            const botSettings = await BotSettings.getSettings();
            botSettings.logs = [];
            await botSettings.save();
            
            res.json({
                success: true,
                message: 'Đã xoá nhật ký bot'
            });
        } catch (error) {
            logger.error('Clear bot logs error:', error);
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

    // Get bot statistics
    async getBotStats(req, res) {
        try {
            const botSettings = await BotSettings.getSettings();
            
            // Get additional stats from database
            const [fakeUsers, fakeDeposits, fakeWithdraws, fakeTasks] = await Promise.all([
                User.countDocuments({ username: { $regex: /^user_\d+_\d+$/ } }),
                Deposit.countDocuments({ note: 'Deposit từ tài khoản ảo' }),
                Withdraw.countDocuments({ note: 'Rút tiền từ tài khoản ảo' }),
                Task.countDocuments({ 'metadata.isFake': true })
            ]);
            
            res.json({
                success: true,
                stats: {
                    fakeUsers,
                    fakeDeposits,
                    fakeWithdraws,
                    fakeTasks,
                    botStats: botSettings.stats
                }
            });
        } catch (error) {
            logger.error('Get bot stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Start/stop all bots
    async controlAllBots(req, res) {
        try {
            const { action } = req.body; // 'start' or 'stop'
            
            const botSettings = await BotSettings.getSettings();
            
            if (action === 'start') {
                botSettings.status.withdraw = true;
                botSettings.status.task = true;
                botSettings.status.notification = true;
                botSettings.isActive = true;
            } else if (action === 'stop') {
                botSettings.status.withdraw = false;
                botSettings.status.task = false;
                botSettings.status.notification = false;
                botSettings.isActive = false;
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Hành động không hợp lệ'
                });
            }
            
            await botSettings.save();
            
            // Add log
            await botSettings.addLog(
                `Đã ${action === 'start' ? 'khởi động' : 'dừng'} tất cả bots`,
                action === 'start' ? 'success' : 'warning'
            );
            
            res.json({
                success: true,
                message: `Đã ${action === 'start' ? 'khởi động' : 'dừng'} tất cả bots`,
                status: botSettings.status
            });
        } catch (error) {
            logger.error('Control all bots error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }

    // Simulate single transaction
    async simulateTransaction(req, res) {
        try {
            const { type } = req.body;
            
            const validTypes = ['deposit', 'withdraw', 'task'];
            if (!validTypes.includes(type)) {
                return res.status(400).json({
                    success: false,
                    error: 'Loại giao dịch không hợp lệ'
                });
            }
            
            // Get random user
            const user = await User.aggregate([{ $sample: { size: 1 } }]);
            
            if (user.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Không có người dùng để tạo giao dịch'
                });
            }
            
            let transaction;
            
            if (type === 'deposit') {
                const depositData = FakeTransactionGenerator.generateFakeDeposit(user[0]._id);
                const deposit = new Deposit(depositData);
                await deposit.save();
                transaction = deposit;
                
                // Update user balance
                await User.findByIdAndUpdate(user[0]._id, {
                    $inc: { 
                        balance: depositData.amount,
                        deposited: depositData.amount 
                    }
                });
            } else if (type === 'withdraw') {
                const withdrawData = FakeTransactionGenerator.generateFakeWithdraw(user[0]._id);
                const withdraw = new Withdraw(withdrawData);
                await withdraw.save();
                transaction = withdraw;
                
                // Update user balance if completed
                if (withdrawData.status === 'completed') {
                    const userDoc = await User.findById(user[0]._id);
                    if (withdrawData.amount <= userDoc.commission) {
                        userDoc.commission -= withdrawData.amount;
                    } else {
                        const remaining = withdrawData.amount - userDoc.commission;
                        userDoc.commission = 0;
                        userDoc.balance -= remaining;
                    }
                    await userDoc.save();
                }
            } else if (type === 'task') {
                const taskData = FakeTransactionGenerator.generateFakeTask(user[0]._id);
                const task = new Task(taskData);
                await task.save();
                transaction = task;
                
                // Update user commission
                await User.findByIdAndUpdate(user[0]._id, {
                    $inc: { 
                        commission: taskData.commission,
                        tasksCompleted: 1 
                    }
                });
            }
            
            const botSettings = await BotSettings.getSettings();
            await botSettings.addLog(
                `Đã tạo giao dịch ${type} ảo`,
                'success',
                { type, userId: user[0]._id, amount: transaction.amount }
            );
            
            res.json({
                success: true,
                message: `Đã tạo giao dịch ${type} ảo`,
                transaction
            });
        } catch (error) {
            logger.error('Simulate transaction error:', error);
            res.status(500).json({
                success: false,
                error: 'Lỗi server'
            });
        }
    }
}

module.exports = new BotController();
