const mongoose = require('mongoose');

const botLogSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['info', 'success', 'warning', 'error'],
        default: 'info'
    },
    data: {
        type: mongoose.Schema.Types.Mixed
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const botStatsSchema = new mongoose.Schema({
    count: {
        type: Number,
        default: 0
    },
    lastUpdate: {
        type: Date
    },
    totalAmount: {
        type: Number,
        default: 0
    }
});

const botSettingsSchema = new mongoose.Schema({
    // Bot status
    status: {
        withdraw: { type: Boolean, default: false },
        task: { type: Boolean, default: false },
        notification: { type: Boolean, default: false }
    },
    
    // Bot settings
    frequency: {
        type: Number,
        default: parseInt(process.env.BOT_FREQUENCY) || 15,
        min: 5,
        max: 60
    },
    transactionCount: {
        type: Number,
        default: parseInt(process.env.BOT_TRANSACTION_COUNT) || 100,
        min: 10,
        max: 1000
    },
    maxAmount: {
        type: Number,
        default: parseInt(process.env.BOT_MAX_AMOUNT) || 10000000,
        min: 100000,
        max: 100000000
    },
    
    // Bot statistics
    stats: {
        withdraw: botStatsSchema,
        task: botStatsSchema,
        notification: botStatsSchema
    },
    
    // Bot logs (limited to last 100)
    logs: [botLogSchema],
    
    // Configuration
    fakeUsers: {
        type: [String],
        default: [
            'nama chocolate', 'Trần Thái Bình', 'Lê Văn Luyện', 'Tralale Tralala', 'Tungtungtung sahuar',
            'phập không em', 'như muối bỏ biển', 'HDPE thì ngon luôn', 'yamete', 'hú hú',
            'lê văn luyện', 'khá bảnh', 'ài ố sì mà', 'đời là biển cả', 'mẹ mày béo'
        ]
    },
    
    fakeBanks: {
        type: [String],
        default: ['VIB', 'Vietcombank', 'Techcombank', 'MB Bank', 'ACB', 'TP Bank', 'VP Bank']
    },
    
    // Last run
    lastRun: {
        type: Date
    },
    
    // Next run
    nextRun: {
        type: Date
    },
    
    // Settings
    isActive: {
        type: Boolean,
        default: true
    },
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Update timestamp before saving
botSettingsSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    
    // Limit logs to 100 entries
    if (this.logs.length > 100) {
        this.logs = this.logs.slice(-100);
    }
    
    next();
});

// Method to add log
botSettingsSchema.methods.addLog = function(message, type = 'info', data = null) {
    this.logs.push({
        message,
        type,
        data,
        createdAt: new Date()
    });
    
    return this.save();
};

// Method to update stats
botSettingsSchema.methods.updateStats = function(botType, amount = 0) {
    if (!this.stats[botType]) {
        this.stats[botType] = {
            count: 0,
            lastUpdate: new Date(),
            totalAmount: 0
        };
    }
    
    this.stats[botType].count += 1;
    this.stats[botType].lastUpdate = new Date();
    this.stats[botType].totalAmount += amount;
    
    return this.save();
};

// Static method to get or create settings
botSettingsSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    
    if (!settings) {
        settings = await this.create({});
    }
    
    return settings;
};

const BotSettings = mongoose.model('BotSettings', botSettingsSchema);

module.exports = BotSettings;
