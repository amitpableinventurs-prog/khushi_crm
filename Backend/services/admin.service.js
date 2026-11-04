const mongoose = require('mongoose');
const rideModel = require('../models/ride.model');
const userModel = require('../models/user.model');
const captainModel = require('../models/captain.model');

// Reports group by Indian calendar days
const TZ = 'Asia/Kolkata';
const TZ_OFFSET = '+05:30';
const DAY_MS = 24 * 60 * 60 * 1000;

const RIDE_STATUSES = [ 'pending', 'accepted', 'ongoing', 'completed', 'cancelled' ];
const ACTIVE_STATUSES = [ 'pending', 'accepted', 'ongoing' ];

// a completed ride counts on the day it was completed
const completedDate = { $ifNull: [ '$completedAt', '$updatedAt' ] };

const toDayKey = (date) => new Date(date).toLocaleDateString('en-CA', { timeZone: TZ });

module.exports.RIDE_STATUSES = RIDE_STATUSES;
module.exports.ACTIVE_STATUSES = ACTIVE_STATUSES;
module.exports.toDayKey = toDayKey;

// 'YYYY-MM-DD' strings (inclusive) -> Date range; defaults to the last `fallbackDays` days
module.exports.parseRange = (from, to, fallbackDays = 30) => {
    const end = to ? new Date(`${to}T23:59:59.999${TZ_OFFSET}`) : new Date(`${toDayKey(new Date())}T23:59:59.999${TZ_OFFSET}`);
    const start = from ? new Date(`${from}T00:00:00${TZ_OFFSET}`) : new Date(end.getTime() - fallbackDays * DAY_MS + 1);
    return { start, end };
}

module.exports.startOfToday = () => new Date(`${toDayKey(new Date())}T00:00:00${TZ_OFFSET}`);

module.exports.escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports.getPagination = (query) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
}

module.exports.paginated = (items, total, { page, limit }) => ({
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
});

// Per-person ride stats, keyed by id; `field` is 'captain' or 'user'
module.exports.getRideStatsFor = async (field, ids) => {
    if (!ids.length) return {};

    const todayStart = module.exports.startOfToday();
    const stats = await rideModel.aggregate([
        { $match: { [ field ]: { $in: ids.map(id => new mongoose.Types.ObjectId(String(id))) } } },
        {
            $group: {
                _id: `$${field}`,
                totalRides: { $sum: 1 },
                completedRides: { $sum: { $cond: [ { $eq: [ '$status', 'completed' ] }, 1, 0 ] } },
                cancelledRides: { $sum: { $cond: [ { $eq: [ '$status', 'cancelled' ] }, 1, 0 ] } },
                totalFare: { $sum: { $cond: [ { $eq: [ '$status', 'completed' ] }, '$fare', 0 ] } },
                todayRides: {
                    $sum: { $cond: [ { $and: [ { $eq: [ '$status', 'completed' ] }, { $gte: [ completedDate, todayStart ] } ] }, 1, 0 ] }
                },
                todayFare: {
                    $sum: { $cond: [ { $and: [ { $eq: [ '$status', 'completed' ] }, { $gte: [ completedDate, todayStart ] } ] }, '$fare', 0 ] }
                },
                lastRideAt: { $max: '$createdAt' },
            }
        }
    ]);

    return Object.fromEntries(stats.map(s => [ String(s._id), s ]));
}

const emptyStats = { totalRides: 0, completedRides: 0, cancelledRides: 0, totalFare: 0, todayRides: 0, todayFare: 0, lastRideAt: null };
module.exports.emptyStats = emptyStats;

