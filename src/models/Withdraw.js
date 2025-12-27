const mongoose = require('mongoose');

const withdrawSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: [100000, 'Minimum withdrawal amount is 100,000 VNĐ'],
        max: [5000000, 'Maximum withdrawal amount is 5,000,000 VNĐ']
    },
    bankName: {
        type: String,
        required: [true, 'Bank name is required'],
        trim: true
    },
    accountNumber: {
        type: String,
        required: [true, 'Account number is required'],
        trim: true
    },
    accountHolder: {
        type: String,
        required: [true, 'Account holder name is required'],
        trim: true
    },
    branch: {
        type: String,
        trim: true
    },
    transactionId: {
        type: String,
        unique: true,
        sparse: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    note: {
        type: String,
        trim: true
    },
    approvedAt: {
        type: Date
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    processedAt: {
        type: Date
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    completedAt: {
        type: Date
    },
    rejectedAt: {
        type: Date
    },
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    rejectionReason: {
        type: String
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

// Indexes for faster queries
withdrawSchema.index({ user: 1, createdAt: -1 });
withdrawSchema.index({ status: 1 });
withdrawSchema.index({ createdAt: -1 });

// Virtual for formatted amount
withdrawSchema.virtual('formattedAmount').get(function() {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(this.amount);
});

// Method to approve withdrawal
withdrawSchema.methods.approve = async function(adminId) {
    this.status = 'processing';
    this.approvedAt = new Date();
    this.approvedBy = adminId;
    return this.save();
};

// Method to complete withdrawal
withdrawSchema.methods.complete = async function(adminId, transactionId) {
    this.status = 'completed';
    this.completedAt = new Date();
    this.processedBy = adminId;
    this.transactionId = transactionId;
    return this.save();
};

// Method to reject withdrawal
withdrawSchema.methods.reject = async function(adminId, reason) {
    this.status = 'failed';
    this.rejectedAt = new Date();
    this.rejectedBy = adminId;
    this.rejectionReason = reason;
    return this.save();
};

const Withdraw = mongoose.model('Withdraw', withdrawSchema);

module.exports = Withdraw;
