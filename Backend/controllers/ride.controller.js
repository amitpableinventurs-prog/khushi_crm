const rideService = require('../services/ride.service');
const { validationResult } = require('express-validator');
const mapService = require('../services/maps.service');
const { sendMessageToSocketId } = require('../socket');
const rideModel = require('../models/ride.model');
const captainModel = require('../models/captain.model');
const notificationService = require('../services/notification.service');
const pricingService = require('../services/pricing.service');

module.exports.createRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { pickup, destination, vehicleType, goodsType, goodsWeight, receiverName, receiverPhone, helpers, notes, couponCode } = req.body;

    try {
        const ride = await rideService.createRide({
            user: req.user._id, pickup, destination, vehicleType,
            goodsType, goodsWeight, receiverName, receiverPhone, helpers, notes, couponCode
        });
        res.status(201).json(ride);

        const pickupCoordinates = await mapService.getAddressCoordinate(pickup);
        // Only drivers with the booked vehicle type get the request
        const captainsInRadius = (await mapService.getCaptainsInTheRadius(pickupCoordinates.ltd, pickupCoordinates.lng, 2))
            .filter(captain => captain.vehicle?.vehicleType === vehicleType);

        ride.otp = "";
        const rideWithUser = await rideModel.findOne({ _id: ride._id }).populate('user');

        for (let captain of captainsInRadius) {
            const freshCaptain = await captainModel.findById(captain._id);
            if (freshCaptain && freshCaptain.socketId) {
                console.log(`Sending new-ride to captain ${freshCaptain._id} on socket ${freshCaptain.socketId}`);
                sendMessageToSocketId(freshCaptain.socketId, { event: 'new-ride', data: rideWithUser });
            }
        }

        notificationService.notify('captain.new_ride_request', { rideId: ride._id, captainIds: captainsInRadius.map(c => c._id) });
    } catch (err) {
        console.error("createRide error:", err);
        if (!res.headersSent) {
            return res.status(err.status || 500).json({ message: err.message });
        }
    }
};

