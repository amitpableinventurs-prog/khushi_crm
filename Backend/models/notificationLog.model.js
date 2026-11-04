const mongoose = require('mongoose');

// One row per notification attempt; kept for 30 days for the admin log
const notificationLogSchema = new mongoose.Schema({
    event: { type: String, required: true },
    channel: { type: String, enum: [ 'email', 'sms', 'whatsapp', 'push' ], required: true },
    recipientType: { type: String, enum: [ 'rider', 'captain', 'test' ], required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId },
    recipientName: { type: String },
    to: { type: String },
    status: { type: String, enum: [ 'sent', 'failed', 'skipped' ], required: true },
    detail: { type: String },
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'ride' },
    createdAt: { type: Date, default: Date.now, expires: 30 * 24 * 60 * 60 },
});

notificationLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('notificationLog', notificationLogSchema);
