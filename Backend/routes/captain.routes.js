const captainController = require('../controllers/captain.controller');
const express = require('express');
const router = express.Router();
const { body } = require("express-validator")
const authMiddleware = require('../middlewares/auth.middleware');
const { VEHICLE_TYPES } = require('../config/vehicles');
const kycUpload = require('../middlewares/kycUpload.middleware');


router.post('/register', kycUpload, [
    body('email').isEmail().withMessage('Invalid Email'),
    body('fullname.firstname').isLength({ min: 3 }).withMessage('First name must be at least 3 characters long'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('vehicle.color').isLength({ min: 3 }).withMessage('Color must be at least 3 characters long'),
    body('vehicle.plate').isLength({ min: 3 }).withMessage('Plate must be at least 3 characters long'),
    body('vehicle.capacity').isInt({ min: 1 }).withMessage('Load capacity must be at least 1 kg'),
    body('vehicle.vehicleType').isIn(VEHICLE_TYPES).withMessage('Invalid vehicle type'),
    body('phone').optional({ values: 'falsy' }).matches(/^\+?[\d\s-]{10,16}$/).withMessage('Phone must be 10 digits, or include the country code like +91...')
],
    captainController.registerCaptain
)


router.post('/login', [
    body('email').isEmail().withMessage('Invalid Email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
],
    captainController.loginCaptain
)


router.get('/profile', authMiddleware.authCaptain, captainController.getCaptainProfile)
router.post('/kyc', authMiddleware.authCaptain, kycUpload, captainController.submitCaptainKyc)

router.get('/logout', authMiddleware.authCaptain, captainController.logoutCaptain)

router.post('/forgot-password', [
    body('email').isEmail().withMessage('Invalid Email')
], captainController.forgotPassword);

router.post('/reset-password', [
    body('email').isEmail().withMessage('Invalid Email'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], captainController.resetPassword);

module.exports = router;