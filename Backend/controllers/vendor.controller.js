const vendorModel = require('../models/vendor.model')
const { validationResult } = require('express-validator')
const blackListTokenModel = require('../models/blackListToken.model')
const { VEHICLE_TYPES } = require('../config/vehicles')

const validate = (req, res) => {
    const errors = validationResult(req)
    if (errors.isEmpty()) return true
    res.status(400).json({ errors: errors.array(), message: errors.array()[ 0 ].msg })
    return false
}

const publicVendor = (vendor) => {
    const result = vendor.toObject()
    delete result.password
    return result
}

module.exports.register = async (req, res) => {
    if (!validate(req, res)) return
    const email = req.body.email.toLowerCase().trim()
    if (await vendorModel.exists({ email })) {
        return res.status(409).json({ message: 'A vendor account already uses this email.' })
    }

    const password = await vendorModel.hashPassword(req.body.password)
    const vendor = await vendorModel.create({
        fullname: req.body.fullname,
        businessName: req.body.businessName.trim(),
        email,
        phone: req.body.phone.trim(),
        password,
    })
    const token = vendor.generateAuthToken()
    return res.status(201).json({ token, vendor: publicVendor(vendor) })
}

module.exports.login = async (req, res) => {
    if (!validate(req, res)) return
    const vendor = await vendorModel.findOne({ email: req.body.email.toLowerCase().trim() }).select('+password')
    if (!vendor || !(await vendor.comparePassword(req.body.password))) {
        return res.status(401).json({ message: 'Invalid email or password.' })
    }
    if (vendor.isBlocked) return res.status(403).json({ message: 'This vendor account has been blocked.' })

    const token = vendor.generateAuthToken()
    res.cookie('token', token)
    return res.status(200).json({ token, vendor: publicVendor(vendor) })
}

module.exports.profile = (req, res) => res.status(200).json({ vendor: req.vendor })

module.exports.logout = async (req, res) => {
    await blackListTokenModel.create({ token: req.token })
    res.clearCookie('token')
    return res.status(200).json({ message: 'Signed out.' })
}

module.exports.addVehicle = async (req, res) => {
    if (!validate(req, res)) return
    const plate = req.body.plate.trim().toUpperCase()
    if (!VEHICLE_TYPES.includes(req.body.vehicleType)) {
        return res.status(400).json({ message: 'Select a supported vehicle type.' })
    }
    if (await vendorModel.exists({ 'vehicles.plate': plate })) {
        return res.status(409).json({ message: 'This vehicle plate is already registered.' })
    }

    const vendor = await vendorModel.findById(req.vendor._id)
    vendor.vehicles.push({
        color: req.body.color.trim(),
        plate,
        capacity: Number(req.body.capacity),
        vehicleType: req.body.vehicleType,
    })
    await vendor.save()
    return res.status(201).json({ vehicles: vendor.vehicles })
}
