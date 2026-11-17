// Discounts (offers + coupons) and platform commission for a booking.
const promoModel = require('../models/promo.model');
const rideModel = require('../models/ride.model');
const settingService = require('./setting.service');
const { vehicleLabel } = require('../config/vehicles');

const TZ = 'Asia/Kolkata';
const DAY_NAMES = [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ];

// Minutes since midnight and weekday (0 = Sunday) in India time
function indiaClock(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => parts.find(p => p.type === type).value;
    return { minutes: Number(get('hour')) * 60 + Number(get('minute')), day: DAY_NAMES.indexOf(get('weekday')) };
}

const toMinutes = (hhmm) => {
    const [ h, m ] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

// Does the clock fall inside a daily window? An end before the start runs past midnight,
// and the after-midnight part counts as the day the window started on (Fri 22:00–06:00 covers Sat 02:00).
function inWindow({ start, end, days }, clock) {
    let day = clock.day;
    if (start && end && start !== end) {
        const s = toMinutes(start), e = toMinutes(end), m = clock.minutes;
        if (s < e) {
            if (m < s || m >= e) return false;
        } else {
            if (m < s && m >= e) return false;
            if (m < e) day = (day + 6) % 7;
        }
    }
    return !days?.length || days.includes(day);
}

const describeWindow = ({ start, end, days }) => [
    days?.length ? days.slice().sort().map(d => DAY_NAMES[ d ]).join(', ') : '',
    start && end && start !== end ? `${start}–${end}` : '',
].filter(Boolean).join(', ');

module.exports.indiaClock = indiaClock;
module.exports.inWindow = inWindow;

// ---------- Commission ----------

module.exports.commissionFor = async (vehicleType, date = new Date()) => {
    const settings = await settingService.getCommissionSettings();
    const clock = indiaClock(date);
    const slot = (settings.slots || []).find(s =>
        (!s.vehicleTypes?.length || s.vehicleTypes.includes(vehicleType)) && inWindow(s, clock));
    return slot
        ? { percent: slot.percent, rule: slot.name }
        : { percent: settings.defaultPercent, rule: 'Default' };
};

// ---------- Offers & coupons ----------

const promoDiscount = (promo, amount) => {
    let discount = promo.discountType === 'percent' ? amount * promo.value / 100 : promo.value;
    if (promo.discountType === 'percent' && promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
    return Math.round(Math.max(0, Math.min(discount, amount)));
};
module.exports.promoDiscount = promoDiscount;

const notCancelled = { status: { $ne: 'cancelled' } };

// Why this promo can't be used for this booking, or '' if it can.
// Cheap checks run first so usage counts only hit the database when needed.
async function promoProblem(promo, { userId, vehicleType, amount, date, clock }) {
    const what = promo.kind === 'coupon' ? 'coupon' : 'offer';
    if (!promo.isActive) return `This ${what} is not active`;
    if (promo.validFrom && date < promo.validFrom) {
        return `This ${what} starts on ${promo.validFrom.toLocaleDateString('en-IN', { timeZone: TZ, dateStyle: 'medium' })}`;
    }
    if (promo.validTo && date > promo.validTo) return `This ${what} has expired`;
    if (promo.vehicleTypes?.length && !promo.vehicleTypes.includes(vehicleType)) {
        return `Valid only on ${promo.vehicleTypes.map(vehicleLabel).join(', ')}`;
    }
    const window = { start: promo.startTime, end: promo.endTime, days: promo.days };
    if (!inWindow(window, clock)) return `Valid only on ${describeWindow(window)} (India time)`;
    if (promo.minFare && amount < promo.minFare) return `Valid on orders of ₹${promo.minFare} or more`;

    if (promo.usageLimit) {
        const used = await rideModel.countDocuments({ promoId: promo._id, ...notCancelled });
        if (used >= promo.usageLimit) return `This ${what} has been fully used`;
    }
    if (userId && promo.perUserLimit) {
        const used = await rideModel.countDocuments({ promoId: promo._id, user: userId, ...notCancelled });
        if (used >= promo.perUserLimit) return `You have already used this ${what}`;
    }
    if (userId && promo.firstOrderOnly) {
        const orders = await rideModel.countDocuments({ user: userId, ...notCancelled });
        if (orders > 0) return `This ${what} is only for your first order`;
    }
    return '';
}

const promoSummary = (promo) => ({ id: promo._id, kind: promo.kind, title: promo.title, code: promo.code });

// Best automatic offer for this booking, or null
async function bestOffer(ctx, offers) {
    let best = null;
    for (const offer of offers) {
        const discount = promoDiscount(offer, ctx.amount);
        if (discount <= 0 || (best && discount <= best.discount)) continue;
        if (await promoProblem(offer, ctx)) continue;
        best = { promo: offer, discount };
    }
    return best;
}

const activeOffers = () => promoModel.find({ kind: 'offer', isActive: true }).lean();

// Best offer for each vehicle fare, for the vehicle list: { <vehicleType>: { title, discount } }
module.exports.offersForFares = async ({ userId, fares, date = new Date() }) => {
    const offers = await activeOffers();
    if (!offers.length) return {};
    const clock = indiaClock(date);
    const result = {};
    for (const [ vehicleType, amount ] of Object.entries(fares)) {
        const best = await bestOffer({ userId, vehicleType, amount, date, clock }, offers);
        if (best) result[ vehicleType ] = { title: best.promo.title, discount: best.discount };
    }
    return result;
};

// Full price breakdown for one booking. `amount` is vehicle fare + helpers.
// The customer gets whichever is bigger: the best automatic offer or the coupon they entered.
// Commission is taken on what the customer pays, so a discount is shared by driver and platform.
module.exports.quote = async ({ userId, vehicleType, amount, couponCode, date = new Date() }) => {
    const ctx = { userId, vehicleType, amount, date, clock: indiaClock(date) };
    const best = await bestOffer(ctx, await activeOffers());

    let coupon = null;
    let couponError = '';
    let couponNote = '';
    const code = couponCode?.trim().toUpperCase();
    if (code) {
        const promo = await promoModel.findOne({ kind: 'coupon', code }).lean();
        const problem = promo ? await promoProblem(promo, ctx) : 'This coupon code is not valid';
        if (problem) couponError = problem;
        else coupon = { promo, discount: promoDiscount(promo, amount) };
    }

    let applied = best;
    if (coupon) {
        if (!best || coupon.discount >= best.discount) applied = coupon;
        else couponNote = `"${best.promo.title}" already gives you ₹${best.discount} off, which is more than this coupon, so the coupon was not used.`;
    }

    const discount = applied?.discount || 0;
    const fare = amount - discount;
    const { percent, rule } = await module.exports.commissionFor(vehicleType, date);
    const commission = Math.round(fare * (Number(percent) || 0) / 100);

    return {
        fareBeforeDiscount: amount,
        discount,
        fare,
        promo: applied ? promoSummary(applied.promo) : null,
        couponError,
        couponNote,
        commissionPercent: percent,
        commissionRule: rule,
        commission,
        driverEarning: fare - commission,
    };
};

// Offers and public coupons a customer can see in the app (time-of-day rules are shown, not filtered)
module.exports.listForCustomers = async () => {
    const now = new Date();
    const promos = await promoModel.find({
        isActive: true,
        $and: [
            { $or: [ { kind: 'offer' }, { showToCustomers: true } ] },
            { $or: [ { validTo: null }, { validTo: { $gte: now } } ] },
            { $or: [ { validFrom: null }, { validFrom: { $lte: now } } ] },
        ],
    }).sort({ kind: -1, createdAt: -1 }).lean();

    return promos.map(p => ({
        _id: p._id,
        kind: p.kind,
        title: p.title,
        description: p.description,
        code: p.kind === 'coupon' ? p.code : undefined,
        discountType: p.discountType,
        value: p.value,
        maxDiscount: p.maxDiscount,
        minFare: p.minFare,
        vehicleTypes: p.vehicleTypes,
        when: describeWindow({ start: p.startTime, end: p.endTime, days: p.days }),
        validTo: p.validTo,
        firstOrderOnly: p.firstOrderOnly,
    }));
};
