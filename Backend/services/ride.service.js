const rideModel = require('../models/ride.model');
const mapService = require('./maps.service');
const settingService = require('./setting.service');
const paymentService = require('./payment.service');
const pricingService = require('./pricing.service');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function getFare(pickup, destination) {

    if (!pickup || !destination) {
        throw new Error('Pickup and destination are required');
    }

    const distanceTime = await mapService.getDistanceTime(pickup, destination);

    // Rates are editable from the admin panel (Fare settings)
    const rates = await settingService.getFareSettings();
    const km = distanceTime.distance.value / 1000;
    const minutes = distanceTime.duration.value / 60;

    const fare = Object.fromEntries(settingService.VEHICLE_TYPES.map((type) => {
        const rate = rates[ type ];
        return [ type, Math.round(rate.baseFare + (km * rate.perKm) + (minutes * rate.perMinute)) ];
    }));
    // Per loading helper, added on top of the vehicle fare when the customer asks for helpers
    fare.helperCharge = rates.helperCharge;

    return fare;


}

module.exports.getFare = getFare;


function getOtp(num) {
    function generateOtp(num) {
        const otp = crypto.randomInt(Math.pow(10, num - 1), Math.pow(10, num)).toString();
        return otp;
    }
    return generateOtp(num);
}


// Price breakdown for one vehicle: fare, helpers, best offer or coupon, commission
async function quoteRide({ user, pickup, destination, vehicleType, helpers = 0, couponCode }) {
    const fare = await getFare(pickup, destination);
    const helperCount = Number(helpers) || 0;
    const helperCharge = helperCount * fare.helperCharge;
    const quote = await pricingService.quote({
        userId: user,
        vehicleType,
        amount: fare[ vehicleType ] + helperCharge,
        couponCode,
    });
    return { ...quote, vehicleFare: fare[ vehicleType ], helpers: helperCount, helperCharge };
}

module.exports.quoteRide = quoteRide;

module.exports.createRide = async ({
    user, pickup, destination, vehicleType,
    goodsType, goodsWeight, receiverName, receiverPhone, helpers = 0, notes, couponCode
}) => {
    if (!user || !pickup || !destination || !vehicleType) {
        throw new Error('All fields are required');
    }

    const distanceTime = await mapService.getDistanceTime(pickup, destination);
    const quote = await quoteRide({ user, pickup, destination, vehicleType, helpers, couponCode });
    if (quote.couponError) {
        throw Object.assign(new Error(quote.couponError), { status: 400 });
    }
    const { helpers: helperCount, helperCharge } = quote;

    const ride = rideModel.create({
        user,
        pickup,
        destination,
        otp: getOtp(6),
        fare: quote.fare,
        fareBeforeDiscount: quote.fareBeforeDiscount,
        discount: quote.discount,
        promoId: quote.promo?.id,
        promoKind: quote.promo?.kind,
        promoTitle: quote.promo?.title,
        couponCode: quote.promo?.kind === 'coupon' ? quote.promo.code : undefined,
        commissionPercent: quote.commissionPercent,
        commissionRule: quote.commissionRule,
        commission: quote.commission,
        driverEarning: quote.driverEarning,
        vehicleType,
        goodsType,
        goodsWeight: goodsWeight ? Number(goodsWeight) : undefined,
        receiverName,
        receiverPhone,
        helpers: helperCount,
        helperCharge,
        notes: notes || undefined,
        distance: distanceTime?.distance?.value || 5400,
        duration: distanceTime?.duration?.value || 900
    })

    return ride;
}

module.exports.confirmRide = async ({
    rideId, captain
}) => {
    if (!rideId) {
        throw new Error('Ride id is required');
    }

    await rideModel.findOneAndUpdate({
        _id: rideId
    }, {
        status: 'accepted',
        captain: captain._id
    })

    const ride = await rideModel.findOne({
        _id: rideId
    }).populate('user').populate('captain').select('+otp');

    if (!ride) {
        throw new Error('Ride not found');
    }

    return ride;

}

module.exports.startRide = async ({ rideId, otp, captain }) => {
    // status lets the controller answer with 400/404 instead of a generic 500
    const fail = (message, status = 400) => Object.assign(new Error(message), { status });

    if (!rideId || !otp) {
        throw fail('Ride id and OTP are required');
    }

    // only the driver who accepted the order may start it
    const ride = await rideModel.findOne({
        _id: rideId,
        captain: captain._id
    }).populate('user').populate('captain').select('+otp');

    if (!ride) {
        throw fail('Ride not found', 404);
    }

    if (ride.status !== 'accepted') {
        throw fail('Ride not accepted');
    }

    if (ride.otp !== otp) {
        throw fail('Invalid OTP');
    }

    await rideModel.findOneAndUpdate({
        _id: rideId
    }, {
        status: 'ongoing'
    })

    return ride;
}

module.exports.endRide = async ({ rideId, captain }) => {
    if (!rideId) {
        throw new Error('Ride id is required')
    }

    const ride = await rideModel.findOne({
        _id: rideId,
        captain: captain._id
    }).populate('user').populate('captain').select('+otp')

    if (!ride) {
        throw new Error('Ride not found')
    }

    if (ride.status !== 'ongoing') {
        throw new Error('Ride not ongoing')
    }

    // Not paid online -> the captain finishing the ride confirms the cash was collected
    const payment = {}
    if (ride.paymentStatus !== 'paid') {
        const { allowCash, online } = await paymentService.getConfig()
        if (online && !allowCash) {
            throw new Error('The rider has not paid online yet')
        }
        Object.assign(payment, { paymentMethod: 'cash', paymentStatus: 'paid', paidAt: new Date() })
    }

    // Use findOneAndUpdate with timestamps option to ensure updatedAt is set
    await rideModel.findOneAndUpdate(
        { _id: rideId },
        { status: 'completed', completedAt: new Date(), ...payment },
        { new: true, timestamps: true }
    )

    return ride
}

module.exports.cancelRide = async ({ rideId, userId }) => {
    if (!rideId) {
        throw new Error('Ride id is required');
    }

    const ride = await rideModel.findOne({
        _id: rideId,
        user: userId,
        status: { $in: ['pending', 'accepted'] }
    }).populate('user').populate('captain');

    if (!ride) {
        throw new Error('Ride not found or cannot be cancelled');
    }

    await rideModel.findOneAndUpdate(
        { _id: rideId },
        { status: 'cancelled', cancelledBy: 'user' }
    );

    return ride;
};


