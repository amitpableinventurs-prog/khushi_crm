const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const rideController = require('../controllers/ride.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { VEHICLE_TYPES, VEHICLE_BY_KEY, GOODS_TYPES, MAX_HELPERS } = require('../config/vehicles');

const couponBody = body('couponCode').optional({ values: 'falsy' }).isString().trim().isLength({ max: 30 }).withMessage('Coupon code is too long');


router.post('/create',
    authMiddleware.authUser,
    body('pickup').isString().isLength({ min: 3 }).withMessage('Invalid pickup address'),
    body('destination').isString().isLength({ min: 3 }).withMessage('Invalid destination address'),
    body('vehicleType').isString().isIn(VEHICLE_TYPES).withMessage('Invalid vehicle type'),
    body('goodsType').isIn(GOODS_TYPES).withMessage('Select what you are sending'),
    body('goodsWeight').optional({ values: 'falsy' }).isFloat({ gt: 0 }).withMessage('Weight must be more than 0 kg').bail()
        .custom((kg, { req }) => {
            const vehicle = VEHICLE_BY_KEY[ req.body.vehicleType ];
            if (vehicle && Number(kg) > vehicle.capacityKg) {
                throw new Error(`${vehicle.label} carries up to ${vehicle.capacityKg} kg. Choose a bigger vehicle.`);
            }
            return true;
        }),
    body('receiverName').trim().isLength({ min: 2, max: 80 }).withMessage('Receiver name is required'),
    body('receiverPhone').matches(/^\+?[\d\s-]{10,16}$/).withMessage('Receiver phone must be 10 digits, or include the country code like +91...'),
    body('helpers').optional().isInt({ min: 0, max: MAX_HELPERS }).withMessage(`Helpers must be 0 to ${MAX_HELPERS}`),
    body('notes').optional().isString().isLength({ max: 300 }).withMessage('Notes are too long'),
    couponBody,
    rideController.createRide
)

router.post('/quote',
    authMiddleware.authUser,
    body('pickup').isString().isLength({ min: 3 }).withMessage('Invalid pickup address'),
    body('destination').isString().isLength({ min: 3 }).withMessage('Invalid destination address'),
    body('vehicleType').isString().isIn(VEHICLE_TYPES).withMessage('Invalid vehicle type'),
    body('helpers').optional().isInt({ min: 0, max: MAX_HELPERS }).withMessage(`Helpers must be 0 to ${MAX_HELPERS}`),
    couponBody,
    rideController.getQuote
)

router.get('/offers',
    authMiddleware.authUser,
    rideController.listOffers
)

router.get('/get-fare',
    authMiddleware.authUser,
    query('pickup').isString().isLength({ min: 3 }).withMessage('Invalid pickup address'),
    query('destination').isString().isLength({ min: 3 }).withMessage('Invalid destination address'),
    rideController.getFare
)

router.post('/confirm',
    authMiddleware.authCaptain,
    authMiddleware.requireVerifiedCaptain,
    body('rideId').isMongoId().withMessage('Invalid ride id'),
    rideController.confirmRide
)

router.get('/start-ride',
    authMiddleware.authCaptain,
    authMiddleware.requireVerifiedCaptain,
    query('rideId').isMongoId().withMessage('Invalid ride id'),
    query('otp').isString().isLength({ min: 6, max: 6 }).withMessage('Invalid OTP'),
    rideController.startRide
)

router.post('/end-ride',
    authMiddleware.authCaptain,
    authMiddleware.requireVerifiedCaptain,
    body('rideId').isMongoId().withMessage('Invalid ride id'),
    rideController.endRide
)

router.get('/captain-stats',
    authMiddleware.authCaptain,
    authMiddleware.requireVerifiedCaptain,
    rideController.getCaptainStats
)

router.get('/pending',
    authMiddleware.authCaptain,
    authMiddleware.requireVerifiedCaptain,
    rideController.getPendingRides
)

router.post('/cancel',
    authMiddleware.authUser,
    body('rideId').isMongoId().withMessage('Invalid ride id'),
    rideController.cancelRide
)

router.get('/user-active-ride',
    authMiddleware.authUser,
    rideController.getUserActiveRide
)

module.exports = router;