// Everything the Reports page (and the dashboard chart) needs for one date range
module.exports.buildReport = async ({ start, end }) => {
    const createdInRange = { createdAt: { $gte: start, $lte: end } };
    const completedInRange = {
        status: 'completed',
        $expr: { $and: [ { $gte: [ completedDate, start ] }, { $lte: [ completedDate, end ] } ] },
    };

    const [ createdByDay, completedByDay, byStatus, byVehicle, topCaptains, topRiders, cancellations, newUsers, newCaptains ] = await Promise.all([
        rideModel.aggregate([
            { $match: createdInRange },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, rides: { $sum: 1 } } },
        ]),
        rideModel.aggregate([
            { $match: completedInRange },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: completedDate, timezone: TZ } },
                    completed: { $sum: 1 },
                    revenue: { $sum: '$fare' },
                    distance: { $sum: { $ifNull: [ '$distance', 0 ] } },
                }
            },
        ]),
        rideModel.aggregate([
            { $match: createdInRange },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        rideModel.aggregate([
            { $match: completedInRange },
            { $group: { _id: { $ifNull: [ '$vehicleType', 'unknown' ] }, rides: { $sum: 1 }, revenue: { $sum: '$fare' } } },
            { $sort: { revenue: -1 } },
        ]),
        rideModel.aggregate([
            { $match: { ...completedInRange, captain: { $ne: null } } },
            { $group: { _id: '$captain', rides: { $sum: 1 }, revenue: { $sum: '$fare' } } },
            { $sort: { revenue: -1 } },
            { $limit: 10 },
            { $lookup: { from: 'captains', localField: '_id', foreignField: '_id', as: 'captain' } },
            { $project: { rides: 1, revenue: 1, captain: { $arrayElemAt: [ '$captain', 0 ] } } },
            { $project: { rides: 1, revenue: 1, 'captain._id': 1, 'captain.fullname': 1, 'captain.email': 1, 'captain.vehicle': 1 } },
        ]),
        rideModel.aggregate([
            { $match: completedInRange },
            { $group: { _id: '$user', rides: { $sum: 1 }, spent: { $sum: '$fare' } } },
            { $sort: { spent: -1 } },
            { $limit: 10 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $project: { rides: 1, spent: 1, user: { $arrayElemAt: [ '$user', 0 ] } } },
            { $project: { rides: 1, spent: 1, 'user._id': 1, 'user.fullname': 1, 'user.email': 1 } },
        ]),
        rideModel.aggregate([
            { $match: { ...createdInRange, status: 'cancelled' } },
            { $group: { _id: { $ifNull: [ '$cancelledBy', 'user' ] }, count: { $sum: 1 } } },
        ]),
        userModel.countDocuments(createdInRange),
        captainModel.countDocuments(createdInRange),
    ]);

    const createdMap = Object.fromEntries(createdByDay.map(d => [ d._id, d.rides ]));
    const completedMap = Object.fromEntries(completedByDay.map(d => [ d._id, d ]));

    const daily = [];
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
        const date = toDayKey(t);
        if (daily.length && daily[ daily.length - 1 ].date === date) continue;
        daily.push({
            date,
            rides: createdMap[ date ] || 0,
            completed: completedMap[ date ]?.completed || 0,
            revenue: completedMap[ date ]?.revenue || 0,
        });
    }

    const statusCounts = Object.fromEntries(RIDE_STATUSES.map(s => [ s, 0 ]));
    byStatus.forEach(s => { statusCounts[ s._id ] = s.count; });

    const revenue = completedByDay.reduce((sum, d) => sum + d.revenue, 0);
    const completed = completedByDay.reduce((sum, d) => sum + d.completed, 0);
    const distanceMeters = completedByDay.reduce((sum, d) => sum + d.distance, 0);
    const finished = statusCounts.completed + statusCounts.cancelled;

    return {
        range: { from: toDayKey(start), to: toDayKey(end) },
        summary: {
            ridesRequested: Object.values(statusCounts).reduce((a, b) => a + b, 0),
            ridesCompleted: completed,
            ridesCancelled: statusCounts.cancelled,
            revenue,
            averageFare: completed ? Math.round(revenue / completed) : 0,
            totalDistanceKm: Math.round(distanceMeters / 100) / 10,
            completionRate: finished ? Math.round((statusCounts.completed / finished) * 100) : null,
            newUsers,
            newCaptains,
        },
        daily,
        byStatus: statusCounts,
        byVehicle: byVehicle.map(v => ({ vehicleType: v._id, rides: v.rides, revenue: v.revenue })),
        cancellations: Object.fromEntries(cancellations.map(c => [ c._id, c.count ])),
        topCaptains,
        topRiders,
    };
}
