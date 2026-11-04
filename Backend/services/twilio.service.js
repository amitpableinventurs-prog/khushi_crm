const axios = require('axios');

// Twilio Messages API, used for both SMS and WhatsApp (https://www.twilio.com/docs/messaging/api)

// '98765 43210' + '+91' -> '+919876543210'; returns null if it doesn't look like a phone number
module.exports.normalizePhone = (phone, defaultCountryCode = '+91') => {
    if (!phone) return null;
    const trimmed = String(phone).trim();
    const digits = trimmed.replace(/\D/g, '');
    if (trimmed.startsWith('+')) return digits.length >= 8 ? `+${digits}` : null;
    if (digits.startsWith('00')) return `+${digits.slice(2)}`;
    if (digits.length === 10) return `${defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`}${digits}`;
    return digits.length >= 11 ? `+${digits}` : null;
}

const api = (config) => axios.create({
    baseURL: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}`,
    auth: { username: config.accountSid, password: config.authToken },
    timeout: 15000,
});

const twilioError = (err) => new Error(err.response?.data?.message || err.message);

// channel: 'sms' | 'whatsapp'
module.exports.send = async (config, { to, body, channel }) => {
    const params = new URLSearchParams({ Body: body });
    if (channel === 'whatsapp') {
        params.set('From', `whatsapp:${config.whatsappFrom.replace(/^whatsapp:/, '')}`);
        params.set('To', `whatsapp:${to}`);
    } else {
        // a Messaging Service SID (MG...) or a Twilio phone number
        if (/^MG[0-9a-f]{32}$/i.test(config.smsFrom)) params.set('MessagingServiceSid', config.smsFrom);
        else params.set('From', config.smsFrom);
        params.set('To', to);
    }

    try {
        const { data } = await api(config).post('/Messages.json', params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return { sid: data.sid, status: data.status };
    } catch (err) {
        throw twilioError(err);
    }
}

module.exports.testCredentials = async (config) => {
    if (!config.accountSid || !config.authToken) return { ok: false, message: 'Enter the Account SID and Auth Token first.' };
    try {
        const { data } = await api(config).get('.json');
        return { ok: true, message: `Connected to Twilio account "${data.friendly_name}" (${data.status}).` };
    } catch (err) {
        if (err.response?.status === 401) return { ok: false, message: 'Twilio rejected the Account SID / Auth Token.' };
        return { ok: false, message: twilioError(err).message };
    }
}
