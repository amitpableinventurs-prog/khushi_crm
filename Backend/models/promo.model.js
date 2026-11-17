const mongoose = require('mongoose');
const { VEHICLE_TYPES } = require('../config/vehicles');

// One model for both kinds of discount:
//   offer  - applied automatically when its rules match (no code)
//   coupon - applied only when the customer enters its code
const promoSchema = new mongoose.Schema({
    kind: { type: String, enum: [ 'offer', 'coupon' ], required: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300 },
    code: { type: String, trim: true, uppercase: true },

    discountType: { type: String, enum: [ 'percent', 'flat' ], required: true },
    value: { type: Number, required: true, min: 0 }, // % or ₹
    maxDiscount: { type: Number, min: 0 }, // cap for percent discounts, ₹
    minFare: { type: Number, min: 0, default: 0 }, // order total must be at least this, ₹

    // Empty list = every vehicle / every day
    vehicleTypes: { type: [ { type: String, enum: VEHICLE_TYPES } ], default: [] },
    days: { type: [ { type: Number, min: 0, max: 6 } ], default: [] }, // 0 = Sunday
    // Daily time window in India time, 'HH:MM'. End before start means it runs past midnight.
    startTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    validFrom: { type: Date },
    validTo: { type: Date },

    usageLimit: { type: Number, min: 1 }, // total orders across all customers
    perUserLimit: { type: Number, min: 1 },
    firstOrderOnly: { type: Boolean, default: false },
    showToCustomers: { type: Boolean, default: true }, // coupons: list the code in the app
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

promoSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { kind: 'coupon' } });

module.exports = mongoose.model('promo', promoSchema);
