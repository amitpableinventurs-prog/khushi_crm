const rideModel = require('../models/ride.model');
const userModel = require('../models/user.model');
const captainModel = require('../models/captain.model');
const settingModel = require('../models/setting.model');
const notificationLogModel = require('../models/notificationLog.model');
const integrationService = require('./integration.service');
const emailService = require('./email.service');
const twilioService = require('./twilio.service');
const fcmService = require('./fcm.service');

// Ride notifications over email, SMS, WhatsApp and browser push.
// Which channels fire for which event is set in Admin > Notifications.

const CHANNELS = [ 'email', 'sms', 'whatsapp', 'push' ];
const APP_URL = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

const name = (person) => person?.fullname?.firstname || 'there';
const fullName = (person) => [ person?.fullname?.firstname, person?.fullname?.lastname ].filter(Boolean).join(' ');
const money = (v) => `₹${Math.round(Number(v) || 0).toLocaleString('en-IN')}`;
const short = (place) => String(place || '').split(',')[ 0 ];
const vehicle = (captain) => [ captain?.vehicle?.color, captain?.vehicle?.vehicleType ].filter(Boolean).join(' ');
const tripRows = (ride) => [ [ 'From', ride.pickup ], [ 'To', ride.destination ], [ 'Fare', money(ride.fare) ] ];

