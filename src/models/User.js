const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [50, 'Username cannot exceed 50 characters']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        sparse: true
    },
    phone: {
        type: String,
        trim: true
    },
    fullName: {
        type: String,
        trim: true
    },
    level: {
        type: Number,
        default: 1,
        min: 1,
        max: 5
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    commission: {
        type: Number,
        default: 0,
        min: 0
    },
    deposited: {
        type: Number,
        default: 0,
        min: 0
    },
    tasksCompleted: {
        type: Number,
        default: 0
    },
    bankInfo: {
        bankName: String,
        accountNumber: String,
        accountHolder: String,
        branch: String
    },
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['active', 'suspended', 'banned', 'pending'],
        default: 'active'
    },
    lastLogin: {
        type: Date
    },
    loginCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for total balance
userSchema.virtual('totalBalance').get(function() {
    return this.balance + this.commission;
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Update timestamp before saving
userSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate referral code
userSchema.methods.generateReferralCode = function() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.referralCode = code;
    return code;
};

// Method to add commission
userSchema.methods.addCommission = function(amount) {
    this.commission += amount;
    this.tasksCompleted += 1;
    return this.save();
};

// Method to deposit
userSchema.methods.deposit = function(amount) {
    this.balance += amount;
    this.deposited += amount;
    return this.save();
};

// Method to withdraw
userSchema.methods.withdraw = function(amount) {
    if (amount > this.totalBalance) {
        throw new Error('Insufficient balance');
    }
    
    // Use commission first, then balance
    if (amount <= this.commission) {
        this.commission -= amount;
    } else {
        const remaining = amount - this.commission;
        this.commission = 0;
        this.balance -= remaining;
    }
    
    return this.save();
};

// Static method to find by referral code
userSchema.statics.findByReferralCode = function(code) {
    return this.findOne({ referralCode: code });
};

const User = mongoose.model('User', userSchema);

module.exports = User;
