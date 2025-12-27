const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: [50000, 'Minimum deposit amount is 50,000 VNĐ']
    },
    transactionId: {
        type: String,
        unique: true,
        sparse: true
    },
    bankName: {
        type: String,
        default: 'VIB'
    },
    accountNumber: {
        type: String,
        default: '068394585'
    },
    paymentMethod: {
        type: String,
        enum: ['bank_transfer', 'qr_code', 'card', 'wallet'],
        default: 'bank_transfer'
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    qrCodeUrl: {
        type: String
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
depositSchema.index({ user: 1, createdAt: -1 });
depositSchema.index({ status: 1 });
depositSchema.index({ createdAt: -1 });

// Virtual for formatted amount
depositSchema.virtual('formattedAmount').get(function() {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(this.amount);
});

// Method to approve deposit
depositSchema.methods.approve = async function(adminId) {
    this.status = 'completed';
    this.approvedAt = new Date();
    this.approvedBy = adminId;
    return this.save();
};

// Method to reject deposit
depositSchema.methods.reject = async function(adminId, reason) {
    this.status = 'failed';
    this.rejectedAt = new Date();
    this.rejectedBy = adminId;
    this.rejectionReason = reason;
    return this.save();
};

// Static method to generate QR code URL
depositSchema.statics.generateQRCodeUrl = function(amount) {
    const baseUrl = 'https://qr.sepay.vn/img';
    const params = new URLSearchParams({
        bank: process.env.QR_BANK || 'VIB',
        acc: process.env.QR_ACCOUNT || '068394585',
        template: process.env.QR_TEMPLATE || 'compact',
        amount: amount,
        des: 'nap tien tai khoan'
    });
    
    return `${baseUrl}?${params.toString()}`;
};

const Deposit = mongoose.model('Deposit', depositSchema);

module.exports = Deposit;
