// OpenAPI 3 spec for the Khushi Transport API, served by Swagger UI at /api-docs.
// Keep in sync with routes/*.routes.js when endpoints change.
const { VEHICLE_TYPES, GOODS_TYPES, MAX_HELPERS } = require('../config/vehicles');
const { RIDE_STATUSES } = require('../services/admin.service');
const { NAMES: INTEGRATION_NAMES } = require('../services/integration.service');

// ---------- helpers ----------
const str = (extra = {}) => ({ type: 'string', ...extra });
const int = (extra = {}) => ({ type: 'integer', ...extra });
const num = (extra = {}) => ({ type: 'number', ...extra });
const bool = (extra = {}) => ({ type: 'boolean', ...extra });
const arr = (items, extra = {}) => ({ type: 'array', items, ...extra });
const obj = (properties, required = [], extra = {}) => ({ type: 'object', properties, ...(required.length ? { required } : {}), ...extra });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const mongoId = str({ pattern: '^[0-9a-fA-F]{24}$', example: '665f1c2e8b3a4d0012345678' });
const phone = str({ pattern: '^\\+?[\\d\\s-]{10,16}$', example: '+919876543210' });
const hhmm = str({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '08:00' });
const date = str({ format: 'date', example: '2026-11-01' });
const vehicleType = str({ enum: VEHICLE_TYPES });
const fullname = obj({ firstname: str({ minLength: 3, example: 'Ravi' }), lastname: str({ minLength: 3, example: 'Kumar' }) }, [ 'firstname' ]);

const q = (name, schema, { required = false, description } = {}) => ({ name, in: 'query', required, schema, ...(description ? { description } : {}) });
const idParam = { name: 'id', in: 'path', required: true, schema: mongoId };
const pageParams = [ q('page', int({ minimum: 1 })), q('limit', int({ minimum: 1, maximum: 100 })) ];
const dateParams = [ q('from', date, { description: 'YYYY-MM-DD' }), q('to', date, { description: 'YYYY-MM-DD' }) ];
const rideFilterParams = [
    ...dateParams,
    q('status', str({ enum: RIDE_STATUSES })),
    q('vehicleType', vehicleType),
    q('user', mongoId, { description: 'Customer id' }),
    q('captain', mongoId, { description: 'Driver id' }),
    q('paymentStatus', str({ enum: [ 'pending', 'paid', 'refunded' ] })),
    q('paymentMethod', str({ enum: [ 'cash', 'online' ] })),
];

const json = (schema) => ({ required: true, content: { 'application/json': { schema } } });
const ok = (description = 'OK') => ({ description, content: { 'application/json': { schema: { type: 'object' } } } });
const standardErrors = (secured) => ({
    400: { description: 'Validation failed', content: { 'application/json': { schema: ref('ValidationError') } } },
    ...(secured ? { 401: { description: 'Missing, invalid, or blacklisted token', content: { 'application/json': { schema: ref('Message') } } } } : {}),
});

// op('Tag', 'summary', { auth, body, params, responses, description })
const op = (tag, summary, { auth, body, params, responses, description } = {}) => ({
    tags: [ tag ],
    summary,
    ...(description ? { description } : {}),
    ...(auth ? { security: (Array.isArray(auth) ? auth : [ auth ]).map(s => ({ [ s ]: [] })) } : { security: [] }),
    ...(params ? { parameters: params } : {}),
    ...(body ? { requestBody: body } : {}),
    responses: { 200: ok(), ...standardErrors(Boolean(auth)), ...(responses || {}) },
});

const loginBody = (minPassword) => json(obj({ email: str({ format: 'email' }), password: str({ minLength: minPassword }) }, [ 'email', 'password' ]));
const forgotBody = json(obj({ email: str({ format: 'email' }) }, [ 'email' ]));
const resetBody = json(obj({ email: str({ format: 'email' }), otp: str({ minLength: 6, maxLength: 6, example: '123456' }), newPassword: str({ minLength: 6 }) }, [ 'email', 'otp', 'newPassword' ]));
const tokenBody = json(obj({ token: str({ minLength: 20, maxLength: 4096, description: 'FCM device token' }) }, [ 'token' ]));
const rideIdBody = json(obj({ rideId: mongoId }, [ 'rideId' ]));
const blockBody = json(obj({ blocked: bool() }, [ 'blocked' ]));

