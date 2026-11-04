const adminModel = require('../models/admin.model');
const userModel = require('../models/user.model');
const captainModel = require('../models/captain.model');
const rideModel = require('../models/ride.model');
const blackListTokenModel = require('../models/blackListToken.model');
const adminService = require('../services/admin.service');
const settingService = require('../services/setting.service');
const { sendMessageToSocketId } = require('../socket');
const notificationService = require('../services/notification.service');
const notificationLogModel = require('../models/notificationLog.model');
const paymentService = require('../services/payment.service');
const twilioService = require('../services/twilio.service');
const fcmService = require('../services/fcm.service');
const { validationResult } = require('express-validator');

const { RIDE_STATUSES, ACTIVE_STATUSES, escapeRegex, getPagination, paginated } = adminService;

const USER_FIELDS = 'fullname email phone isBlocked createdAt';
const CAPTAIN_FIELDS = 'fullname email phone status isBlocked vehicle location createdAt';

const validate = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array(), message: errors.array()[ 0 ]?.msg });
        return false;
    }
    return true;
}

// Wraps a handler so unexpected errors become a 500 JSON response
const handle = (fn) => async (req, res) => {
    try {
        if (!validate(req, res)) return;
        await fn(req, res);
    } catch (err) {
        console.error('Admin API error:', err);
        if (!res.headersSent) {
            res.status(500).json({ message: err.message || 'Something went wrong' });
        }
    }
}

const populateRide = (query) => query
    .populate('user', 'fullname email')
    .populate('captain', 'fullname email vehicle');

// ---------- Auth & admin accounts ----------

module.exports.loginAdmin = handle(async (req, res) => {
    const { email, password } = req.body;
    const admin = await adminModel.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!admin || !(await admin.comparePassword(password))) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = admin.generateAuthToken();
    admin.password = undefined;

    res.status(200).json({ token, admin });
});

module.exports.getAdminProfile = handle(async (req, res) => {
    res.status(200).json(req.admin);
});

module.exports.updateAdminProfile = handle(async (req, res) => {
    const admin = await adminModel.findByIdAndUpdate(req.admin._id, { fullname: req.body.fullname.trim() }, { new: true });
    res.status(200).json(admin);
});

module.exports.changePassword = handle(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const admin = await adminModel.findById(req.admin._id).select('+password');

    if (!(await admin.comparePassword(currentPassword))) {
        return res.status(400).json({ message: 'Current password is incorrect' });
    }

    admin.password = await adminModel.hashPassword(newPassword);
    await admin.save();

    res.status(200).json({ message: 'Password updated' });
});

module.exports.logoutAdmin = handle(async (req, res) => {
    await blackListTokenModel.create({ token: req.token });
    res.status(200).json({ message: 'Logged out' });
});

module.exports.listAdmins = handle(async (req, res) => {
    const admins = await adminModel.find().sort({ _id: 1 });
    res.status(200).json(admins);
});

module.exports.createAdmin = handle(async (req, res) => {
    const email = req.body.email.toLowerCase().trim();

    if (await adminModel.findOne({ email })) {
        return res.status(400).json({ message: 'An admin with this email already exists' });
    }

    const admin = await adminModel.create({
        fullname: req.body.fullname.trim(),
        email,
        password: await adminModel.hashPassword(req.body.password),
    });
    admin.password = undefined;

    res.status(201).json(admin);
});

module.exports.deleteAdmin = handle(async (req, res) => {
    if (String(req.params.id) === String(req.admin._id)) {
        return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    if (await adminModel.countDocuments() <= 1) {
        return res.status(400).json({ message: 'At least one admin must remain' });
    }

    const admin = await adminModel.findByIdAndDelete(req.params.id);
    if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
    }

    res.status(200).json({ message: 'Admin deleted' });
});

// ---------- Dashboard & live ----------

