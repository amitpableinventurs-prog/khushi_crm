// Fills the database with demo customers, drivers, goods bookings and notification logs
// so every admin section has something to show.
// Usage: npm run seed-demo            (re-running replaces the previous demo data)
//        npm run seed-demo -- --clear (only removes the demo data)
// Demo accounts all use the email domain below and the password DEMO_PASSWORD.
require('dotenv').config();
const mongoose = require('mongoose');
const userModel = require('../models/user.model');
const captainModel = require('../models/captain.model');
const rideModel = require('../models/ride.model');
const notificationLogModel = require('../models/notificationLog.model');
const settingService = require('../services/setting.service');
const { VEHICLE_BY_KEY, GOODS_TYPES } = require('../config/vehicles');

const DEMO_DOMAIN = 'demo.khushitransport.local';
const DEMO_PASSWORD = 'Demo@1234';

// Fixed seed so every run produces the same data set
let seed = 20261112;
const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
};
const pick = (list) => list[ Math.floor(rand() * list.length) ];
const between = (min, max) => min + rand() * (max - min);

const RIDERS = [
    [ 'Aarav', 'Sharma' ], [ 'Priya', 'Verma' ], [ 'Rohan', 'Gupta' ], [ 'Sneha', 'Iyer' ],
    [ 'Vikram', 'Singh' ], [ 'Ananya', 'Reddy' ], [ 'Karan', 'Mehta' ], [ 'Neha', 'Kapoor' ],
    [ 'Arjun', 'Nair' ], [ 'Pooja', 'Joshi' ], [ 'Rahul', 'Yadav' ], [ 'Kavya', 'Bansal' ],
];

const CAPTAINS = [
    [ 'Suresh', 'Kumar', 'mini_truck', 'White', 'DL 1L AB 1234' ],
    [ 'Ramesh', 'Chauhan', 'mini_truck', 'Blue', 'DL 1L CD 5678' ],
    [ 'Mahesh', 'Tiwari', 'pickup', 'White', 'HR 55 EF 9012' ],
    [ 'Imran', 'Khan', 'pickup', 'Grey', 'UP 16 GH 3456' ],
    [ 'Deepak', 'Rawat', 'three_wheeler', 'Yellow', 'DL 1L JK 7890' ],
    [ 'Gurpreet', 'Sandhu', 'three_wheeler', 'Green', 'DL 1L LM 2345' ],
    [ 'Santosh', 'Mishra', 'three_wheeler', 'Yellow', 'UP 14 NP 6789' ],
    [ 'Ajay', 'Thakur', 'two_wheeler', 'Black', 'DL 5S QR 1122' ],
    [ 'Manoj', 'Pandey', 'truck', 'Orange', 'HR 38 ST 3344' ],
    [ 'Farhan', 'Ali', 'two_wheeler', 'Blue', 'DL 8S UV 5566' ],
];

// name, latitude, longitude
const PLACES = [
    [ 'Connaught Place, New Delhi, Delhi', 28.6315, 77.2167 ],
    [ 'Indira Gandhi International Airport, New Delhi, Delhi', 28.5562, 77.1000 ],
    [ 'Hauz Khas Village, New Delhi, Delhi', 28.5535, 77.1942 ],
    [ 'Karol Bagh, New Delhi, Delhi', 28.6514, 77.1907 ],
    [ 'Saket Select Citywalk, New Delhi, Delhi', 28.5286, 77.2190 ],
    [ 'Lajpat Nagar Central Market, New Delhi, Delhi', 28.5677, 77.2433 ],
    [ 'New Delhi Railway Station, New Delhi, Delhi', 28.6429, 77.2191 ],
    [ 'Cyber Hub, DLF Cyber City, Gurugram, Haryana', 28.4950, 77.0890 ],
    [ 'Sector 18 Market, Noida, Uttar Pradesh', 28.5708, 77.3261 ],
    [ 'Dwarka Sector 21 Metro Station, New Delhi, Delhi', 28.5523, 77.0583 ],
    [ 'Chandni Chowk, Old Delhi, Delhi', 28.6506, 77.2303 ],
    [ 'Nehru Place, New Delhi, Delhi', 28.5494, 77.2517 ],
    [ 'Rajouri Garden, New Delhi, Delhi', 28.6415, 77.1209 ],
    [ 'Anand Vihar ISBT, Delhi', 28.6469, 77.3160 ],
];

const CANCEL_REASONS = [ 'Customer not reachable', 'Duplicate booking', 'Driver vehicle breakdown', 'Wrong pickup location' ];
const RECEIVERS = [ 'Amit Arora', 'Sunita Devi', 'Rajesh Traders', 'Meena Stores', 'Harish Electricals', 'Nisha Furnishings', 'Gupta Hardware', 'Shree Garments' ];

const kmBetween = ([ , lat1, lng1 ], [ , lat2, lng2 ]) => {
    const rad = (deg) => deg * Math.PI / 180;
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
        + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(a)) * 1.35; // road distance is longer than the straight line
};

