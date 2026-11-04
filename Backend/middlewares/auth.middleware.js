const userModel = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const blackListTokenModel = require('../models/blackListToken.model');
const captainModel = require('../models/captain.model');
const adminModel = require('../models/admin.model');


module.exports.authUser = async (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[ 1 ];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }


    const isBlacklisted = await blackListTokenModel.findOne({ token: token });

    if (isBlacklisted) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded._id)

        // deleted or blocked by an admin
        if (!user || user.isBlocked) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        req.user = user;

        return next();

    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
}

module.exports.authCaptain = async (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[ 1 ];


    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const isBlacklisted = await blackListTokenModel.findOne({ token: token });



    if (isBlacklisted) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const captain = await captainModel.findById(decoded._id)

        // deleted or blocked by an admin
        if (!captain || captain.isBlocked) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        req.captain = captain;

        return next()
    } catch (err) {
        console.log(err);

        res.status(401).json({ message: 'Unauthorized' });
    }
}

module.exports.authAdmin = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[ 1 ];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const isBlacklisted = await blackListTokenModel.findOne({ token: token });

    if (isBlacklisted) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const admin = await adminModel.findById(decoded._id);
        if (!admin) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        req.admin = admin;
        req.token = token;

        return next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
}


// Accepts a rider or a captain token; sets req.account = { type: 'user' | 'captain', model, doc }
module.exports.authUserOrCaptain = async (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[ 1 ];

    if (!token || await blackListTokenModel.findOne({ token: token })) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'admin') {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await userModel.findById(decoded._id);
        const captain = user ? null : await captainModel.findById(decoded._id);
        const doc = user || captain;
        if (!doc || doc.isBlocked) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        req.account = { type: user ? 'user' : 'captain', model: user ? userModel : captainModel, doc };
        return next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
}
