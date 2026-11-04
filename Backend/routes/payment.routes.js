const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/auth.middleware');
const paymentController = require('../controllers/payment.controller');

// The webhook route is mounted separately in app.js, before express.json(), because
// Razorpay's signature is computed over the raw request body.

router.get('/config', authMiddleware.authUser, paymentController.getPaymentConfig)

router.post('/create-order',
    authMiddleware.authUser,
    body('rideId').isMongoId().withMessage('Invalid ride id'),
    paymentController.createOrder
)

router.post('/verify',
    authMiddleware.authUser,
    body('rideId').isMongoId().withMessage('Invalid ride id'),
    body('razorpay_order_id').isString().notEmpty(),
    body('razorpay_payment_id').isString().notEmpty(),
    body('razorpay_signature').isString().notEmpty(),
    paymentController.verifyPayment
)

module.exports = router;