const demoEmail = (first, last) => `${first}.${last}@${DEMO_DOMAIN}`.toLowerCase();
const demoFilter = { email: new RegExp(`@${DEMO_DOMAIN.replace(/\./g, '\\.')}$`) };

async function clearDemoData() {
    const [ users, captains ] = await Promise.all([
        userModel.find(demoFilter).select('_id').lean(),
        captainModel.find(demoFilter).select('_id').lean(),
    ]);
    const userIds = users.map((u) => u._id);
    const captainIds = captains.map((c) => c._id);
    const rides = await rideModel.find({ user: { $in: userIds } }).select('_id').lean();

    await notificationLogModel.deleteMany({
        $or: [ { ride: { $in: rides.map((r) => r._id) } }, { recipientId: { $in: [ ...userIds, ...captainIds ] } } ],
    });
    await rideModel.deleteMany({ user: { $in: userIds } });
    await userModel.deleteMany({ _id: { $in: userIds } });
    await captainModel.deleteMany({ _id: { $in: captainIds } });
    return { users: userIds.length, captains: captainIds.length, rides: rides.length };
}

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);

    const removed = await clearDemoData();
    console.log(`Removed old demo data: ${removed.users} customers, ${removed.captains} drivers, ${removed.rides} bookings`);
    if (process.argv.includes('--clear')) return mongoose.disconnect();

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const password = await userModel.hashPassword(DEMO_PASSWORD);

    const users = await userModel.insertMany(RIDERS.map(([ firstname, lastname ], i) => {
        const joined = new Date(now - between(5, 60) * DAY);
        return {
            fullname: { firstname, lastname },
            email: demoEmail(firstname, lastname),
            password,
            phone: `+9190000001${String(i).padStart(2, '0')}`,
            isBlocked: i === RIDERS.length - 1,
            createdAt: joined,
            updatedAt: joined,
        };
    }), { timestamps: false });

    const captains = await captainModel.insertMany(CAPTAINS.map(([ firstname, lastname, vehicleType, color, plate ], i) => {
        const joined = new Date(now - between(10, 75) * DAY);
        const base = pick(PLACES);
        return {
            fullname: { firstname, lastname },
            email: demoEmail(firstname, lastname),
            password,
            phone: `+9190000002${String(i).padStart(2, '0')}`,
            isBlocked: i === 6,
            status: i === 6 || i === 9 ? 'inactive' : 'active',
            vehicle: { color, plate, capacity: VEHICLE_BY_KEY[ vehicleType ].capacityKg, vehicleType },
            location: { ltd: base[ 1 ] + between(-0.01, 0.01), lng: base[ 2 ] + between(-0.01, 0.01) },
            createdAt: joined,
            updatedAt: joined,
        };
    }), { timestamps: false });

    const fares = await settingService.getFareSettings();
    // Saved so the Fares page shows stored values rather than built-in defaults
    await settingService.updateFareSettings(fares);

    const captainsFor = (rideType) => captains.filter((c) => !c.isBlocked && c.vehicle.vehicleType === rideType);

    const buildRide = (status, createdAt) => {
        const from = pick(PLACES);
        let to = pick(PLACES);
        while (to === from) to = pick(PLACES);
        const vehicleType = pick([ 'two_wheeler', 'three_wheeler', 'three_wheeler', 'mini_truck', 'mini_truck', 'pickup', 'pickup', 'truck' ]);
        const km = kmBetween(from, to);
        const minutes = km * between(2.2, 3.4);
        const rate = fares[ vehicleType ];
        const capacityKg = VEHICLE_BY_KEY[ vehicleType ].capacityKg;
        const helpers = vehicleType === 'two_wheeler' ? 0 : pick([ 0, 0, 1, 1, 2 ]);
        const helperCharge = helpers * fares.helperCharge;
        const ride = {
            user: pick(users.filter((u) => !u.isBlocked))._id,
            pickup: from[ 0 ],
            destination: to[ 0 ],
            vehicleType,
            distance: Math.round(km * 1000),
            duration: Math.round(minutes * 60),
            fare: Math.round(rate.baseFare + km * rate.perKm + minutes * rate.perMinute) + helperCharge,
            goodsType: vehicleType === 'two_wheeler' ? 'Documents / Parcels' : pick(GOODS_TYPES.slice(0, 6)),
            goodsWeight: Math.max(1, Math.round(between(0.15, 0.9) * capacityKg)),
            receiverName: pick(RECEIVERS),
            receiverPhone: `+9190000003${String(Math.floor(between(0, 100))).padStart(2, '0')}`,
            helpers,
            helperCharge,
            otp: String(Math.floor(between(100000, 999999))),
            status,
            paymentStatus: 'pending',
            createdAt,
            updatedAt: createdAt,
        };
        if (status !== 'pending') ride.captain = pick(captainsFor(vehicleType))._id;

        if (status === 'completed') {
            ride.completedAt = new Date(createdAt.getTime() + (minutes + between(4, 12)) * 60 * 1000);
            ride.updatedAt = ride.completedAt;
            ride.paymentMethod = rand() < 0.45 ? 'online' : 'cash';
            ride.paymentStatus = 'paid';
            ride.paidAt = ride.completedAt;
            if (ride.paymentMethod === 'online') {
                const ref = Math.floor(between(1e9, 9e9));
                ride.orderId = `order_DEMO${ref}`;
                ride.paymentID = `pay_DEMO${ref}`;
            }
        }
        if (status === 'cancelled') {
            ride.cancelledBy = rand() < 0.7 ? 'user' : 'admin';
            ride.cancelReason = ride.cancelledBy === 'admin' ? pick(CANCEL_REASONS) : 'Cancelled by customer';
            if (rand() < 0.5) delete ride.captain;
            ride.updatedAt = new Date(createdAt.getTime() + between(1, 8) * 60 * 1000);
        }
        return ride;
    };

    const rideDocs = [];
    // 30 days of history, busier on recent days so the charts have a shape
    for (let day = 29; day >= 0; day--) {
        const count = Math.round(between(1, 3) + (29 - day) / 10);
        for (let n = 0; n < count; n++) {
            const createdAt = new Date(now - day * DAY - between(0.5, 14) * 60 * 60 * 1000);
            if (createdAt.getTime() > now - 2 * 60 * 60 * 1000) continue;
            rideDocs.push(buildRide(rand() < 0.82 ? 'completed' : 'cancelled', createdAt));
        }
    }
    // A few rides in progress for the Live page
    rideDocs.push(buildRide('pending', new Date(now - 2 * 60 * 1000)));
    rideDocs.push(buildRide('pending', new Date(now - 4 * 60 * 1000)));
    rideDocs.push(buildRide('accepted', new Date(now - 7 * 60 * 1000)));
    rideDocs.push(buildRide('ongoing', new Date(now - 18 * 60 * 1000)));
    rideDocs.push(buildRide('ongoing', new Date(now - 25 * 60 * 1000)));

    // One refunded online ride for the refund column
    const refundable = rideDocs.find((r) => r.status === 'completed' && r.paymentMethod === 'online');
    if (refundable) {
        refundable.paymentStatus = 'refunded';
        refundable.refundId = `rfnd_DEMO${Math.floor(between(1e9, 9e9))}`;
        refundable.refundedAt = new Date(refundable.completedAt.getTime() + 3 * 60 * 60 * 1000);
    }

    const rides = await rideModel.insertMany(rideDocs, { timestamps: false });

    const userById = new Map(users.map((u) => [ String(u._id), u ]));
    const captainById = new Map(captains.map((c) => [ String(c._id), c ]));
    const personName = (p) => `${p.fullname.firstname} ${p.fullname.lastname}`;

    const logs = [];
    const log = (ride, event, channel, at) => {
        const isRider = event.startsWith('rider.');
        const person = isRider ? userById.get(String(ride.user)) : captainById.get(String(ride.captain));
        if (!person) return;
        const roll = rand();
        const status = roll < 0.7 ? 'sent' : roll < 0.85 ? 'failed' : 'skipped';
        logs.push({
            event,
            channel,
            recipientType: isRider ? 'rider' : 'captain',
            recipientId: person._id,
            recipientName: personName(person),
            to: channel === 'email' ? person.email : channel === 'push' ? 'browser' : person.phone,
            status,
            detail: status === 'sent' ? 'Demo entry' : status === 'failed' ? 'Demo entry: provider rejected the message' : 'Demo entry: channel not configured',
            ride: ride._id,
            createdAt: at,
        });
    };
    // Logs expire after 30 days, so only recent rides get them
    for (const ride of rides.filter((r) => r.createdAt.getTime() > now - 10 * DAY)) {
        if (ride.status === 'completed') {
            log(ride, 'rider.ride_accepted', pick([ 'sms', 'push' ]), ride.createdAt);
            log(ride, 'rider.ride_completed', 'email', ride.completedAt);
            log(ride, 'captain.ride_completed', pick([ 'push', 'whatsapp' ]), ride.completedAt);
            if (ride.paymentMethod === 'online') log(ride, 'captain.payment_received', 'sms', ride.completedAt);
        } else if (ride.status === 'cancelled') {
            log(ride, ride.cancelledBy === 'admin' ? 'rider.ride_cancelled_by_admin' : 'captain.ride_cancelled_by_rider', pick([ 'sms', 'email' ]), ride.updatedAt);
        } else if (ride.status === 'ongoing') {
            log(ride, 'rider.ride_started', 'push', ride.createdAt);
        } else if (ride.status === 'accepted') {
            log(ride, 'rider.ride_accepted', 'sms', ride.createdAt);
        }
    }
    await notificationLogModel.insertMany(logs);

    const byStatus = rides.reduce((acc, r) => ({ ...acc, [ r.status ]: (acc[ r.status ] || 0) + 1 }), {});
    console.log(`Added ${users.length} customers, ${captains.length} drivers, ${rides.length} bookings, ${logs.length} notification logs`);
    console.log('Bookings by status:', JSON.stringify(byStatus));
    console.log(`Demo login: any <first>.<last>@${DEMO_DOMAIN} with password ${DEMO_PASSWORD}`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
