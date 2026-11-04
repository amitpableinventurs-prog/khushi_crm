const axios = require('axios');
const jwt = require('jsonwebtoken');

// Firebase Cloud Messaging HTTP v1 API, authenticated with a service account
// (https://firebase.google.com/docs/cloud-messaging/send-message)

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const tokenCache = new Map();

module.exports.parseServiceAccount = (json) => {
    if (!json) return null;
    try {
        const sa = JSON.parse(json);
        if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
        return sa;
    } catch {
        return null;
    }
}

async function getAccessToken(sa) {
    const cached = tokenCache.get(sa.client_email);
    if (cached && cached.expires > Date.now() + 60000) return cached.token;

    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt.sign(
        { iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 },
        sa.private_key,
        { algorithm: 'RS256' }
    );
    const { data } = await axios.post(TOKEN_URL, new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
    }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 });

    tokenCache.set(sa.client_email, { token: data.access_token, expires: Date.now() + data.expires_in * 1000 });
    return data.access_token;
}

const fcmError = (err) => err.response?.data?.error?.message || err.response?.data?.error_description || err.message;

// Sends to one device token. `invalidToken` tells the caller to forget that token.
module.exports.send = async (sa, token, { title, body, link, data = {} }) => {
    try {
        const accessToken = await getAccessToken(sa);
        await axios.post(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
            message: {
                token,
                notification: { title, body },
                data: Object.fromEntries(Object.entries(data).map(([ k, v ]) => [ k, String(v) ])),
                webpush: link ? { fcm_options: { link } } : undefined,
            },
        }, { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 });
        return { ok: true };
    } catch (err) {
        const code = err.response?.data?.error?.details?.find(d => d.errorCode)?.errorCode;
        return { ok: false, invalidToken: code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT', error: fcmError(err) };
    }
}

// Validates credentials without delivering anything (validate_only)
module.exports.testCredentials = async (config) => {
    const sa = module.exports.parseServiceAccount(config.serviceAccountJson);
    if (!sa) return { ok: false, message: 'Paste the full service-account JSON file (it must contain project_id, client_email and private_key).' };
    try {
        const accessToken = await getAccessToken(sa);
        await axios.post(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
            validate_only: true,
            message: { topic: 'connection-test', notification: { title: 'Test', body: 'Test' } },
        }, { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 });

        const missingWeb = [ [ 'webApiKey', 'Web API key' ], [ 'webAppId', 'App ID' ], [ 'messagingSenderId', 'Sender ID' ], [ 'vapidKey', 'VAPID key' ] ]
            .filter(([ key ]) => !config[ key ]).map(([ , label ]) => label);
        return missingWeb.length
            ? { ok: false, message: `Server credentials work for project "${sa.project_id}", but browsers can't subscribe until you fill in: ${missingWeb.join(', ')}.` }
            : { ok: true, message: `Connected to Firebase project "${sa.project_id}". Browsers can now subscribe to notifications.` };
    } catch (err) {
        return { ok: false, message: `Firebase: ${fcmError(err)}` };
    }
}

// Public values a browser needs to subscribe (these are not secrets in Firebase's model)
module.exports.webConfig = (config) => {
    const sa = module.exports.parseServiceAccount(config.serviceAccountJson);
    const ready = Boolean(config.enabled && sa && config.webApiKey && config.webAppId && config.messagingSenderId && config.vapidKey);
    if (!ready) return { enabled: false };
    return {
        enabled: true,
        vapidKey: config.vapidKey,
        firebase: {
            apiKey: config.webApiKey,
            projectId: sa.project_id,
            messagingSenderId: config.messagingSenderId,
            appId: config.webAppId,
        },
    };
}