const vehicle = obj({
    color: str({ minLength: 3, example: 'White' }),
    plate: str({ minLength: 3, example: 'MH12AB1234' }),
    capacity: int({ minimum: 1, description: 'Load capacity in kg', example: 500 }),
    vehicleType,
}, [ 'color', 'plate', 'capacity', 'vehicleType' ]);

const promoBody = obj({
    kind: str({ enum: [ 'offer', 'coupon' ], description: 'Offers apply automatically; coupons need a code' }),
    code: str({ pattern: '^[A-Za-z0-9_-]{3,20}$', description: 'Required when kind is coupon', example: 'FIRST50' }),
    title: str({ minLength: 2, maxLength: 80 }),
    description: str({ maxLength: 300 }),
    discountType: str({ enum: [ 'percent', 'flat' ] }),
    value: num({ exclusiveMinimum: 0, description: 'Percent (max 100) or flat amount' }),
    maxDiscount: num({ exclusiveMinimum: 0 }),
    minFare: num({ minimum: 0 }),
    vehicleTypes: arr(vehicleType),
    days: arr(int({ minimum: 0, maximum: 6 }), { description: '0 = Sunday' }),
    startTime: hhmm,
    endTime: hhmm,
    validFrom: date,
    validTo: date,
    usageLimit: int({ minimum: 1 }),
    perUserLimit: int({ minimum: 1 }),
    firstOrderOnly: bool(),
    showToCustomers: bool(),
    isActive: bool(),
}, [ 'title', 'discountType', 'value' ]);

const integrationFields = obj({
    enabled: bool(),
    apiKey: str({ maxLength: 200 }),
    countryCode: str({ example: 'in' }),
    contactEmail: str({ format: 'email' }),
    host: str(), port: int({ minimum: 1, maximum: 65535 }), user: str(), password: str(),
    fromName: str(), fromEmail: str({ format: 'email' }),
    keyId: str({ pattern: '^rzp_(test|live)_\\w+$' }), keySecret: str(), webhookSecret: str(), allowCash: bool(),
    accountSid: str({ pattern: '^AC[0-9a-fA-F]{32}$' }), authToken: str(), smsFrom: str(), whatsappFrom: str(),
    whatsappEnabled: bool(), defaultCountryCode: str({ example: '+91' }),
    serviceAccountJson: str({ description: 'Whole Firebase service-account JSON as a string' }),
    webApiKey: str(), webAppId: str(), messagingSenderId: str(), vapidKey: str(),
}, [], { description: 'Send only the fields that apply to the chosen integration' });
const integrationParam = { name: 'name', in: 'path', required: true, schema: str({ enum: INTEGRATION_NAMES }) };

