const userModel = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const blackListTokenModel = require('../models/blackListToken.model');
const captainModel = require('../models/captain.model');
const adminModel = require('../models/admin.model');
const vendorModel = require('../models/vendor.model');


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
        if (decoded.role && decoded.role !== 'user') {
            return res.status(401).json({ message: 'Unauthorized' });
        }
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
        if (decoded.role && decoded.role !== 'captain') {
            return res.status(401).json({ message: 'Unauthorized' });
        }
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

module.exports.requireVerifiedCaptain = (req, res, next) => {
    if (req.captain?.kyc?.status !== 'verified') {
        return res.status(403).json({
            message: 'Driver KYC must be approved before accepting or managing rides.',
            kycStatus: req.captain?.kyc?.status || 'pending',
        });
    }
    return next()
}

module.exports.authVendor = async (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[ 1 ];
    if (!token || await blackListTokenModel.findOne({ token })) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'vendor') return res.status(401).json({ message: 'Unauthorized' });
        const vendor = await vendorModel.findById(decoded._id);
        if (!vendor || vendor.isBlocked) return res.status(401).json({ message: 'Unauthorized' });
        req.vendor = vendor;
        req.token = token;
        return next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized' });
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
        if (decoded.role && ![ 'user', 'captain' ].includes(decoded.role)) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        let user = null
        let captain = null
        if (decoded.role === 'captain') {
            captain = await captainModel.findById(decoded._id)
        } else {
            user = await userModel.findById(decoded._id)
            if (!user) captain = await captainModel.findById(decoded._id)
        }
        const doc = user || captain
        if (!doc || doc.isBlocked) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        req.account = { type: user ? 'user' : 'captain', model: user ? userModel : captainModel, doc };
        return next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
}
