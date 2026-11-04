const rideModel = require('../models/ride.model');
const paymentService = require('../services/payment.service');
const notificationService = require('../services/notification.service');
const integrationService = require('../services/integration.service');
const { sendMessageToSocketId } = require('../socket');
const { validationResult } = require('express-validator');

const PAYABLE = [ 'accepted', 'ongoing', 'completed' ];

// Marks the ride paid (once), tells the captain over socket and sends notifications
async function markRidePaid(orderId, paymentId, signature) {
    const ride = await rideModel.findOneAndUpdate(
        { orderId, paymentStatus: { $ne: 'paid' } },
        { paymentStatus: 'paid', paymentMethod: 'online', paymentID: paymentId, signature, paidAt: new Date() },
        { new: true }
    ).populate('captain');

    if (!ride) return null;

    if (ride.captain?.socketId) {
        sendMessageToSocketId(ride.captain.socketId, {
            event: 'payment-received',
            data: { rideId: ride._id, paid: true, method: 'online', fare: ride.fare }
        });
    }
    notificationService.notify('captain.payment_received', { rideId: ride._id });
    return ride;
}

module.exports.getPaymentConfig = async (req, res) => {
    try {
        const config = await paymentService.getConfig();
        const smtp = await integrationService.get('smtp');
        res.status(200).json({
            online: config.online,
            keyId: config.online ? config.keyId : undefined,
            allowCash: config.allowCash || !config.online,
            businessName: smtp.fromName || 'Khushi Transport',
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

module.exports.createOrder = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const config = await paymentService.getConfig();
        if (!config.online) {
            return res.status(400).json({ message: 'Online payment is not available right now. Please pay in cash.' });
        }

        const ride = await rideModel.findOne({ _id: req.body.rideId, user: req.user._id });
        if (!ride || !PAYABLE.includes(ride.status)) {
            return res.status(404).json({ message: 'Ride not found or not ready for payment' });
        }
        if (ride.paymentStatus === 'paid') {
            return res.status(400).json({ message: 'This ride is already paid' });
        }

        const order = await paymentService.createOrder(config, {
            amount: ride.fare,
            receipt: String(ride._id),
            notes: { rideId: String(ride._id), userId: String(req.user._id) },
        });
        ride.orderId = order.id;
        await ride.save();

        res.status(200).json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: config.keyId,
            prefill: {
                name: [ req.user.fullname?.firstname, req.user.fullname?.lastname ].filter(Boolean).join(' '),
                email: req.user.email,
                contact: req.user.phone || undefined,
            },
        });
    } catch (err) {
        console.error('createOrder error:', err.message);
        res.status(502).json({ message: err.message });
    }
}

module.exports.verifyPayment = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { rideId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
        const config = await paymentService.getConfig();

        const ride = await rideModel.findOne({ _id: rideId, user: req.user._id });
        if (!ride || ride.orderId !== orderId) {
            return res.status(400).json({ message: 'Payment does not match this ride' });
        }
        if (!paymentService.verifyPaymentSignature(config, { orderId, paymentId, signature })) {
            return res.status(400).json({ message: 'Payment verification failed. If money was deducted it will be refunded automatically by Razorpay.' });
        }

        await markRidePaid(orderId, paymentId, signature);
        const updated = await rideModel.findById(rideId).populate('captain');
        res.status(200).json({ message: 'Payment successful', ride: updated });
    } catch (err) {
        console.error('verifyPayment error:', err.message);
        res.status(500).json({ message: err.message });
    }
}

// Razorpay webhook (backup in case the browser closes before /verify). Needs the raw body.
module.exports.webhook = async (req, res) => {
    try {
        const config = await paymentService.getConfig();
        if (!paymentService.verifyWebhookSignature(config, req.body, req.headers[ 'x-razorpay-signature' ])) {
            return res.status(400).json({ message: 'Invalid signature' });
        }

        const event = JSON.parse(req.body.toString('utf8'));
        if (event.event === 'payment.captured' || event.event === 'order.paid') {
            const payment = event.payload?.payment?.entity;
            if (payment?.order_id) await markRidePaid(payment.order_id, payment.id);
        }
        res.status(200).json({ received: true });
    } catch (err) {
        console.error('Razorpay webhook error:', err.message);
        res.status(500).json({ message: 'Webhook error' });
    }
}