module.exports.getDashboard = handle(async (req, res) => {
    const days = [ 7, 30, 90 ].includes(Number(req.query.days)) ? Number(req.query.days) : 7;
    const todayStart = adminService.startOfToday();

    const [ report, today, totalUsers, blockedUsers, totalCaptains, onlineCaptains, blockedCaptains, allTimeStatus, allTimeRevenue, recentRides ] = await Promise.all([
        adminService.buildReport(adminService.parseRange(null, null, days)),
        adminService.buildReport({ start: todayStart, end: new Date() }),
        userModel.countDocuments(),
        userModel.countDocuments({ isBlocked: true }),
        captainModel.countDocuments(),
        captainModel.countDocuments({ status: 'active', isBlocked: { $ne: true } }),
        captainModel.countDocuments({ isBlocked: true }),
        rideModel.aggregate([ { $group: { _id: '$status', count: { $sum: 1 } } } ]),
        rideModel.aggregate([ { $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$fare' }, count: { $sum: 1 } } } ]),
        populateRide(rideModel.find().sort({ createdAt: -1 }).limit(8)),
    ]);

    const ridesByStatus = Object.fromEntries(RIDE_STATUSES.map(s => [ s, 0 ]));
    allTimeStatus.forEach(s => { ridesByStatus[ s._id ] = s.count; });

    res.status(200).json({
        days,
        users: { total: totalUsers, blocked: blockedUsers },
        captains: { total: totalCaptains, online: onlineCaptains, blocked: blockedCaptains },
        rides: {
            total: Object.values(ridesByStatus).reduce((a, b) => a + b, 0),
            active: ACTIVE_STATUSES.reduce((sum, s) => sum + ridesByStatus[ s ], 0),
            byStatus: ridesByStatus,
        },
        revenue: {
            total: allTimeRevenue[ 0 ]?.total || 0,
            completedRides: allTimeRevenue[ 0 ]?.count || 0,
        },
        today: today.summary,
        period: report,
        recentRides,
    });
});

module.exports.getLive = handle(async (req, res) => {
    const [ activeRides, onlineCaptains ] = await Promise.all([
        populateRide(rideModel.find({ status: { $in: ACTIVE_STATUSES } }).sort({ createdAt: -1 })),
        captainModel.find({ status: 'active', isBlocked: { $ne: true } }).select(CAPTAIN_FIELDS + ' updatedAt').sort({ updatedAt: -1 }),
    ]);

    const busy = new Set(activeRides.filter(r => r.captain && r.status !== 'pending').map(r => String(r.captain._id)));

    res.status(200).json({
        activeRides,
        onlineCaptains: onlineCaptains.map(c => ({ ...c.toObject(), isBusy: busy.has(String(c._id)) })),
        generatedAt: new Date(),
    });
});

// ---------- Rides ----------

const buildRideFilter = async (query) => {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.vehicleType) filter.vehicleType = query.vehicleType;
    if (query.user) filter.user = query.user;
    if (query.captain) filter.captain = query.captain;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
    if (query.from || query.to) {
        const { start, end } = adminService.parseRange(query.from, query.to, 36500);
        filter.createdAt = { $gte: start, $lte: end };
    }

    if (query.search?.trim()) {
        const regex = new RegExp(escapeRegex(query.search.trim()), 'i');
        const personMatch = { $or: [ { email: regex }, { phone: regex }, { 'fullname.firstname': regex }, { 'fullname.lastname': regex } ] };
        const [ users, captains ] = await Promise.all([
            userModel.find(personMatch).select('_id').limit(200),
            captainModel.find({ $or: [ ...personMatch.$or, { 'vehicle.plate': regex } ] }).select('_id').limit(200),
        ]);
        filter.$or = [
            { pickup: regex },
            { destination: regex },
            { user: { $in: users.map(u => u._id) } },
            { captain: { $in: captains.map(c => c._id) } },
        ];
    }

    return filter;
}

module.exports.listRides = handle(async (req, res) => {
    const pagination = getPagination(req.query);
    const filter = await buildRideFilter(req.query);

    const [ items, total ] = await Promise.all([
        populateRide(rideModel.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit)),
        rideModel.countDocuments(filter),
    ]);

    res.status(200).json(paginated(items, total, pagination));
});

const csvCell = (value) => {
    const text = value === undefined || value === null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const personName = (p) => p ? [ p.fullname?.firstname, p.fullname?.lastname ].filter(Boolean).join(' ') : '';

module.exports.exportRides = handle(async (req, res) => {
    const filter = await buildRideFilter(req.query);
    const rides = await populateRide(rideModel.find(filter).sort({ createdAt: -1 }).limit(5000));

    const header = [ 'Ride ID', 'Created', 'Completed', 'Status', 'Vehicle', 'Rider', 'Rider email', 'Captain', 'Captain email', 'Plate', 'Pickup', 'Destination', 'Distance (km)', 'Duration (min)', 'Fare (INR)', 'Payment method', 'Payment status', 'Razorpay payment ID', 'Cancelled by', 'Cancel reason' ];
    const rows = rides.map(r => [
        r._id,
        r.createdAt?.toISOString(),
        r.completedAt?.toISOString(),
        r.status,
        r.vehicleType,
        personName(r.user),
        r.user?.email,
        personName(r.captain),
        r.captain?.email,
        r.captain?.vehicle?.plate,
        r.pickup,
        r.destination,
        r.distance ? (r.distance / 1000).toFixed(1) : '',
        r.duration ? Math.round(r.duration / 60) : '',
        r.fare,
        r.paymentMethod,
        r.paymentStatus,
        r.paymentID,
        r.cancelledBy,
        r.cancelReason,
    ]);

    const csv = [ header, ...rows ].map(row => row.map(csvCell).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rides-${adminService.toDayKey(new Date())}.csv"`);
    res.status(200).send('﻿' + csv);
});

module.exports.getRide = handle(async (req, res) => {
    const ride = await populateRide(rideModel.findById(req.params.id));
    if (!ride) {
        return res.status(404).json({ message: 'Ride not found' });
    }
    res.status(200).json(ride);
});

module.exports.cancelRide = handle(async (req, res) => {
    const ride = await rideModel.findOneAndUpdate(
        { _id: req.params.id, status: { $in: ACTIVE_STATUSES } },
        { status: 'cancelled', cancelledBy: 'admin', cancelReason: req.body.reason?.trim() || 'Cancelled by admin' },
        { new: true }
    ).populate('user').populate('captain');

    if (!ride) {
        return res.status(400).json({ message: 'Ride not found or already finished' });
    }

    const payload = { event: 'ride-cancelled', data: { rideId: ride._id, cancelledBy: 'admin', reason: ride.cancelReason } };
    if (ride.user?.socketId) sendMessageToSocketId(ride.user.socketId, payload);
    if (ride.captain?.socketId) sendMessageToSocketId(ride.captain.socketId, payload);
    notificationService.notify('rider.ride_cancelled_by_admin', { rideId: ride._id });
    if (ride.captain) notificationService.notify('captain.ride_cancelled_by_admin', { rideId: ride._id });

    res.status(200).json(await populateRide(rideModel.findById(ride._id)));
});

// ---------- Captains ----------

module.exports.listCaptains = handle(async (req, res) => {
    const pagination = getPagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.vehicleType) filter[ 'vehicle.vehicleType' ] = req.query.vehicleType;
    if (req.query.blocked === 'true') filter.isBlocked = true;
    if (req.query.blocked === 'false') filter.isBlocked = { $ne: true };
    if (req.query.search?.trim()) {
        const regex = new RegExp(escapeRegex(req.query.search.trim()), 'i');
        filter.$or = [ { email: regex }, { phone: regex }, { 'fullname.firstname': regex }, { 'fullname.lastname': regex }, { 'vehicle.plate': regex } ];
    }

    const [ captains, total ] = await Promise.all([
        captainModel.find(filter).select(CAPTAIN_FIELDS).sort({ _id: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
        captainModel.countDocuments(filter),
    ]);
    const stats = await adminService.getRideStatsFor('captain', captains.map(c => c._id));

    res.status(200).json(paginated(
        captains.map(c => ({ ...c, stats: stats[ String(c._id) ] || adminService.emptyStats })),
        total,
        pagination
    ));
});

module.exports.getCaptain = handle(async (req, res) => {
    const captain = await captainModel.findById(req.params.id).select(CAPTAIN_FIELDS + ' updatedAt').lean();
    if (!captain) {
        return res.status(404).json({ message: 'Captain not found' });
    }

    const [ stats, recentRides ] = await Promise.all([
        adminService.getRideStatsFor('captain', [ captain._id ]),
        populateRide(rideModel.find({ captain: captain._id }).sort({ createdAt: -1 }).limit(20)),
    ]);

    res.status(200).json({ ...captain, stats: stats[ String(captain._id) ] || adminService.emptyStats, recentRides });
});

module.exports.updateCaptain = handle(async (req, res) => {
    const { fullname, email, vehicle, status, phone } = req.body;
    const update = {};

    if (fullname?.firstname !== undefined) update[ 'fullname.firstname' ] = fullname.firstname.trim();
    if (fullname?.lastname !== undefined) update[ 'fullname.lastname' ] = fullname.lastname.trim();
    if (phone !== undefined) update.phone = phone.trim();
    if (status) update.status = status;
    if (vehicle) {
        [ 'color', 'plate', 'capacity', 'vehicleType' ].forEach(key => {
            if (vehicle[ key ] !== undefined) update[ `vehicle.${key}` ] = vehicle[ key ];
        });
    }
    if (email) {
        const cleanEmail = email.toLowerCase().trim();
        if (await captainModel.findOne({ email: cleanEmail, _id: { $ne: req.params.id } })) {
            return res.status(400).json({ message: 'Another captain already uses this email' });
        }
        update.email = cleanEmail;
    }

    const captain = await captainModel.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select(CAPTAIN_FIELDS);
    if (!captain) {
        return res.status(404).json({ message: 'Captain not found' });
    }
    res.status(200).json(captain);
});

module.exports.setCaptainBlocked = handle(async (req, res) => {
    const blocked = Boolean(req.body.blocked);
    const update = blocked ? { isBlocked: true, status: 'inactive' } : { isBlocked: false };

    const captain = await captainModel.findByIdAndUpdate(req.params.id, update, { new: true }).select(CAPTAIN_FIELDS);
    if (!captain) {
        return res.status(404).json({ message: 'Captain not found' });
    }
    res.status(200).json(captain);
});

module.exports.deleteCaptain = handle(async (req, res) => {
    if (await rideModel.exists({ captain: req.params.id, status: { $in: [ 'accepted', 'ongoing' ] } })) {
        return res.status(400).json({ message: 'This captain has an active ride. Cancel or finish it first.' });
    }

    const captain = await captainModel.findByIdAndDelete(req.params.id);
    if (!captain) {
        return res.status(404).json({ message: 'Captain not found' });
    }
    res.status(200).json({ message: 'Captain deleted' });
});

// ---------- Riders (users) ----------

module.exports.listUsers = handle(async (req, res) => {
    const pagination = getPagination(req.query);
    const filter = {};
    if (req.query.blocked === 'true') filter.isBlocked = true;
    if (req.query.blocked === 'false') filter.isBlocked = { $ne: true };
    if (req.query.search?.trim()) {
        const regex = new RegExp(escapeRegex(req.query.search.trim()), 'i');
        filter.$or = [ { email: regex }, { phone: regex }, { 'fullname.firstname': regex }, { 'fullname.lastname': regex } ];
    }

    const [ users, total ] = await Promise.all([
        userModel.find(filter).select(USER_FIELDS).sort({ _id: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
        userModel.countDocuments(filter),
    ]);
    const stats = await adminService.getRideStatsFor('user', users.map(u => u._id));

    res.status(200).json(paginated(
        users.map(u => ({ ...u, stats: stats[ String(u._id) ] || adminService.emptyStats })),
        total,
        pagination
    ));
});

module.exports.getUser = handle(async (req, res) => {
    const user = await userModel.findById(req.params.id).select(USER_FIELDS + ' updatedAt').lean();
    if (!user) {
        return res.status(404).json({ message: 'Rider not found' });
    }

    const [ stats, recentRides ] = await Promise.all([
        adminService.getRideStatsFor('user', [ user._id ]),
        populateRide(rideModel.find({ user: user._id }).sort({ createdAt: -1 }).limit(20)),
    ]);

    res.status(200).json({ ...user, stats: stats[ String(user._id) ] || adminService.emptyStats, recentRides });
});

module.exports.updateUser = handle(async (req, res) => {
    const { fullname, email, phone } = req.body;
    const update = {};

    if (fullname?.firstname !== undefined) update[ 'fullname.firstname' ] = fullname.firstname.trim();
    if (fullname?.lastname !== undefined) update[ 'fullname.lastname' ] = fullname.lastname.trim();
    if (phone !== undefined) update.phone = phone.trim();
    if (email) {
        const cleanEmail = email.toLowerCase().trim();
        if (await userModel.findOne({ email: cleanEmail, _id: { $ne: req.params.id } })) {
            return res.status(400).json({ message: 'Another rider already uses this email' });
        }
        update.email = cleanEmail;
    }

    const user = await userModel.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select(USER_FIELDS);
    if (!user) {
        return res.status(404).json({ message: 'Rider not found' });
    }
    res.status(200).json(user);
});

module.exports.setUserBlocked = handle(async (req, res) => {
    const user = await userModel.findByIdAndUpdate(req.params.id, { isBlocked: Boolean(req.body.blocked) }, { new: true }).select(USER_FIELDS);
    if (!user) {
        return res.status(404).json({ message: 'Rider not found' });
    }
    res.status(200).json(user);
});

module.exports.deleteUser = handle(async (req, res) => {
    if (await rideModel.exists({ user: req.params.id, status: { $in: ACTIVE_STATUSES } })) {
        return res.status(400).json({ message: 'This rider has an active ride. Cancel or finish it first.' });
    }

    const user = await userModel.findByIdAndDelete(req.params.id);
    if (!user) {
        return res.status(404).json({ message: 'Rider not found' });
    }
    res.status(200).json({ message: 'Rider deleted' });
});

// ---------- Reports & settings ----------

module.exports.getReport = handle(async (req, res) => {
    const range = adminService.parseRange(req.query.from, req.query.to, 30);
    if (range.start > range.end) {
        return res.status(400).json({ message: '"From" date must be before "To" date' });
    }
    if (range.end - range.start > 366 * 24 * 60 * 60 * 1000) {
        return res.status(400).json({ message: 'Please choose a range of one year or less' });
    }
    res.status(200).json(await adminService.buildReport(range));
});

module.exports.getFareSettings = handle(async (req, res) => {
    res.status(200).json(await settingService.getFareSettings());
});

module.exports.updateFareSettings = handle(async (req, res) => {
    const fares = Object.fromEntries(settingService.VEHICLE_TYPES.map(type => [ type, {
        baseFare: Number(req.body[ type ].baseFare),
        perKm: Number(req.body[ type ].perKm),
        perMinute: Number(req.body[ type ].perMinute),
    } ]));

    res.status(200).json(await settingService.updateFareSettings(fares));
});

// ---------- Third-party integrations ----------

const axios = require('axios');
const integrationService = require('../services/integration.service');
const emailService = require('../services/email.service');

module.exports.getIntegrations = handle(async (req, res) => {
    res.status(200).json(await integrationService.getForAdmin());
});

module.exports.updateIntegration = handle(async (req, res) => {
    const { clearSecrets = [], ...values } = req.body;
    res.status(200).json(await integrationService.update(req.params.name, values, clearSecrets));
});

const TEST_PLACE = 'Connaught Place, New Delhi';

const testers = {
    razorpay: (config) => paymentService.testCredentials(config),

    // checks the account; with a phone number in testTo it also sends a real SMS / WhatsApp
    twilio: async (config, req) => {
        const account = await twilioService.testCredentials(config);
        if (!account.ok || !req.body.testTo) return account;
        const to = twilioService.normalizePhone(req.body.testTo, config.defaultCountryCode);
        if (!to) return { ok: false, message: 'That test phone number does not look valid.' };
        const brand = (await integrationService.get('smtp')).fromName || 'Khushi Transport';
        const checks = [];
        for (const [ channel, from, label ] of [ [ 'sms', config.smsFrom, 'SMS' ], [ 'whatsapp', config.whatsappFrom, 'WhatsApp' ] ]) {
            if (!from) { checks.push({ name: label, ok: false, detail: 'No sender number set' }); continue; }
            try {
                const result = await twilioService.send(config, { to, channel, body: `${brand}: test ${label} from the admin panel.` });
                checks.push({ name: label, ok: true, detail: `Sent to ${to} (${result.status})` });
            } catch (err) {
                checks.push({ name: label, ok: false, detail: err.message });
            }
        }
        return { ok: checks.some(c => c.ok), message: account.message, checks };
    },

    firebase: (config) => fcmService.testCredentials(config),

    // Checks each Google API the app uses; they are enabled separately in Google Cloud
    googleMaps: async (config) => {
        if (!config.apiKey) return { ok: false, message: 'Enter an API key first.' };
        const key = encodeURIComponent(config.apiKey);
        const apis = [
            [ 'Geocoding API', `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(TEST_PLACE)}&key=${key}` ],
            [ 'Distance Matrix API', `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(TEST_PLACE)}&destinations=${encodeURIComponent('India Gate, New Delhi')}&key=${key}` ],
            [ 'Places API (autocomplete)', `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent('Connaught')}&key=${key}` ],
        ];
        const checks = await Promise.all(apis.map(async ([ name, url ]) => {
            try {
                const { data } = await axios.get(url, { timeout: 8000 });
                const ok = data.status === 'OK' || data.status === 'ZERO_RESULTS';
                return { name, ok, detail: ok ? 'Working' : `${data.status}${data.error_message ? ` – ${data.error_message}` : ''}` };
            } catch (err) {
                return { name, ok: false, detail: err.code === 'ECONNABORTED' ? 'Timed out' : err.message };
            }
        }));
        const allOk = checks.every(c => c.ok);
        return { ok: allOk, message: allOk ? 'All Google APIs used by the app are working.' : 'Some Google APIs are not working with this key.', checks };
    },

    openStreetMap: async (config) => {
        const started = Date.now();
        try {
            const country = config.countryCode ? `&countrycodes=${encodeURIComponent(config.countryCode)}` : '';
            const { data } = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(TEST_PLACE)}${country}&limit=1`, {
                headers: { 'User-Agent': `KhushiTransport/1.0${config.contactEmail ? ` (${config.contactEmail})` : ''}` },
                timeout: 8000,
            });
            if (!data?.length) return { ok: false, message: `No result for "${TEST_PLACE}" — check the country code.` };
            return { ok: true, message: `Found "${data[ 0 ].display_name}" in ${Date.now() - started} ms.` };
        } catch (err) {
            return { ok: false, message: `OpenStreetMap did not respond: ${err.message}` };
        }
    },

    smtp: async (config, req) => {
        if (!config.host || !config.user || !config.password) return { ok: false, message: 'Fill in host, username and password first.' };
        const transporter = emailService.createTransporter({ ...config, enabled: true });
        try {
            await transporter.verify();
        } catch (err) {
            return { ok: false, message: `Could not sign in to the mail server: ${err.message}` };
        }

        const to = req.body.testTo || req.admin.email;
        try {
            await transporter.sendMail({
                from: emailService.fromAddress(config),
                to,
                subject: `${config.fromName || 'Khushi Transport'} – test email`,
                text: 'This is a test email from the Khushi Transport admin panel. Your email settings are working.',
            });
            return { ok: true, message: `Connected and sent a test email to ${to}.` };
        } catch (err) {
            return { ok: false, message: `Signed in, but sending failed: ${err.message}` };
        }
    },
};

// Tests with the values typed in the form (even if not saved yet), falling back to saved ones
module.exports.testIntegration = handle(async (req, res) => {
    const { name } = req.params;
    const config = await integrationService.withOverrides(name, req.body.values || {});
    res.status(200).json(await testers[ name ](config, req));
});

// ---------- Payments: refunds ----------

module.exports.refundRide = handle(async (req, res) => {
    const ride = await rideModel.findById(req.params.id);
    if (!ride) {
        return res.status(404).json({ message: 'Ride not found' });
    }
    if (ride.paymentMethod !== 'online' || ride.paymentStatus !== 'paid' || !ride.paymentID) {
        return res.status(400).json({ message: 'Only rides paid online can be refunded here. Cash refunds are handled outside the app.' });
    }

    const config = await paymentService.getConfig();
    if (!config.keyId || !config.keySecret) {
        return res.status(400).json({ message: 'Razorpay keys are not set in Integrations.' });
    }

    const refund = await paymentService.refund(config, ride.paymentID);
    ride.paymentStatus = 'refunded';
    ride.refundId = refund.id;
    ride.refundedAt = new Date();
    await ride.save();

    res.status(200).json(await populateRide(rideModel.findById(ride._id)));
});

// ---------- Notifications ----------

module.exports.getNotificationSettings = handle(async (req, res) => {
    const [ rules, channels ] = await Promise.all([ notificationService.getRules(), notificationService.getChannelStatus() ]);
    res.status(200).json({
        channels,
        rules,
        events: Object.entries(notificationService.EVENTS).map(([ key, ev ]) => ({ key, audience: ev.audience, label: ev.label, description: ev.description })),
    });
});

module.exports.updateNotificationRules = handle(async (req, res) => {
    res.status(200).json({ rules: await notificationService.updateRules(req.body.rules) });
});

module.exports.listNotificationLog = handle(async (req, res) => {
    const pagination = getPagination(req.query);
    const filter = {};
    if (req.query.channel) filter.channel = req.query.channel;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.event) filter.event = req.query.event;

    const [ items, total ] = await Promise.all([
        notificationLogModel.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
        notificationLogModel.countDocuments(filter),
    ]);
    res.status(200).json(paginated(items, total, pagination));
});

module.exports.sendTestNotification = handle(async (req, res) => {
    res.status(200).json(await notificationService.sendTest(req.body.channel, req.body.to, req.admin.fullname || req.admin.email));
});