const EVENTS = {
    'rider.ride_accepted': {
        audience: 'rider',
        label: 'Captain accepted the ride',
        description: 'Captain name, vehicle and the OTP to start the ride',
        defaults: { email: true, sms: true, whatsapp: false, push: true },
        build: ({ ride, brand }) => {
            const text = `${brand}: ${fullName(ride.captain)} (${vehicle(ride.captain)}, ${ride.captain?.vehicle?.plate}) is coming to pick you up. Share OTP ${ride.otp} with your captain to start the ride.`;
            return {
                title: 'Your captain is on the way',
                text,
                link: '/home',
                email: {
                    subject: 'Your captain is on the way',
                    lines: [ `Hi ${name(ride.user)}, ${fullName(ride.captain)} has accepted your ride.`, `Share this OTP with your captain to start the ride: ${ride.otp}` ],
                    rows: [ [ 'Captain', fullName(ride.captain) ], [ 'Vehicle', `${vehicle(ride.captain)} · ${ride.captain?.vehicle?.plate}` ], [ 'OTP', ride.otp ], ...tripRows(ride) ],
                },
            };
        },
    },
    'rider.ride_started': {
        audience: 'rider',
        label: 'Ride started',
        description: 'Sent when the captain enters the OTP',
        defaults: { email: false, sms: false, whatsapp: false, push: true },
        build: ({ ride, brand }) => ({
            title: 'Ride started',
            text: `${brand}: Your ride to ${short(ride.destination)} has started. Have a safe trip!`,
            link: '/riding',
            email: { subject: 'Your ride has started', lines: [ `Hi ${name(ride.user)}, your ride to ${ride.destination} has started. Have a safe trip!` ], rows: tripRows(ride) },
        }),
    },
    'rider.ride_completed': {
        audience: 'rider',
        label: 'Ride completed (receipt)',
        description: 'Fare, payment method and trip details',
        defaults: { email: true, sms: false, whatsapp: false, push: true },
        build: ({ ride, brand }) => {
            const method = ride.paymentMethod === 'online' ? 'paid online' : 'paid in cash';
            return {
                title: `Ride completed · ${money(ride.fare)}`,
                text: `${brand}: Your ride to ${short(ride.destination)} is complete. Fare ${money(ride.fare)} (${method}). Thank you for riding with us!`,
                link: '/home',
                email: {
                    subject: `Receipt for your ride · ${money(ride.fare)}`,
                    heading: 'Thanks for riding with us',
                    lines: [ `Hi ${name(ride.user)}, here is the receipt for your ride.` ],
                    rows: [
                        ...tripRows(ride),
                        [ 'Payment', ride.paymentMethod === 'online' ? `Online${ride.paymentID ? ` (${ride.paymentID})` : ''}` : 'Cash' ],
                        [ 'Captain', `${fullName(ride.captain)} · ${ride.captain?.vehicle?.plate || ''}` ],
                        [ 'Distance', ride.distance ? `${(ride.distance / 1000).toFixed(1)} km` : '—' ],
                        [ 'Date', new Date(ride.completedAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) ],
                    ],
                },
            };
        },
    },
    'rider.ride_cancelled_by_admin': {
        audience: 'rider',
        label: 'Ride cancelled by admin',
        description: 'Includes the reason the admin entered',
        defaults: { email: true, sms: true, whatsapp: false, push: true },
        build: ({ ride, brand }) => ({
            title: 'Your ride was cancelled',
            text: `${brand}: Your ride from ${short(ride.pickup)} was cancelled by our support team. Reason: ${ride.cancelReason || 'not given'}.`,
            link: '/home',
            email: { subject: 'Your ride was cancelled', lines: [ `Hi ${name(ride.user)}, our support team cancelled your ride.`, `Reason: ${ride.cancelReason || 'not given'}` ], rows: tripRows(ride) },
        }),
    },
    'captain.new_ride_request': {
        audience: 'captain',
        label: 'New ride request nearby',
        description: 'Sent to every available captain the request is offered to',
        defaults: { email: false, sms: false, whatsapp: false, push: true },
        build: ({ ride, brand }) => ({
            title: `New ride request · ${money(ride.fare)}`,
            text: `${brand}: New ride ${money(ride.fare)} from ${short(ride.pickup)} to ${short(ride.destination)}. Open the app to accept.`,
            link: '/captain-home',
            email: { subject: `New ride request · ${money(ride.fare)}`, lines: [ 'A new ride is waiting for a captain. Open the app to accept it.' ], rows: tripRows(ride) },
        }),
    },
    'captain.ride_cancelled_by_rider': {
        audience: 'captain',
        label: 'Rider cancelled the ride',
        description: 'Sent to the captain who accepted it',
        defaults: { email: false, sms: true, whatsapp: false, push: true },
        build: ({ ride, brand }) => ({
            title: 'Ride cancelled by rider',
            text: `${brand}: The rider cancelled the ride from ${short(ride.pickup)}. You are free for new rides.`,
            link: '/captain-home',
            email: { subject: 'Ride cancelled by rider', lines: [ 'The rider cancelled this ride. You are free for new rides.' ], rows: tripRows(ride) },
        }),
    },
    'captain.ride_cancelled_by_admin': {
        audience: 'captain',
        label: 'Ride cancelled by admin',
        description: 'Includes the reason the admin entered',
        defaults: { email: false, sms: true, whatsapp: false, push: true },
        build: ({ ride, brand }) => ({
            title: 'Ride cancelled by admin',
            text: `${brand}: The ride from ${short(ride.pickup)} was cancelled by our support team. Reason: ${ride.cancelReason || 'not given'}.`,
            link: '/captain-home',
            email: { subject: 'Ride cancelled by admin', lines: [ `Reason: ${ride.cancelReason || 'not given'}` ], rows: tripRows(ride) },
        }),
    },
    'captain.payment_received': {
        audience: 'captain',
        label: 'Rider paid online',
        description: 'Confirms the online payment so the captain can finish the ride',
        defaults: { email: false, sms: false, whatsapp: false, push: true },
        build: ({ ride, brand }) => ({
            title: `Payment received · ${money(ride.fare)}`,
            text: `${brand}: The rider paid ${money(ride.fare)} online. You can finish the ride.`,
            link: '/captain-riding',
            email: { subject: `Payment received · ${money(ride.fare)}`, lines: [ 'The rider paid online. You can finish the ride.' ], rows: tripRows(ride) },
        }),
    },
    'captain.ride_completed': {
        audience: 'captain',
        label: 'Ride completed (earnings)',
        description: 'What the captain earned for the ride',
        defaults: { email: false, sms: false, whatsapp: false, push: true },
        build: ({ ride, brand }) => ({
            title: `Ride completed · ${money(ride.fare)} earned`,
            text: `${brand}: Ride to ${short(ride.destination)} completed. You earned ${money(ride.fare)} (${ride.paymentMethod === 'online' ? 'paid online' : 'cash'}).`,
            link: '/captain-home',
            email: { subject: `You earned ${money(ride.fare)}`, lines: [ 'Ride completed. Great job!' ], rows: [ ...tripRows(ride), [ 'Payment', ride.paymentMethod === 'online' ? 'Online' : 'Cash' ] ] },
        }),
    },
};