module.exports.getFare = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { pickup, destination } = req.query;
    try {
        const fare = await rideService.getFare(pickup, destination);
        // Best automatic offer per vehicle (without helpers), shown on the vehicle list
        const vehicleFares = Object.fromEntries(Object.entries(fare).filter(([ key ]) => key !== 'helperCharge'));
        fare.offers = await pricingService.offersForFares({ userId: req.user._id, fares: vehicleFares });
        return res.status(200).json(fare);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// Price breakdown for the confirm screen: helpers, best offer or entered coupon
module.exports.getQuote = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { pickup, destination, vehicleType, helpers, couponCode } = req.body;
    try {
        const quote = await rideService.quoteRide({ user: req.user._id, pickup, destination, vehicleType, helpers, couponCode });
        // Commission is internal; the customer only sees what they pay
        const { commission, commissionPercent, commissionRule, driverEarning, ...forCustomer } = quote;
        return res.status(200).json(forCustomer);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports.listOffers = async (req, res) => {
    try {
        return res.status(200).json(await pricingService.listForCustomers());
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports.confirmRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { rideId } = req.body;
    try {
        const ride = await rideService.confirmRide({ rideId, captain: req.captain });
        sendMessageToSocketId(ride.user.socketId, { event: 'ride-confirmed', data: ride });
        notificationService.notify('rider.ride_accepted', { rideId: ride._id });
        return res.status(200).json(ride);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: err.message });
    }
};

module.exports.startRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { rideId, otp } = req.query;
    try {
        const ride = await rideService.startRide({ rideId, otp, captain: req.captain });
        sendMessageToSocketId(ride.user.socketId, { event: 'ride-started', data: ride });
        notificationService.notify('rider.ride_started', { rideId: ride._id });
        return res.status(200).json(ride);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports.endRide = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { rideId } = req.body;
    try {
        const ride = await rideService.endRide({ rideId, captain: req.captain });
        sendMessageToSocketId(ride.user.socketId, { event: 'ride-ended', data: ride });
        notificationService.notify('rider.ride_completed', { rideId: ride._id });
        notificationService.notify('captain.ride_completed', { rideId: ride._id });
        return res.status(200).json(ride);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports.getCaptainStats = async (req, res) => {
    try {
        const captainId = req.captain._id;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // All completed rides for this captain
        const completedRides = await rideModel.find({
            captain: captainId,
            status: 'completed'
        });

        // All rides captain was assigned to (for total count)
        const allRides = await rideModel.find({
            captain: captainId,
            status: { $in: ['completed', 'ongoing', 'accepted'] }
        });

        // Filter today's rides using completedAt (set explicitly on endRide), 
        // fallback to updatedAt, createdAt, then ObjectId built-in timestamp
        // (ObjectId always has a timestamp regardless of schema options)
        const todayRides = completedRides.filter(r => {
            const rideDate = r.completedAt || r.updatedAt || r.createdAt || r._id.getTimestamp();
            return new Date(rideDate) >= todayStart;
        });

        // Driver's share after platform commission (older orders without commission count in full)
        const earning = (r) => r.driverEarning ?? r.fare ?? 0;
        const todayEarnings = todayRides.reduce((sum, r) => sum + earning(r), 0);
        const totalEarnings = completedRides.reduce((sum, r) => sum + earning(r), 0);

        console.log(`[Stats] Captain ${captainId}: todayRides=${todayRides.length}, todayEarnings=${todayEarnings}, totalRides=${allRides.length}, totalEarnings=${totalEarnings}`);

        return res.status(200).json({
            todayRides: todayRides.length,
            todayEarnings: Math.round(todayEarnings),
            totalRides: Math.max(allRides.length, todayRides.length),
            totalEarnings: Math.max(Math.round(totalEarnings), Math.round(todayEarnings)),
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// Captain polls this endpoint to find new pending rides nearby
module.exports.getPendingRides = async (req, res) => {
    try {
        const captain = req.captain;

        // Get captain's last known location from DB
        const freshCaptain = await captainModel.findById(captain._id);
        const ltd = freshCaptain?.location?.ltd;
        const lng = freshCaptain?.location?.lng;

        let pendingRides;

        if (ltd && lng) {
            // Find pending rides and check proximity via map service
            const allPending = await rideModel
                .find({ status: 'pending', vehicleType: freshCaptain?.vehicle?.vehicleType })
                .populate('user')
                .sort({ createdAt: -1 })
                .limit(10);

            // Filter rides within ~5km using basic lat/lng delta (~0.045 degrees ≈ 5km)
            pendingRides = allPending.filter(ride => {
                // We don't have coordinates stored per ride, so return all pending
                // (the radius filter happens on creation via getCaptainsInTheRadius)
                return true;
            });

            // Return only the most recent pending ride
            pendingRides = pendingRides.slice(0, 1);
        } else {
            pendingRides = await rideModel
                .find({ status: 'pending', vehicleType: freshCaptain?.vehicle?.vehicleType })
                .populate('user')
                .sort({ createdAt: -1 })
                .limit(1);
        }

        return res.status(200).json(pendingRides);
    } catch (err) {
        console.error('getPendingRides error:', err);
        return res.status(500).json({ message: err.message });
    }
};

// User cancels a ride while it is pending (before captain accepts)
module.exports.cancelRide = async (req, res) => {
    const { rideId } = req.body;
    if (!rideId) {
        return res.status(400).json({ message: 'rideId is required' });
    }
    try {
        const ride = await rideService.cancelRide({ rideId, userId: req.user._id });

        // If a captain had already accepted, notify them
        if (ride.captain && ride.captain.socketId) {
            sendMessageToSocketId(ride.captain.socketId, {
                event: 'ride-cancelled',
                data: { rideId }
            });
        }
        if (ride.captain) {
            notificationService.notify('captain.ride_cancelled_by_rider', { rideId: ride._id });
        }

        return res.status(200).json({ message: 'Ride cancelled successfully' });
    } catch (err) {
        console.error('cancelRide error:', err);
        return res.status(500).json({ message: err.message });
    }
};

// Returns the current pending, accepted, or ongoing ride for the logged-in user (including OTP)
module.exports.getUserActiveRide = async (req, res) => {
    try {
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

        const ride = await rideModel.findOne({
            user: req.user._id,
            status: { $in: ['pending', 'accepted', 'ongoing'] },
            createdAt: { $gte: twelveHoursAgo }
        })
        .sort({ createdAt: -1 })
        .populate('user')
        .populate('captain')
        .select('+otp');

        return res.status(200).json(ride || null);
    } catch (err) {
        console.error('getUserActiveRide error:', err);
        return res.status(500).json({ message: err.message });
    }
};