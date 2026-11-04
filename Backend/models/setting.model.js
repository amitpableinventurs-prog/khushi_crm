const mongoose = require('mongoose');

// Key/value store for admin-editable settings (e.g. key 'fares').
const settingSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
}, { timestamps: true })

module.exports = mongoose.model('setting', settingSchema);
