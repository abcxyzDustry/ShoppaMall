const User = require('../models/User');
const Deposit = require('../models/Deposit');
const Withdraw = require('../models/Withdraw');
const Task = require('../models/Task');
const logger = require('./logger');

class FakeTransactionGenerator {
    constructor() {
        this.fakeUsers = [
            'Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C', 'Phạm Thị D', 'Hoàng Văn E',
            'Vũ Văn F', 'Đặng Thị G', 'Bùi Văn H', 'Đỗ Thị I', 'Hồ Văn K',
            'Ngô Thị L', 'Trương Văn M', 'Lý Thị N', 'Mai Văn O', 'Cao Thị P'
        ];
        
        this.fakeBanks = ['VIB', 'Vietcombank', 'Techcombank', 'MB Bank', 'ACB', 'TP Bank', 'VP Bank'];
        this.platforms = ['shopee', 'lazada', 'tiki', 'taobao'];
        this.commissionRates = [1500, 2200, 3300, 4000, 5500];
    }

    // Generate random fake user
    generateFakeUser() {
        const username = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const name = this.fakeUsers[Math.floor(Math.random() * this.fakeUsers.length)];
        
        return {
            username,
            password: 'fake123456',
            fullName: name,
            email: `${username}@example.com`,
            phone: `09${Math.floor(Math.random() * 90000000) + 10000000}`,
            level: Math.floor(Math.random() * 5) + 1,
            balance: Math.floor(Math.random() * 10000000),
            commission: Math.floor(Math.random() * 5000000),
            deposited: Math.floor(Math.random() * 10000000),
            tasksCompleted: Math.floor(Math.random() * 100),
            status: 'active'
        };
    }

    // Generate fake deposit
    generateFakeDeposit(userId) {
        const amounts = [50000, 100000, 200000, 500000];
        const amount = amounts[Math.floor(Math.random() * amounts.length)];
        
        return {
            user: userId,
            amount: amount,
            bankName: 'VIB',
            accountNumber: '068394585',
            paymentMethod: 'bank_transfer',
            status: 'completed',
            qrCodeUrl: Deposit.generateQRCodeUrl(amount),
            approvedAt: new Date(),
            note: 'Deposit từ tài khoản ảo'
        };
    }

    // Generate fake withdraw
    generateFakeWithdraw(userId) {
        const amount = Math.floor(Math.random() * (5000000 - 100000) + 100000);
        const bank = this.fakeBanks[Math.floor(Math.random() * this.fakeBanks.length)];
        
        return {
            user: userId,
            amount: amount,
            bankName: bank,
            accountNumber: `${Math.floor(Math.random() * 9000000000) + 1000000000}`,
            accountHolder: this.fakeUsers[Math.floor(Math.random() * this.fakeUsers.length)],
            status: Math.random() > 0.3 ? 'completed' : 'pending',
            note: 'Rút tiền từ tài khoản ảo'
        };
    }

    // Generate fake task
    generateFakeTask(userId) {
        const platform = this.platforms[Math.floor(Math.random() * this.platforms.length)];
        const level = Math.floor(Math.random() * 5) + 1;
        const commission = this.commissionRates[level - 1];
        
        return {
            user: userId,
            platform: platform,
            level: level,
            commission: commission,
            status: 'completed',
            completedAt: new Date()
        };
    }

    // Create multiple fake users
    async createFakeUsers(count = 10) {
        const fakeUsers = [];
        
        for (let i = 0; i < count; i++) {
            try {
                const fakeUserData = this.generateFakeUser();
                const user = new User(fakeUserData);
                await user.save();
                
                fakeUsers.push(user);
                logger.info(`Created fake user: ${user.username}`);
            } catch (error) {
                logger.error('Error creating fake user:', error.message);
            }
        }
        
        return fakeUsers;
    }

