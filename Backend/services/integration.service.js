const crypto = require('crypto');
const settingModel = require('../models/setting.model');

// Third-party integrations editable from the admin panel.
// Values saved by an admin win; otherwise the .env value (or default) is used.
// Secret fields are stored AES-256-GCM encrypted and are never sent back to the browser.
const DEFINITIONS = {
    googleMaps: {
        enabled: { type: 'boolean', env: () => Boolean(process.env.GOOGLE_MAPS_API), default: false },
        apiKey: { type: 'string', secret: true, env: () => process.env.GOOGLE_MAPS_API },
    },
    openStreetMap: {
        enabled: { type: 'boolean', default: true },
        countryCode: { type: 'string', default: 'in' },
        contactEmail: { type: 'string', default: '' },
    },
    smtp: {
        enabled: { type: 'boolean', env: () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS), default: false },
        host: { type: 'string', env: () => process.env.SMTP_HOST },
        port: { type: 'number', env: () => process.env.SMTP_PORT && Number(process.env.SMTP_PORT), default: 587 },
        user: { type: 'string', env: () => process.env.SMTP_USER },
        password: { type: 'string', secret: true, env: () => process.env.SMTP_PASS },
        fromName: { type: 'string', default: 'Khushi Transport' },
        fromEmail: { type: 'string', env: () => process.env.SMTP_USER },
    },
    razorpay: {
        enabled: { type: 'boolean', env: () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET), default: false },
        keyId: { type: 'string', env: () => process.env.RAZORPAY_KEY_ID },
        keySecret: { type: 'string', secret: true, env: () => process.env.RAZORPAY_KEY_SECRET },
        webhookSecret: { type: 'string', secret: true, env: () => process.env.RAZORPAY_WEBHOOK_SECRET },
        allowCash: { type: 'boolean', default: true },
    },
    // One Twilio account serves both SMS (`enabled`) and WhatsApp (`whatsappEnabled`)
    twilio: {
        enabled: { type: 'boolean', default: false },
        accountSid: { type: 'string', env: () => process.env.TWILIO_ACCOUNT_SID },
        authToken: { type: 'string', secret: true, env: () => process.env.TWILIO_AUTH_TOKEN },
        smsFrom: { type: 'string', env: () => process.env.TWILIO_SMS_FROM },
        whatsappEnabled: { type: 'boolean', default: false },
        whatsappFrom: { type: 'string', env: () => process.env.TWILIO_WHATSAPP_FROM },
        defaultCountryCode: { type: 'string', default: '+91' },
    },
    // Browser push via Firebase Cloud Messaging. The service-account JSON is used by the
    // server to send; the web* values are public and are given to browsers to subscribe.
    firebase: {
        enabled: { type: 'boolean', default: false },
        serviceAccountJson: { type: 'string', secret: true },
        webApiKey: { type: 'string' },
        webAppId: { type: 'string' },
        messagingSenderId: { type: 'string' },
        vapidKey: { type: 'string' },
    },
};

const SETTING_KEY = 'integrations';
const CACHE_MS = 30 * 1000;
let cache = null;

module.exports.NAMES = Object.keys(DEFINITIONS);
module.exports.DEFINITIONS = DEFINITIONS;

const encryptionKey = () => crypto.createHash('sha256').update(`${process.env.JWT_SECRET}:integrations`).digest();

function encrypt(text) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const data = Buffer.concat([ cipher.update(text, 'utf8'), cipher.final() ]);
    return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

function decrypt(box) {
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(box.iv, 'base64'));
        decipher.setAuthTag(Buffer.from(box.tag, 'base64'));
        return Buffer.concat([ decipher.update(Buffer.from(box.data, 'base64')), decipher.final() ]).toString('utf8');
    } catch (err) {
        // happens if JWT_SECRET changed after the value was saved
        console.error('Could not decrypt a saved integration secret; re-enter it in the admin panel.');
        return undefined;
    }
}

async function loadSaved() {
    const setting = await settingModel.findOne({ key: SETTING_KEY }).lean();
    return setting?.value || {};
}

// Effective value of every field plus where it came from: 'admin', 'env' or 'default'
function resolve(saved) {
    return Object.fromEntries(Object.entries(DEFINITIONS).map(([ name, fields ]) => [ name, Object.fromEntries(
        Object.entries(fields).map(([ field, def ]) => {
            const stored = saved[ name ]?.[ field ];
            if (stored !== undefined && stored !== null) {
                const value = def.secret ? decrypt(stored) : stored;
                if (value !== undefined) return [ field, { value, source: 'admin' } ];
            }
            const envValue = def.env?.();
            if (envValue !== undefined && envValue !== '' && envValue !== false) return [ field, { value: envValue, source: 'env' } ];
            return [ field, { value: def.default ?? '', source: 'default' } ];
        })
    ) ]));
}

// Plain config object for services, e.g. (await get('smtp')).host
module.exports.get = async (name) => {
    if (!cache || cache.expires < Date.now()) {
        cache = { value: resolve(await loadSaved()), expires: Date.now() + CACHE_MS };
    }
    return Object.fromEntries(Object.entries(cache.value[ name ]).map(([ field, { value } ]) => [ field, value ]));
}

const mask = (value) => {
    if (!value) return '';
    try {
        // a saved service-account file: say which project it is for
        const projectId = JSON.parse(value).project_id;
        if (projectId) return `file for project "${projectId}"`;
    } catch {}
    return `••••${String(value).slice(-4)}`;
};

// What the admin panel shows: secrets masked, with each field's source
module.exports.getForAdmin = async () => {
    const resolved = resolve(await loadSaved());
    return Object.fromEntries(Object.entries(resolved).map(([ name, fields ]) => [ name, Object.fromEntries(
        Object.entries(fields).map(([ field, { value, source } ]) => [
            field,
            DEFINITIONS[ name ][ field ].secret
                ? { hasValue: Boolean(value), masked: mask(value), source }
                : { value, source },
        ])
    ) ]));
}

/**
 * Saves one integration. For secret fields: omitted/empty keeps the saved value,
 * and `clearSecrets: ['apiKey']` removes it.
 */
module.exports.update = async (name, values, clearSecrets = []) => {
    const saved = await loadSaved();
    const next = { ...(saved[ name ] || {}) };

    for (const [ field, def ] of Object.entries(DEFINITIONS[ name ])) {
        if (def.secret) {
            if (clearSecrets.includes(field)) delete next[ field ];
            else if (typeof values[ field ] === 'string' && values[ field ].trim()) next[ field ] = encrypt(values[ field ].trim());
            continue;
        }
        if (values[ field ] === undefined || (def.type === 'number' && values[ field ] === '')) continue;
        if (def.type === 'boolean') next[ field ] = Boolean(values[ field ]);
        else if (def.type === 'number') next[ field ] = Number(values[ field ]);
        else next[ field ] = String(values[ field ]).trim();
    }

    await settingModel.findOneAndUpdate(
        { key: SETTING_KEY },
        { value: { ...saved, [ name ]: next } },
        { upsert: true }
    );
    cache = null;
    return module.exports.getForAdmin();
}

// Config to test with: saved/effective values overridden by what the admin just typed (unsaved)
module.exports.withOverrides = async (name, overrides = {}) => {
    const current = await module.exports.get(name);
    const merged = { ...current };
    for (const [ field, def ] of Object.entries(DEFINITIONS[ name ])) {
        const v = overrides[ field ];
        if (v === undefined || (def.secret && !String(v).trim())) continue;
        merged[ field ] = def.type === 'number' ? Number(v) : def.type === 'boolean' ? Boolean(v) : String(v).trim();
    }
    return merged;
}
