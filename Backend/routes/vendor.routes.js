const express = require('express')
const { body } = require('express-validator')
const vendorController = require('../controllers/vendor.controller')
const { authVendor } = require('../middlewares/auth.middleware')
const { VEHICLE_TYPES } = require('../config/vehicles')

const router = express.Router()
const vehicleFields = [
    body('color').trim().isLength({ min: 3, max: 50 }).withMessage('Color must be at least 3 characters long'),
    body('plate').trim().isLength({ min: 3, max: 20 }).withMessage('Enter a valid vehicle plate'),
    body('capacity').isInt({ min: 1, max: 50000 }).withMessage('Load capacity must be between 1 and 50000 kg'),
    body('vehicleType').isIn(VEHICLE_TYPES).withMessage('Select a supported vehicle type'),
]

router.post('/register', [
    body('fullname.firstname').trim().isLength({ min: 3 }).withMessage('First name must be at least 3 characters long'),
    body('fullname.lastname').optional({ values: 'falsy' }).trim().isLength({ min: 3 }).withMessage('Last name must be at least 3 characters long'),
    body('businessName').trim().isLength({ min: 2, max: 120 }).withMessage('Business name is required'),
    body('email').isEmail().withMessage('Enter a valid email'),
    body('phone').matches(/^\+?[\d\s-]{10,16}$/).withMessage('Enter a valid phone number'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
], vendorController.register)

router.post('/login', [
    body('email').isEmail().withMessage('Enter a valid email'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
], vendorController.login)

router.get('/profile', authVendor, vendorController.profile)
router.get('/logout', authVendor, vendorController.logout)
router.post('/vehicles', authVendor, vehicleFields, vendorController.addVehicle)

module.exports = router
