const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { RIDE_STATUSES } = require('../services/admin.service');
const { VEHICLE_TYPES } = require('../services/setting.service');
const { NAMES } = require('../services/integration.service');

const { authAdmin } = authMiddleware;
const validId = param('id').isMongoId().withMessage('Invalid id');
const pageQuery = [
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
];
const dateQuery = [
    query('from').optional({ values: 'falsy' }).isDate({ format: 'YYYY-MM-DD' }).withMessage('Invalid "from" date'),
    query('to').optional({ values: 'falsy' }).isDate({ format: 'YYYY-MM-DD' }).withMessage('Invalid "to" date'),
];
const rideFilters = [
    ...dateQuery,
    query('status').optional({ values: 'falsy' }).isIn(RIDE_STATUSES).withMessage('Invalid status'),
    query('vehicleType').optional({ values: 'falsy' }).isIn(VEHICLE_TYPES).withMessage('Invalid vehicle type'),
    query('user').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid rider id'),
    query('captain').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid captain id'),
    query('paymentStatus').optional({ values: 'falsy' }).isIn([ 'pending', 'paid', 'refunded' ]).withMessage('Invalid payment status'),
    query('paymentMethod').optional({ values: 'falsy' }).isIn([ 'cash', 'online' ]).withMessage('Invalid payment method'),
];
const blockBody = body('blocked').isBoolean().withMessage('"blocked" must be true or false');
const phoneBody = body('phone').optional({ values: 'falsy' }).matches(/^\+?[\d\s-]{10,16}$/).withMessage('Phone must be 10 digits, or include the country code like +91…');
const nameBody = (path) => body(path).optional().isLength({ min: 3 }).withMessage('Name must be at least 3 characters long');