module.exports.EVENTS = EVENTS;
module.exports.CHANNELS = CHANNELS;

// ---------- Rules (which channels per event) ----------

const RULES_KEY = 'notificationRules';
let rulesCache = null;

module.exports.getRules = async () => {
    if (!rulesCache || rulesCache.expires < Date.now()) {
        const saved = (await settingModel.findOne({ key: RULES_KEY }).lean())?.value || {};
        const value = Object.fromEntries(Object.entries(EVENTS).map(([ key, ev ]) => [
            key,
            Object.fromEntries(CHANNELS.map(ch => [ ch, saved[ key ]?.[ ch ] ?? ev.defaults[ ch ] ])),
        ]));
        rulesCache = { value, expires: Date.now() + 30000 };
    }
    return rulesCache.value;
}

module.exports.updateRules = async (rules) => {
    const clean = Object.fromEntries(Object.keys(EVENTS).map(key => [
        key,
        Object.fromEntries(CHANNELS.map(ch => [ ch, Boolean(rules?.[ key ]?.[ ch ]) ])),
    ]));
    await settingModel.findOneAndUpdate({ key: RULES_KEY }, { value: clean }, { upsert: true });
    rulesCache = null;
    return module.exports.getRules();
}

// ---------- Channel status (is each integration usable?) ----------

module.exports.getChannelStatus = async () => {
    const [ smtp, twilio, firebase ] = await Promise.all([ 'smtp', 'twilio', 'firebase' ].map(n => integrationService.get(n)));
    const twilioReady = Boolean(twilio.accountSid && twilio.authToken);
    return {
        email: { ready: Boolean(smtp.enabled && smtp.host && smtp.user && smtp.password), integration: 'Email (SMTP)' },
        sms: { ready: Boolean(twilio.enabled && twilioReady && twilio.smsFrom), integration: 'Twilio SMS' },
        whatsapp: { ready: Boolean(twilio.whatsappEnabled && twilioReady && twilio.whatsappFrom), integration: 'Twilio WhatsApp' },
        push: { ready: fcmService.webConfig(firebase).enabled, integration: 'Firebase push' },
    };
}

// ---------- Sending ----------

const maskEmail = (e) => e ? e.replace(/^(.{2}).*(@.*)$/, '$1•••$2') : '';
const maskPhone = (p) => p ? `•••${p.slice(-4)}` : '';

async function log(entry) {
    try {
        await notificationLogModel.create(entry);
    } catch (err) {
        console.error('Notification log error:', err.message);
    }
}

// Sends `message` to one person on one channel. Returns { status, detail, to }.
async function deliver(channel, person, personModel, message, configs) {
    if (channel === 'email') {
        if (!configs.status.email.ready) return { status: 'skipped', detail: 'Email (SMTP) is off' };
        if (!person.email) return { status: 'skipped', detail: 'No email address' };
        await emailService.sendEmail({ to: person.email, ...message.email });
        return { status: 'sent', to: maskEmail(person.email) };
    }

    if (channel === 'sms' || channel === 'whatsapp') {
        if (!configs.status[ channel ].ready) return { status: 'skipped', detail: `${configs.status[ channel ].integration} is off` };
        const phone = twilioService.normalizePhone(person.phone, configs.twilio.defaultCountryCode);
        if (!phone) return { status: 'skipped', detail: 'No phone number' };
        const result = await twilioService.send(configs.twilio, { to: phone, body: message.text, channel });
        return { status: 'sent', to: maskPhone(phone), detail: `Twilio ${result.status}` };
    }

    if (channel === 'push') {
        if (!configs.status.push.ready) return { status: 'skipped', detail: 'Firebase push is off' };
        const tokens = person.pushTokens || [];
        if (!tokens.length) return { status: 'skipped', detail: 'Notifications not turned on in their browser' };
        const sa = fcmService.parseServiceAccount(configs.firebase.serviceAccountJson);
        const results = await Promise.all(tokens.map(token => fcmService.send(sa, token, {
            title: message.title,
            body: message.text,
            link: message.link ? `${APP_URL()}${message.link}` : undefined,
            data: message.data,
        })));
        const invalid = tokens.filter((t, i) => results[ i ].invalidToken);
        if (invalid.length && personModel) await personModel.updateOne({ _id: person._id }, { $pull: { pushTokens: { $in: invalid } } });
        const sent = results.filter(r => r.ok).length;
        if (!sent) throw new Error(results[ 0 ]?.error || 'Push failed');
        return { status: 'sent', to: `${sent} device${sent === 1 ? '' : 's'}` };
    }

    return { status: 'skipped', detail: 'Unknown channel' };
}

