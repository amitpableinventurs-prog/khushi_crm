const mongoose = require('mongoose')
const { VEHICLE_TYPES } = require('../config/vehicles')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const kycDocumentSchema = new mongoose.Schema({
    content: {
        type: Buffer,
        select: false,
    },
    contentType: {
        type: String,
        enum: [ 'application/pdf', 'image/jpeg', 'image/png' ],
    },
}, { _id: false })

const kycSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: [ 'pending', 'verified', 'rejected' ],
        default: 'pending',
    },
    documentsSubmitted: {
        type: Boolean,
        default: false,
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    },
    reviewedAt: Date,
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
    },
    reviewNote: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    documents: {
        license: { type: kycDocumentSchema, select: false },
        identity: { type: kycDocumentSchema, select: false },
    },
}, { _id: false })

const captainSchema = new mongoose.Schema({
    fullname: {
        firstname: {
            type: String,
            required: true,
            minlength: [ 3, 'Firstname must be at least 3 characters long' ],
        },
        lastname: {
            type: String,
            minlength: [ 3, 'Lastname must be at least 3 characters long' ],
        }
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        match: [ /^\S+@\S+\.\S+$/, 'Please enter a valid email' ]
    },
    password: {
        type: String,
        required: true,
        select: false,
    },
    socketId: {
        type: String,
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
    phone: {
        type: String,
        trim: true,
    },
    // Firebase Cloud Messaging device tokens for browser push
    pushTokens: {
        type: [ String ],
        select: false,
    },
    resetOtp: {
        type: String,
        select: false,
    },
    resetOtpExpires: {
        type: Date,
        select: false,
    },

    status: {
        type: String,
        enum: [ 'active', 'inactive' ],
        default: 'inactive',
    },
    kyc: {
        type: kycSchema,
        default: () => ({}),
    },

    vehicle: {
        color: {
            type: String,
            required: true,
            minlength: [ 3, 'Color must be at least 3 characters long' ],
        },
        plate: {
            type: String,
            required: true,
            minlength: [ 3, 'Plate must be at least 3 characters long' ],
        },
        // load capacity in kg
        capacity: {
            type: Number,
            required: true,
            min: [ 1, 'Capacity must be at least 1' ],
        },
        vehicleType: {
            type: String,
            required: true,
            enum: VEHICLE_TYPES,
        }
    },

    location: {
        ltd: {
            type: Number,
        },
        lng: {
            type: Number,
        }
    }
}, { timestamps: true })


captainSchema.methods.generateAuthToken = function () {
    const token = jwt.sign({ _id: this._id, role: 'captain' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return token;
}


captainSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
}


captainSchema.statics.hashPassword = async function (password) {
    return await bcrypt.hash(password, 10);
}

const captainModel = mongoose.model('captain', captainSchema)


module.exports = captainModel;