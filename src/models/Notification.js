const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['general', 'system', 'promotion', 'alert'],
        default: 'general'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    targetUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    views: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes
notificationSchema.index({ isActive: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ startDate: 1, endDate: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
