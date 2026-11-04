const axios = require('axios');
const crypto = require('crypto');
const integrationService = require('./integration.service');

// Razorpay REST API (https://razorpay.com/docs/api/). Keys come from Admin > Integrations.
const API = 'https://api.razorpay.com/v1';

const client = (config) => axios.create({
    baseURL: API,
    auth: { username: config.keyId, password: config.keySecret },
    timeout: 15000,
});

const razorpayError = (err) => {
    const message = err.response?.data?.error?.description || err.message;
    return new Error(`Razorpay: ${message}`);
}

module.exports.getConfig = async () => {
    const config = await integrationService.get('razorpay');
    return { ...config, online: Boolean(config.enabled && config.keyId && config.keySecret) };
}

// amount is in rupees; Razorpay works in paise
module.exports.createOrder = async (config, { amount, receipt, notes }) => {
    try {
        const { data } = await client(config).post('/orders', {
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt,
            notes,
        });
        return data;
    } catch (err) {
        throw razorpayError(err);
    }
}

const safeEqual = (a, b) => {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Checkout success handler signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
module.exports.verifyPaymentSignature = (config, { orderId, paymentId, signature }) => {
    const expected = crypto.createHmac('sha256', config.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    return safeEqual(expected, signature);
}

// Webhook signature: HMAC_SHA256(raw request body, webhook_secret)
module.exports.verifyWebhookSignature = (config, rawBody, signature) => {
    if (!config.webhookSecret || !signature) return false;
    const expected = crypto.createHmac('sha256', config.webhookSecret).update(rawBody).digest('hex');
    return safeEqual(expected, signature);
}

module.exports.fetchPayment = async (config, paymentId) => {
    try {
        const { data } = await client(config).get(`/payments/${paymentId}`);
        return data;
    } catch (err) {
        throw razorpayError(err);
    }
}

module.exports.refund = async (config, paymentId, amount) => {
    try {
        const { data } = await client(config).post(`/payments/${paymentId}/refund`, amount ? { amount: Math.round(amount * 100) } : {});
        return data;
    } catch (err) {
        throw razorpayError(err);
    }
}

// Used by the admin "Test connection" button
module.exports.testCredentials = async (config) => {
    if (!config.keyId || !config.keySecret) return { ok: false, message: 'Enter the Key ID and Key Secret first.' };
    try {
        await client(config).get('/orders', { params: { count: 1 } });
        const mode = config.keyId.startsWith('rzp_live_') ? 'LIVE mode — real money' : 'Test mode — no real money moves';
        return { ok: true, message: `Connected to Razorpay (${mode}).` };
    } catch (err) {
        if (err.response?.status === 401) return { ok: false, message: 'Razorpay rejected the Key ID / Key Secret.' };
        return { ok: false, message: razorpayError(err).message };
    }
}
