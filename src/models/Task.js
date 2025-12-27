const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    platform: {
        type: String,
        enum: ['shopee', 'lazada', 'tiki', 'taobao'],
        required: true
    },
    level: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    commission: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    completedAt: {
        type: Date
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Indexes
taskSchema.index({ user: 1, createdAt: -1 });
taskSchema.index({ status: 1 });

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
