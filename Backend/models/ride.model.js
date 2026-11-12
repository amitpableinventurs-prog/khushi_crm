const mongoose = require('mongoose');
const { VEHICLE_TYPES, MAX_HELPERS } = require('../config/vehicles');


const rideSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    captain: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'captain',
    },
    pickup: {
        type: String,
        required: true,
    },
    destination: {
        type: String,
        required: true,
    },
    fare: {
        type: Number,
        required: true,
    },

    status: {
        type: String,
        enum: [ 'pending', 'accepted', "ongoing", 'completed', 'cancelled' ],
        default: 'pending',
    },

    duration: {
        type: Number,
    }, // in seconds

    distance: {
        type: Number,
    }, // in meters

    paymentID: {
        type: String,
    },
    orderId: {
        type: String,
    },
    signature: {
        type: String,
    },

    otp: {
        type: String,
        select: false,
        required: true,
    },
    completedAt: {
        type: Date,
    },
    vehicleType: {
        type: String,
        enum: VEHICLE_TYPES,
    },
    // What is being moved and who receives it at the drop location
    goodsType: {
        type: String,
        trim: true,
    },
    goodsWeight: {
        type: Number,
        min: 0,
    }, // in kg
    receiverName: {
        type: String,
        trim: true,
    },
    receiverPhone: {
        type: String,
        trim: true,
    },
    helpers: {
        type: Number,
        default: 0,
        min: 0,
        max: MAX_HELPERS,
    }, // loading helpers requested
    helperCharge: {
        type: Number,
        default: 0,
    }, // total helper amount already included in fare
    notes: {
        type: String,
        trim: true,
    },
    cancelledBy: {
        type: String,
        enum: [ 'user', 'admin' ],
    },
    cancelReason: {
        type: String,
    },
    paymentMethod: {
        type: String,
        enum: [ 'cash', 'online' ],
    },
    paymentStatus: {
        type: String,
        enum: [ 'pending', 'paid', 'refunded' ],
        default: 'pending',
    },
    paidAt: {
        type: Date,
    },
    refundId: {
        type: String,
    },
    refundedAt: {
        type: Date,
    },
}, { timestamps: true })

module.exports = mongoose.model('ride', rideSchema);