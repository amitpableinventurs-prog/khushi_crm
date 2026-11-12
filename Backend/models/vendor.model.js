const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { VEHICLE_TYPES } = require('../config/vehicles')

const vehicleSchema = new mongoose.Schema({
    color: { type: String, required: true, trim: true, minlength: 3 },
    plate: { type: String, required: true, trim: true, uppercase: true },
    capacity: { type: Number, required: true, min: 1 },
    vehicleType: { type: String, required: true, enum: VEHICLE_TYPES },
}, { timestamps: true })

const vendorSchema = new mongoose.Schema({
    fullname: {
        firstname: { type: String, required: true, trim: true, minlength: 3 },
        lastname: { type: String, trim: true, minlength: 3 },
    },
    businessName: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [ /^\S+@\S+\.\S+$/, 'Please enter a valid email' ],
    },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true, select: false },
    isBlocked: { type: Boolean, default: false },
    vehicles: { type: [ vehicleSchema ], default: [] },
}, { timestamps: true })

vendorSchema.methods.generateAuthToken = function () {
    return jwt.sign({ _id: this._id, role: 'vendor' }, process.env.JWT_SECRET, { expiresIn: '24h' })
}

vendorSchema.methods.comparePassword = function (password) {
    return bcrypt.compare(password, this.password)
}

vendorSchema.statics.hashPassword = function (password) {
    return bcrypt.hash(password, 10)
}

module.exports = mongoose.model('vendor', vendorSchema)
