const integrationService = require('../services/integration.service');
const fcmService = require('../services/fcm.service');
const { validationResult } = require('express-validator');

const MAX_DEVICES = 10;

// Public Firebase web config so the browser can subscribe (not secret by Firebase's design)
module.exports.getPushConfig = async (req, res) => {
    try {
        res.status(200).json(fcmService.webConfig(await integrationService.get('firebase')));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

module.exports.savePushToken = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { model, doc } = req.account;
    const { token } = req.body;

    // move the token to the end and keep only the newest devices
    await model.updateOne({ _id: doc._id }, { $pull: { pushTokens: token } });
    await model.updateOne({ _id: doc._id }, { $push: { pushTokens: { $each: [ token ], $slice: -MAX_DEVICES } } });

    res.status(200).json({ message: 'Notifications turned on for this device' });
}

module.exports.removePushToken = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { model, doc } = req.account;
    await model.updateOne({ _id: doc._id }, { $pull: { pushTokens: req.body.token } });

    res.status(200).json({ message: 'Notifications turned off for this device' });
}