// ---------- paths ----------
const paths = {
    // Customers
    '/users/register': { post: op('Users', 'Register a customer', { body: json(obj({ fullname, email: str({ format: 'email' }), password: str({ minLength: 6 }), phone }, [ 'fullname', 'email', 'password' ])), responses: { 201: ok('Created; returns { token, user }') } }) },
    '/users/login': { post: op('Users', 'Customer login', { body: loginBody(6), description: 'Returns { token, user }. Copy the token into Authorize → userAuth.' }) },
    '/users/profile': { get: op('Users', 'Current customer profile', { auth: 'userAuth' }) },
    '/users/logout': { get: op('Users', 'Log out (blacklists the token)', { auth: 'userAuth' }) },
    '/users/forgot-password': { post: op('Users', 'Email a password-reset OTP', { body: forgotBody }) },
    '/users/reset-password': { post: op('Users', 'Reset password with OTP', { body: resetBody }) },

    // Drivers
    '/captains/register': { post: op('Captains', 'Register a driver (with KYC documents)', {
        body: { required: true, content: { 'multipart/form-data': { schema: obj({
            'fullname[firstname]': str({ minLength: 3 }), 'fullname[lastname]': str(),
            email: str({ format: 'email' }), password: str({ minLength: 6 }), phone,
            'vehicle[color]': str({ minLength: 3 }), 'vehicle[plate]': str({ minLength: 3 }),
            'vehicle[capacity]': int({ minimum: 1 }), 'vehicle[vehicleType]': vehicleType,
            license: str({ format: 'binary', description: 'PDF/JPG/PNG, max 3 MB' }),
            identity: str({ format: 'binary', description: 'PDF/JPG/PNG, max 3 MB' }),
        }, [ 'fullname[firstname]', 'email', 'password', 'vehicle[color]', 'vehicle[plate]', 'vehicle[capacity]', 'vehicle[vehicleType]' ]) } } },
        responses: { 201: ok('Created; returns { token, captain }') },
    }) },
    '/captains/login': { post: op('Captains', 'Driver login', { body: loginBody(6), description: 'Returns { token, captain }. Use the token for captainAuth.' }) },
    '/captains/profile': { get: op('Captains', 'Current driver profile', { auth: 'captainAuth' }) },
    '/captains/kyc': { post: op('Captains', 'Submit or resubmit KYC documents', { auth: 'captainAuth',
        body: { required: true, content: { 'multipart/form-data': { schema: obj({ license: str({ format: 'binary' }), identity: str({ format: 'binary' }) }) } } },
    }) },
    '/captains/logout': { get: op('Captains', 'Log out', { auth: 'captainAuth' }) },
    '/captains/forgot-password': { post: op('Captains', 'Email a password-reset OTP', { body: forgotBody }) },
    '/captains/reset-password': { post: op('Captains', 'Reset password with OTP', { body: resetBody }) },

    // Vendors
    '/vendors/register': { post: op('Vendors', 'Register a fleet vendor', {
        body: json(obj({ fullname, businessName: str({ minLength: 2, maxLength: 120 }), email: str({ format: 'email' }), phone, password: str({ minLength: 8 }) }, [ 'fullname', 'businessName', 'email', 'phone', 'password' ])),
        responses: { 201: ok('Created; returns { token, vendor }') },
    }) },
    '/vendors/login': { post: op('Vendors', 'Vendor login', { body: loginBody(8), description: 'Returns { token, vendor }. Use the token for vendorAuth.' }) },
    '/vendors/profile': { get: op('Vendors', 'Current vendor profile and vehicles', { auth: 'vendorAuth' }) },
    '/vendors/logout': { get: op('Vendors', 'Log out', { auth: 'vendorAuth' }) },
    '/vendors/vehicles': { post: op('Vendors', 'Add a vehicle to the fleet', { auth: 'vendorAuth',
        body: json(obj({ color: str({ minLength: 3, maxLength: 50 }), plate: str({ minLength: 3, maxLength: 20 }), capacity: int({ minimum: 1, maximum: 50000 }), vehicleType }, [ 'color', 'plate', 'capacity', 'vehicleType' ])),
        responses: { 201: ok('Created') },
    }) },

    // Maps
    '/maps/get-coordinates': { get: op('Maps', 'Geocode an address', { auth: 'userAuth', params: [ q('address', str({ minLength: 3 }), { required: true }) ] }) },
    '/maps/get-distance-time': { get: op('Maps', 'Distance and travel time between two addresses', { auth: 'userAuth', params: [ q('origin', str({ minLength: 3 }), { required: true }), q('destination', str({ minLength: 3 }), { required: true }) ] }) },
    '/maps/get-suggestions': { get: op('Maps', 'Address autocomplete', { auth: 'userAuth', params: [ q('input', str({ minLength: 3 }), { required: true }) ] }) },
    '/maps/reverse-geocode': { get: op('Maps', 'Address for a lat/lng', { auth: 'userAuth', params: [ q('lat', num({ minimum: -90, maximum: 90 }), { required: true }), q('lng', num({ minimum: -180, maximum: 180 }), { required: true }) ] }) },

    // Orders (rides)
    '/rides/create': { post: op('Rides', 'Book a goods delivery', { auth: 'userAuth',
        body: json(obj({
            pickup: str({ minLength: 3 }), destination: str({ minLength: 3 }), vehicleType,
            goodsType: str({ enum: GOODS_TYPES }),
            goodsWeight: num({ exclusiveMinimum: 0, description: 'kg; must fit the vehicle capacity' }),
            receiverName: str({ minLength: 2, maxLength: 80 }), receiverPhone: phone,
            helpers: int({ minimum: 0, maximum: MAX_HELPERS }), notes: str({ maxLength: 300 }),
            couponCode: str({ maxLength: 30 }),
        }, [ 'pickup', 'destination', 'vehicleType', 'goodsType', 'receiverName', 'receiverPhone' ])),
        responses: { 201: ok('Created ride') },
    }) },
    '/rides/quote': { post: op('Rides', 'Price a booking (with helpers, offers and coupon)', { auth: 'userAuth',
        body: json(obj({ pickup: str({ minLength: 3 }), destination: str({ minLength: 3 }), vehicleType, helpers: int({ minimum: 0, maximum: MAX_HELPERS }), couponCode: str({ maxLength: 30 }) }, [ 'pickup', 'destination', 'vehicleType' ])),
    }) },
    '/rides/offers': { get: op('Rides', 'Offers and coupons visible to customers', { auth: 'userAuth' }) },
    '/rides/get-fare': { get: op('Rides', 'Fare for every vehicle type', { auth: 'userAuth', params: [ q('pickup', str({ minLength: 3 }), { required: true }), q('destination', str({ minLength: 3 }), { required: true }) ] }) },
    '/rides/confirm': { post: op('Rides', 'Driver accepts an order', { auth: 'captainAuth', body: rideIdBody, description: 'Driver KYC must be verified (403 otherwise).' }) },
    '/rides/start-ride': { get: op('Rides', 'Driver starts the trip with the customer OTP', { auth: 'captainAuth', params: [ q('rideId', mongoId, { required: true }), q('otp', str({ minLength: 6, maxLength: 6 }), { required: true }) ] }) },
    '/rides/end-ride': { post: op('Rides', 'Driver completes the trip', { auth: 'captainAuth', body: rideIdBody }) },
    '/rides/captain-stats': { get: op('Rides', 'Driver earnings and trip stats', { auth: 'captainAuth' }) },
    '/rides/pending': { get: op('Rides', 'Open orders the driver can accept', { auth: 'captainAuth' }) },
    '/rides/cancel': { post: op('Rides', 'Customer cancels an order', { auth: 'userAuth', body: rideIdBody }) },
    '/rides/user-active-ride': { get: op('Rides', "Customer's current active order", { auth: 'userAuth' }) },

    // Payments
    '/payments/config': { get: op('Payments', 'Razorpay key and whether cash is allowed', { auth: 'userAuth' }) },
    '/payments/create-order': { post: op('Payments', 'Create a Razorpay order for a ride', { auth: 'userAuth', body: rideIdBody }) },
    '/payments/verify': { post: op('Payments', 'Verify a Razorpay payment signature', { auth: 'userAuth',
        body: json(obj({ rideId: mongoId, razorpay_order_id: str(), razorpay_payment_id: str(), razorpay_signature: str() }, [ 'rideId', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature' ])),
    }) },
    '/payments/webhook': { post: op('Payments', 'Razorpay webhook', {
        description: 'Called by Razorpay. Requires a valid X-Razorpay-Signature header computed over the raw body; not useful to call by hand.',
        params: [ { name: 'X-Razorpay-Signature', in: 'header', required: true, schema: str() } ],
        body: json({ type: 'object' }),
    }) },

    // Push notifications
    '/notifications/push-config': { get: op('Notifications', 'Public Firebase web config for push') },
    '/notifications/push-token': {
        post: op('Notifications', 'Register a device for push', { auth: [ 'userAuth', 'captainAuth' ], body: tokenBody }),
        delete: op('Notifications', 'Unregister a device', { auth: [ 'userAuth', 'captainAuth' ], body: tokenBody }),
    },

    // Admin — account
    '/admin/login': { post: op('Admin: Account', 'Admin login', { body: loginBody(6), description: 'Returns { token, admin }. Use the token for adminAuth.' }) },
    '/admin/profile': {
        get: op('Admin: Account', 'Current admin profile', { auth: 'adminAuth' }),
        patch: op('Admin: Account', 'Update own name', { auth: 'adminAuth', body: json(obj({ fullname: str({ minLength: 2 }) }, [ 'fullname' ])) }),
    },
    '/admin/password': { patch: op('Admin: Account', 'Change own password', { auth: 'adminAuth', body: json(obj({ currentPassword: str(), newPassword: str({ minLength: 8 }) }, [ 'currentPassword', 'newPassword' ])) }) },
    '/admin/logout': { get: op('Admin: Account', 'Log out', { auth: 'adminAuth' }) },
    '/admin/admins': {
        get: op('Admin: Account', 'List admins', { auth: 'adminAuth' }),
        post: op('Admin: Account', 'Create an admin', { auth: 'adminAuth', body: json(obj({ fullname: str({ minLength: 2 }), email: str({ format: 'email' }), password: str({ minLength: 8 }) }, [ 'fullname', 'email', 'password' ])) }),
    },
    '/admin/admins/{id}': { delete: op('Admin: Account', 'Delete an admin', { auth: 'adminAuth', params: [ idParam ] }) },

    // Admin — monitoring
    '/admin/dashboard': { get: op('Admin: Monitoring', 'Dashboard KPIs and charts', { auth: 'adminAuth', params: [ q('days', str({ enum: [ '7', '30', '90' ] })) ] }) },
    '/admin/live': { get: op('Admin: Monitoring', 'Active orders and online drivers', { auth: 'adminAuth' }) },
    '/admin/reports': { get: op('Admin: Monitoring', 'Revenue and order report', { auth: 'adminAuth', params: dateParams }) },

    // Admin — orders
    '/admin/rides': { get: op('Admin: Orders', 'List orders', { auth: 'adminAuth', params: [ ...pageParams, ...rideFilterParams ] }) },
    '/admin/rides/export': { get: op('Admin: Orders', 'Export orders as CSV', { auth: 'adminAuth', params: rideFilterParams,
        responses: { 200: { description: 'CSV file', content: { 'text/csv': { schema: str() } } } },
    }) },
    '/admin/rides/{id}': { get: op('Admin: Orders', 'Order details', { auth: 'adminAuth', params: [ idParam ] }) },
    '/admin/rides/{id}/refund': { post: op('Admin: Orders', 'Refund a paid order', { auth: 'adminAuth', params: [ idParam ] }) },
    '/admin/rides/{id}/cancel': { post: op('Admin: Orders', 'Cancel an order', { auth: 'adminAuth', params: [ idParam ], body: { required: false, content: { 'application/json': { schema: obj({ reason: str({ maxLength: 300 }) }) } } } }) },

    // Admin — drivers
    '/admin/captains': { get: op('Admin: Drivers', 'List drivers', { auth: 'adminAuth', params: [
        ...pageParams,
        q('status', str({ enum: [ 'active', 'inactive' ] })),
        q('kycStatus', str({ enum: [ 'pending', 'verified', 'rejected' ] })),
        q('vehicleType', vehicleType),
    ] }) },
    '/admin/captains/{id}': {
        get: op('Admin: Drivers', 'Driver details', { auth: 'adminAuth', params: [ idParam ] }),
        patch: op('Admin: Drivers', 'Edit a driver', { auth: 'adminAuth', params: [ idParam ], body: json(obj({
            fullname: obj({ firstname: str({ minLength: 3 }), lastname: str({ minLength: 3 }) }),
            email: str({ format: 'email' }), phone, status: str({ enum: [ 'active', 'inactive' ] }),
            vehicle: obj({ color: str({ minLength: 3 }), plate: str({ minLength: 3 }), capacity: int({ minimum: 1 }), vehicleType }),
        })) }),
        delete: op('Admin: Drivers', 'Delete a driver', { auth: 'adminAuth', params: [ idParam ] }),
    },
    '/admin/captains/{id}/kyc/{document}': { get: op('Admin: Drivers', 'Download a KYC document', { auth: 'adminAuth',
        params: [ idParam, { name: 'document', in: 'path', required: true, schema: str({ enum: [ 'license', 'identity' ] }) } ],
        responses: { 200: { description: 'The document file', content: { 'application/octet-stream': { schema: str({ format: 'binary' }) } } } },
    }) },
    '/admin/captains/{id}/kyc': { patch: op('Admin: Drivers', 'Approve or reject KYC', { auth: 'adminAuth', params: [ idParam ], body: json(obj({ status: str({ enum: [ 'verified', 'rejected' ] }), reviewNote: str({ maxLength: 500 }) }, [ 'status' ])) }) },
    '/admin/captains/{id}/block': { patch: op('Admin: Drivers', 'Block or unblock a driver', { auth: 'adminAuth', params: [ idParam ], body: blockBody }) },

    // Admin — customers
    '/admin/users': { get: op('Admin: Customers', 'List customers', { auth: 'adminAuth', params: pageParams }) },
    '/admin/users/{id}': {
        get: op('Admin: Customers', 'Customer details', { auth: 'adminAuth', params: [ idParam ] }),
        patch: op('Admin: Customers', 'Edit a customer', { auth: 'adminAuth', params: [ idParam ], body: json(obj({
            fullname: obj({ firstname: str({ minLength: 3 }), lastname: str({ minLength: 3 }) }), email: str({ format: 'email' }), phone,
        })) }),
        delete: op('Admin: Customers', 'Delete a customer', { auth: 'adminAuth', params: [ idParam ] }),
    },
    '/admin/users/{id}/block': { patch: op('Admin: Customers', 'Block or unblock a customer', { auth: 'adminAuth', params: [ idParam ], body: blockBody }) },

    // Admin — pricing
    '/admin/settings/fares': {
        get: op('Admin: Pricing', 'Fare settings per vehicle', { auth: 'adminAuth' }),
        put: op('Admin: Pricing', 'Update fare settings', { auth: 'adminAuth', body: json(obj({
            helperCharge: num({ minimum: 0, maximum: 10000 }),
            ...Object.fromEntries(VEHICLE_TYPES.map(type => [ type, obj({ baseFare: num({ minimum: 0, maximum: 10000 }), perKm: num({ minimum: 0, maximum: 1000 }), perMinute: num({ minimum: 0, maximum: 1000 }) }, [ 'baseFare', 'perKm', 'perMinute' ]) ])),
        }, [ 'helperCharge', ...VEHICLE_TYPES ])) }),
    },
    '/admin/settings/commission': {
        get: op('Admin: Pricing', 'Commission settings', { auth: 'adminAuth' }),
        put: op('Admin: Pricing', 'Update commission (default + time slots)', { auth: 'adminAuth', body: json(obj({
            defaultPercent: num({ minimum: 0, maximum: 100 }),
            slots: arr(obj({ name: str({ maxLength: 40 }), start: hhmm, end: hhmm, percent: num({ minimum: 0, maximum: 100 }), days: arr(int({ minimum: 0, maximum: 6 })), vehicleTypes: arr(vehicleType) }, [ 'name', 'start', 'end', 'percent' ]), { maxItems: 20 }),
        }, [ 'defaultPercent', 'slots' ])) }),
    },
    '/admin/promos': {
        get: op('Admin: Pricing', 'List offers or coupons', { auth: 'adminAuth', params: [ q('kind', str({ enum: [ 'offer', 'coupon' ] }), { required: true }) ] }),
        post: op('Admin: Pricing', 'Create an offer or coupon', { auth: 'adminAuth', body: json({ ...promoBody, required: [ 'kind', ...promoBody.required ] }), responses: { 201: ok('Created') } }),
    },
    '/admin/promos/{id}': {
        put: op('Admin: Pricing', 'Update an offer or coupon', { auth: 'adminAuth', params: [ idParam ], body: json(promoBody) }),
        delete: op('Admin: Pricing', 'Delete an offer or coupon', { auth: 'adminAuth', params: [ idParam ] }),
    },

    // Admin — integrations & notifications
    '/admin/settings/integrations': { get: op('Admin: Integrations', 'All integration settings (secrets masked)', { auth: 'adminAuth' }) },
    '/admin/settings/integrations/{name}': { put: op('Admin: Integrations', 'Save an integration', { auth: 'adminAuth', params: [ integrationParam ],
        body: json({ ...integrationFields, properties: { ...integrationFields.properties, clearSecrets: arr(str(), { description: 'Secret field names to erase' }) } }),
    }) },
    '/admin/settings/integrations/{name}/test': { post: op('Admin: Integrations', 'Test an integration with unsaved values', { auth: 'adminAuth', params: [ integrationParam ],
        body: json(obj({ values: integrationFields, testTo: str({ maxLength: 200, description: 'Email / phone / token to send a test to' }) })),
    }) },
    '/admin/notifications': { get: op('Admin: Integrations', 'Notification rules per event', { auth: 'adminAuth' }) },
    '/admin/notifications/rules': { put: op('Admin: Integrations', 'Update notification rules', { auth: 'adminAuth', body: json(obj({ rules: { type: 'object', additionalProperties: true } }, [ 'rules' ])) }) },
    '/admin/notifications/log': { get: op('Admin: Integrations', 'Notification delivery log', { auth: 'adminAuth', params: [
        ...pageParams,
        q('channel', str({ enum: [ 'email', 'sms', 'whatsapp', 'push' ] })),
        q('status', str({ enum: [ 'sent', 'failed', 'skipped' ] })),
    ] }) },
    '/admin/notifications/test': { post: op('Admin: Integrations', 'Send a test notification', { auth: 'adminAuth', body: json(obj({ channel: str({ enum: [ 'email', 'sms', 'whatsapp', 'push' ] }), to: str({ minLength: 3, maxLength: 200 }) }, [ 'channel', 'to' ])) }) },
};

const bearer = (description) => ({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description });

module.exports = {
    openapi: '3.0.3',
    info: {
        title: 'Khushi Transport API',
        version: '1.0.0',
        description: 'Goods-transport booking API for customers, drivers (captains), fleet vendors and admins.\n\n'
            + '**Auth:** call a login endpoint, copy `token` from the response, then click **Authorize** and paste it into the matching scheme. '
            + 'Each role has its own token; a customer token is rejected on driver/admin routes.\n\n'
            + 'Real-time updates (new orders, driver location, payment) go over Socket.IO on the same host and are not listed here.',
    },
    servers: [ { url: '/', description: 'This server' } ],
    tags: [ 'Users', 'Captains', 'Vendors', 'Maps', 'Rides', 'Payments', 'Notifications',
        'Admin: Account', 'Admin: Monitoring', 'Admin: Orders', 'Admin: Drivers', 'Admin: Customers', 'Admin: Pricing', 'Admin: Integrations' ]
        .map(name => ({ name })),
    components: {
        securitySchemes: {
            userAuth: bearer('Customer token from POST /users/login'),
            captainAuth: bearer('Driver token from POST /captains/login'),
            vendorAuth: bearer('Vendor token from POST /vendors/login'),
            adminAuth: bearer('Admin token from POST /admin/login'),
        },
        schemas: {
            Message: obj({ message: str() }),
            ValidationError: obj({ errors: arr(obj({ msg: str(), path: str(), location: str() })) }),
        },
    },
    paths,
};