async function loadConfigs() {
    const [ twilio, firebase, status ] = await Promise.all([
        integrationService.get('twilio'),
        integrationService.get('firebase'),
        module.exports.getChannelStatus(),
    ]);
    return { twilio, firebase, status };
}

async function brandName() {
    return (await integrationService.get('smtp')).fromName || 'Khushi Transport';
}

async function dispatch(eventKey, { rideId, captainIds }) {
    const event = EVENTS[ eventKey ];
    const rules = (await module.exports.getRules())[ eventKey ];
    const channels = CHANNELS.filter(ch => rules[ ch ]);
    if (!channels.length) return;

    const ride = await rideModel.findById(rideId).select('+otp')
        .populate({ path: 'user', select: '+pushTokens' })
        .populate({ path: 'captain', select: '+pushTokens' });
    if (!ride) return;

    let recipients;
    if (event.audience === 'rider') recipients = ride.user ? [ ride.user ] : [];
    else if (captainIds) recipients = await captainModel.find({ _id: { $in: captainIds }, isBlocked: { $ne: true } }).select('+pushTokens');
    else recipients = ride.captain ? [ ride.captain ] : [];
    if (!recipients.length) return;

    const [ configs, brand ] = await Promise.all([ loadConfigs(), brandName() ]);
    const message = { ...event.build({ ride, brand }), data: { event: eventKey, rideId: String(ride._id) } };
    const personModel = event.audience === 'rider' ? userModel : captainModel;

    await Promise.all(recipients.flatMap(person => channels.map(async channel => {
        let result;
        try {
            result = await deliver(channel, person, personModel, message, configs);
        } catch (err) {
            result = { status: 'failed', detail: err.message };
        }
        await log({
            event: eventKey,
            channel,
            recipientType: event.audience,
            recipientId: person._id,
            recipientName: fullName(person) || person.email,
            to: result.to,
            status: result.status,
            detail: result.detail,
            ride: ride._id,
        });
    })));
}

// Fire-and-forget: never slows down or breaks the ride flow
module.exports.notify = (eventKey, payload) => {
    dispatch(eventKey, payload).catch(err => console.error(`Notification ${eventKey} failed:`, err.message));
}

// ---------- Admin test send ----------

module.exports.sendTest = async (channel, to, adminName) => {
    const [ configs, brand ] = await Promise.all([ loadConfigs(), brandName() ]);
    const message = {
        title: `${brand} test notification`,
        text: `${brand}: This is a test ${channel} notification sent by ${adminName} from the admin panel.`,
        link: '/',
        email: { subject: 'Test notification', lines: [ `This is a test notification sent by ${adminName} from the admin panel. Your email notifications are working.` ] },
        data: { event: 'test' },
    };

    let person = { email: to, phone: to };
    let personModel = null;
    if (channel === 'push') {
        // push goes to the devices of a rider or captain, found by their email
        const email = String(to || '').toLowerCase().trim();
        person = await userModel.findOne({ email }).select('+pushTokens');
        personModel = userModel;
        if (!person) {
            person = await captainModel.findOne({ email }).select('+pushTokens');
            personModel = captainModel;
        }
        if (!person) return { ok: false, message: 'No rider or captain with that email.' };
    }

    let result;
    try {
        result = await deliver(channel, person, personModel, message, configs);
    } catch (err) {
        result = { status: 'failed', detail: err.message };
    }
    await log({ event: 'test', channel, recipientType: 'test', recipientName: adminName, to: result.to, status: result.status, detail: result.detail });

    if (result.status === 'sent') return { ok: true, message: `Sent to ${result.to}.` };
    return { ok: false, message: result.detail };
}