    // Create fake transactions for users
    async createFakeTransactions(users, transactionsPerUser = 5) {
        const allTransactions = [];
        
        for (const user of users) {
            for (let i = 0; i < transactionsPerUser; i++) {
                try {
                    // Randomly choose transaction type
                    const type = Math.random();
                    
                    if (type < 0.4) {
                        // Create deposit
                        const depositData = this.generateFakeDeposit(user._id);
                        const deposit = new Deposit(depositData);
                        await deposit.save();
                        allTransactions.push({ type: 'deposit', data: deposit });
                        
                        // Update user balance
                        user.balance += depositData.amount;
                        user.deposited += depositData.amount;
                    } else if (type < 0.7) {
                        // Create withdraw
                        const withdrawData = this.generateFakeWithdraw(user._id);
                        const withdraw = new Withdraw(withdrawData);
                        await withdraw.save();
                        allTransactions.push({ type: 'withdraw', data: withdraw });
                        
                        // Update user balance if completed
                        if (withdrawData.status === 'completed') {
                            if (withdrawData.amount <= user.commission) {
                                user.commission -= withdrawData.amount;
                            } else {
                                const remaining = withdrawData.amount - user.commission;
                                user.commission = 0;
                                user.balance -= remaining;
                            }
                        }
                    } else {
                        // Create task
                        const taskData = this.generateFakeTask(user._id);
                        const task = new Task(taskData);
                        await task.save();
                        allTransactions.push({ type: 'task', data: task });
                        
                        // Update user commission and tasks count
                        user.commission += taskData.commission;
                        user.tasksCompleted += 1;
                    }
                } catch (error) {
                    logger.error('Error creating fake transaction:', error.message);
                }
            }
            
            // Save user with updated balances
            await user.save();
        }
        
        return allTransactions;
    }

    // Get fake activity for marquee/banner
    getFakeActivity(count = 10) {
        const activities = [];
        
        for (let i = 0; i < count; i++) {
            const user = this.fakeUsers[Math.floor(Math.random() * this.fakeUsers.length)];
            const type = Math.random();
            
            if (type < 0.4) {
                // Deposit activity
                const amount = [50000, 100000, 200000, 500000][Math.floor(Math.random() * 4)];
                activities.push({
                    user: user,
                    action: `đã nạp ${this.formatCurrency(amount)}`,
                    icon: '💰',
                    time: this.getRandomTimeAgo()
                });
            } else if (type < 0.7) {
                // Withdraw activity
                const amount = Math.floor(Math.random() * (5000000 - 100000) + 100000);
                const bank = this.fakeBanks[Math.floor(Math.random() * this.fakeBanks.length)];
                activities.push({
                    user: user,
                    action: `đã rút ${this.formatCurrency(amount)} về ${bank}`,
                    icon: '💳',
                    time: this.getRandomTimeAgo()
                });
            } else {
                // Task activity
                const platform = this.platforms[Math.floor(Math.random() * this.platforms.length)].toUpperCase();
                const commission = this.commissionRates[Math.floor(Math.random() * 5)];
                activities.push({
                    user: user,
                    action: `hoàn thành ${platform} +${this.formatCurrency(commission)}`,
                    icon: '✅',
                    time: this.getRandomTimeAgo()
                });
            }
        }
        
        return activities;
    }

    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    }

    // Get random time ago
    getRandomTimeAgo() {
        const times = [
            { value: 1, unit: 'phút' },
            { value: 5, unit: 'phút' },
            { value: 10, unit: 'phút' },
            { value: 30, unit: 'phút' },
            { value: 1, unit: 'giờ' },
            { value: 2, unit: 'giờ' },
            { value: 5, unit: 'giờ' },
            { value: 1, unit: 'ngày' }
        ];
        
        const time = times[Math.floor(Math.random() * times.length)];
        return `${time.value} ${time.unit} trước`;
    }

    // Get fake statistics
    getFakeStats() {
        return {
            totalUsers: Math.floor(Math.random() * 5000) + 1000,
            totalDeposits: Math.floor(Math.random() * 10000000000) + 5000000000,
            totalWithdraws: Math.floor(Math.random() * 5000000000) + 2000000000,
            totalTasks: Math.floor(Math.random() * 50000) + 10000,
            activeToday: Math.floor(Math.random() * 500) + 100
        };
    }
}

module.exports = new FakeTransactionGenerator();