// Auth & own account
router.post('/login', [
    body('email').isEmail().withMessage('Invalid Email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], adminController.loginAdmin)

router.get('/profile', authAdmin, adminController.getAdminProfile)
router.patch('/profile', authAdmin, body('fullname').trim().isLength({ min: 2 }).withMessage('Name is required'), adminController.updateAdminProfile)
router.patch('/password', authAdmin, [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
], adminController.changePassword)
router.get('/logout', authAdmin, adminController.logoutAdmin)

// Admin accounts
router.get('/admins', authAdmin, adminController.listAdmins)
router.post('/admins', authAdmin, [
    body('fullname').trim().isLength({ min: 2 }).withMessage('Name is required'),
    body('email').isEmail().withMessage('Invalid Email'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
], adminController.createAdmin)
router.delete('/admins/:id', authAdmin, validId, adminController.deleteAdmin)

// Dashboard & live monitor
router.get('/dashboard', authAdmin, query('days').optional().isIn([ '7', '30', '90' ]).withMessage('Invalid period'), adminController.getDashboard)
router.get('/live', authAdmin, adminController.getLive)

// Rides
router.get('/rides', authAdmin, [ ...pageQuery, ...rideFilters ], adminController.listRides)
router.get('/rides/export', authAdmin, rideFilters, adminController.exportRides)
router.get('/rides/:id', authAdmin, validId, adminController.getRide)
router.post('/rides/:id/refund', authAdmin, validId, adminController.refundRide)
router.post('/rides/:id/cancel', authAdmin, [ validId, body('reason').optional().isLength({ max: 300 }).withMessage('Reason is too long') ], adminController.cancelRide)

// Captains
router.get('/captains', authAdmin, [
    ...pageQuery,
    query('status').optional({ values: 'falsy' }).isIn([ 'active', 'inactive' ]).withMessage('Invalid status'),
    query('kycStatus').optional({ values: 'falsy' }).isIn([ 'pending', 'verified', 'rejected' ]).withMessage('Invalid KYC status'),
    query('vehicleType').optional({ values: 'falsy' }).isIn(VEHICLE_TYPES).withMessage('Invalid vehicle type'),
], adminController.listCaptains)
router.get('/captains/:id', authAdmin, validId, adminController.getCaptain)
router.get('/captains/:id/kyc/:document', authAdmin, validId, adminController.getCaptainKycDocument)
router.patch('/captains/:id/kyc', authAdmin, [
    validId,
    body('status').isIn([ 'verified', 'rejected' ]).withMessage('Status must be verified or rejected'),
    body('reviewNote').optional().isString().isLength({ max: 500 }).withMessage('Review note is too long'),
], adminController.reviewCaptainKyc)
router.patch('/captains/:id', authAdmin, [
    validId,
    nameBody('fullname.firstname'),
    body('fullname.lastname').optional({ values: 'falsy' }).isLength({ min: 3 }).withMessage('Last name must be at least 3 characters long'),
    body('email').optional().isEmail().withMessage('Invalid Email'),
    body('status').optional().isIn([ 'active', 'inactive' ]).withMessage('Invalid status'),
    body('vehicle.color').optional().isLength({ min: 3 }).withMessage('Color must be at least 3 characters long'),
    body('vehicle.plate').optional().isLength({ min: 3 }).withMessage('Plate must be at least 3 characters long'),
    body('vehicle.capacity').optional().isInt({ min: 1 }).withMessage('Load capacity must be at least 1 kg').toInt(),
    body('vehicle.vehicleType').optional().isIn(VEHICLE_TYPES).withMessage('Invalid vehicle type'),
    phoneBody,
], adminController.updateCaptain)
router.patch('/captains/:id/block', authAdmin, [ validId, blockBody ], adminController.setCaptainBlocked)
router.delete('/captains/:id', authAdmin, validId, adminController.deleteCaptain)

// Riders
router.get('/users', authAdmin, pageQuery, adminController.listUsers)
router.get('/users/:id', authAdmin, validId, adminController.getUser)
router.patch('/users/:id', authAdmin, [
    validId,
    nameBody('fullname.firstname'),
    body('fullname.lastname').optional({ values: 'falsy' }).isLength({ min: 3 }).withMessage('Last name must be at least 3 characters long'),
    body('email').optional().isEmail().withMessage('Invalid Email'),
    phoneBody,
], adminController.updateUser)
router.patch('/users/:id/block', authAdmin, [ validId, blockBody ], adminController.setUserBlocked)
router.delete('/users/:id', authAdmin, validId, adminController.deleteUser)

// Reports & settings
router.get('/reports', authAdmin, dateQuery, adminController.getReport)
router.get('/settings/fares', authAdmin, adminController.getFareSettings)
router.put('/settings/fares', authAdmin, [
    body('helperCharge').isFloat({ min: 0, max: 10000 }).withMessage('Helper charge must be 0–10000'),
    ...VEHICLE_TYPES.flatMap(type => [
        body(`${type}.baseFare`).isFloat({ min: 0, max: 10000 }).withMessage(`${type}: base fare must be 0–10000`),
        body(`${type}.perKm`).isFloat({ min: 0, max: 1000 }).withMessage(`${type}: per-km rate must be 0–1000`),
        body(`${type}.perMinute`).isFloat({ min: 0, max: 1000 }).withMessage(`${type}: per-minute rate must be 0–1000`),
    ]),
], adminController.updateFareSettings)

// Commission by time slot
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
router.get('/settings/commission', authAdmin, adminController.getCommissionSettings)
router.put('/settings/commission', authAdmin, [
    body('defaultPercent').isFloat({ min: 0, max: 100 }).withMessage('Default commission must be 0–100%'),
    body('slots').isArray({ max: 20 }).withMessage('Up to 20 time slots'),
    body('slots.*.name').isString().trim().isLength({ min: 1, max: 40 }).withMessage('Each time slot needs a name (up to 40 characters)'),
    body('slots.*.start').matches(HHMM).withMessage('Slot start time must look like 08:00'),
    body('slots.*.end').matches(HHMM).withMessage('Slot end time must look like 22:00'),
    body('slots.*.percent').isFloat({ min: 0, max: 100 }).withMessage('Slot commission must be 0–100%'),
    body('slots.*.days').optional().isArray().withMessage('Days must be a list'),
    body('slots.*.days.*').isInt({ min: 0, max: 6 }).withMessage('Invalid day'),
    body('slots.*.vehicleTypes').optional().isArray().withMessage('Vehicle types must be a list'),
    body('slots.*.vehicleTypes.*').isIn(VEHICLE_TYPES).withMessage('Invalid vehicle type'),
], adminController.updateCommissionSettings)

// Offers (automatic) and coupons (code)
const optionalField = (field) => body(field).optional({ values: 'falsy' });
const promoCode = (chain) => chain.isString().trim().matches(/^[A-Za-z0-9_-]{3,20}$/).withMessage('Code must be 3–20 letters, numbers, - or _');
const promoBody = [
    body('title').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Title must be 2–80 characters'),
    optionalField('description').isString().isLength({ max: 300 }).withMessage('Description is too long'),
    body('discountType').isIn([ 'percent', 'flat' ]).withMessage('Discount type must be percent or flat'),
    body('value').isFloat({ gt: 0, max: 100000 }).withMessage('Discount must be more than 0').bail()
        .custom((value, { req }) => req.body.discountType !== 'percent' || Number(value) <= 100).withMessage('Percent discount can be at most 100%'),
    optionalField('maxDiscount').isFloat({ gt: 0 }).withMessage('Max discount must be more than 0'),
    optionalField('minFare').isFloat({ min: 0 }).withMessage('Minimum order must be 0 or more'),
    body('vehicleTypes').optional().isArray().withMessage('Vehicle types must be a list'),
    body('vehicleTypes.*').isIn(VEHICLE_TYPES).withMessage('Invalid vehicle type'),
    body('days').optional().isArray().withMessage('Days must be a list'),
    body('days.*').isInt({ min: 0, max: 6 }).withMessage('Invalid day'),
    optionalField('startTime').matches(HHMM).withMessage('Start time must look like 08:00'),
    optionalField('endTime').matches(HHMM).withMessage('End time must look like 22:00'),
    body('endTime').custom((end, { req }) => Boolean(end) === Boolean(req.body.startTime)).withMessage('Give both a start and an end time, or neither'),
    optionalField('validFrom').isDate({ format: 'YYYY-MM-DD' }).withMessage('Invalid start date'),
    optionalField('validTo').isDate({ format: 'YYYY-MM-DD' }).withMessage('Invalid end date').bail()
        .custom((to, { req }) => !req.body.validFrom || to >= req.body.validFrom).withMessage('End date must be on or after the start date'),
    optionalField('usageLimit').isInt({ min: 1 }).withMessage('Total uses must be at least 1'),
    optionalField('perUserLimit').isInt({ min: 1 }).withMessage('Uses per customer must be at least 1'),
    body('firstOrderOnly').optional().isBoolean().withMessage('"firstOrderOnly" must be true or false'),
    body('showToCustomers').optional().isBoolean().withMessage('"showToCustomers" must be true or false'),
    body('isActive').optional().isBoolean().withMessage('"isActive" must be true or false'),
];
router.get('/promos', authAdmin, query('kind').isIn([ 'offer', 'coupon' ]).withMessage('kind must be offer or coupon'), adminController.listPromos)
router.post('/promos', authAdmin, [
    body('kind').isIn([ 'offer', 'coupon' ]).withMessage('kind must be offer or coupon'),
    promoCode(body('code').if(body('kind').equals('coupon'))),
    ...promoBody,
], adminController.createPromo)
router.put('/promos/:id', authAdmin, [ validId, promoCode(body('code').optional({ values: 'falsy' })), ...promoBody ], adminController.updatePromo)
router.delete('/promos/:id', authAdmin, validId, adminController.deletePromo)

// Third-party integrations (Google Maps, OpenStreetMap, SMTP email)
const integrationName = param('name').isIn(NAMES).withMessage('Unknown integration');
const integrationFields = (prefix = '') => [
    body(`${prefix}enabled`).optional().isBoolean().withMessage('"enabled" must be true or false'),
    body(`${prefix}apiKey`).optional().isString().isLength({ max: 200 }).withMessage('API key is too long'),
    body(`${prefix}countryCode`).optional().matches(/^([a-zA-Z]{2}(,[a-zA-Z]{2})*)?$/).withMessage('Country codes must look like "in" or "in,np"'),
    body(`${prefix}contactEmail`).optional({ values: 'falsy' }).isEmail().withMessage('Contact email is invalid'),
    body(`${prefix}host`).optional().isString().isLength({ max: 200 }).withMessage('Host is too long'),
    body(`${prefix}port`).optional({ values: 'falsy' }).isInt({ min: 1, max: 65535 }).withMessage('Port must be between 1 and 65535'),
    body(`${prefix}user`).optional().isString().isLength({ max: 200 }).withMessage('Username is too long'),
    body(`${prefix}password`).optional().isString().isLength({ max: 500 }).withMessage('Password is too long'),
    body(`${prefix}fromName`).optional().isString().isLength({ max: 100 }).withMessage('Sender name is too long'),
    body(`${prefix}fromEmail`).optional({ values: 'falsy' }).isEmail().withMessage('Sender email is invalid'),
    body(`${prefix}keyId`).optional({ values: 'falsy' }).matches(/^rzp_(test|live)_\w+$/).withMessage('Razorpay Key ID starts with rzp_test_ or rzp_live_'),
    body(`${prefix}allowCash`).optional().isBoolean().withMessage('"allowCash" must be true or false'),
    body(`${prefix}whatsappEnabled`).optional().isBoolean().withMessage('"whatsappEnabled" must be true or false'),
    body(`${prefix}accountSid`).optional({ values: 'falsy' }).matches(/^AC[0-9a-fA-F]{32}$/).withMessage('Twilio Account SID starts with AC and has 34 characters'),
    body(`${prefix}defaultCountryCode`).optional({ values: 'falsy' }).matches(/^\+\d{1,4}$/).withMessage('Country code must look like +91'),
    body(`${prefix}serviceAccountJson`).optional({ values: 'falsy' }).isString().isLength({ max: 10000 }).custom(v => {
        const sa = JSON.parse(v);
        if (!sa.project_id || !sa.client_email || !sa.private_key) throw new Error();
        return true;
    }).withMessage('Paste the whole service-account JSON file from Firebase'),
    ...[ 'keySecret', 'webhookSecret', 'authToken', 'smsFrom', 'whatsappFrom', 'webApiKey', 'webAppId', 'messagingSenderId', 'vapidKey' ].map(field =>
        body(`${prefix}${field}`).optional().isString().isLength({ max: 500 }).withMessage(`${field} is too long`)),
];

router.get('/settings/integrations', authAdmin, adminController.getIntegrations)
router.put('/settings/integrations/:name', authAdmin, [
    integrationName,
    ...integrationFields(),
    body('clearSecrets').optional().isArray().withMessage('clearSecrets must be a list'),
], adminController.updateIntegration)
router.post('/settings/integrations/:name/test', authAdmin, [
    integrationName,
    ...integrationFields('values.'),
    body('testTo').optional({ values: 'falsy' }).isString().isLength({ max: 200 }).withMessage('Test address is invalid'),
], adminController.testIntegration)

// Notifications: rules per event, delivery log, test send
router.get('/notifications', authAdmin, adminController.getNotificationSettings)
router.put('/notifications/rules', authAdmin, body('rules').isObject().withMessage('rules must be an object'), adminController.updateNotificationRules)
router.get('/notifications/log', authAdmin, [
    ...pageQuery,
    query('channel').optional({ values: 'falsy' }).isIn([ 'email', 'sms', 'whatsapp', 'push' ]).withMessage('Invalid channel'),
    query('status').optional({ values: 'falsy' }).isIn([ 'sent', 'failed', 'skipped' ]).withMessage('Invalid status'),
], adminController.listNotificationLog)
router.post('/notifications/test', authAdmin, [
    body('channel').isIn([ 'email', 'sms', 'whatsapp', 'push' ]).withMessage('Invalid channel'),
    body('to').isString().trim().isLength({ min: 3, max: 200 }).withMessage('Enter where to send the test'),
], adminController.sendTestNotification)

module.exports = router;
