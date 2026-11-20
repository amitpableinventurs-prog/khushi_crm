const captainModel = require('../models/captain.model');
const captainService = require('../services/captain.service');
const blackListTokenModel = require('../models/blackListToken.model');
const { validationResult } = require('express-validator');

const isValidDocument = (file) => {
    if (!file) return false
    const bytes = file.buffer
    if (file.mimetype === 'application/pdf') return bytes.subarray(0, 5).toString() === '%PDF-'
    if (file.mimetype === 'image/jpeg') return bytes[ 0 ] === 0xff && bytes[ 1 ] === 0xd8 && bytes[ 2 ] === 0xff
    if (file.mimetype === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([ 137, 80, 78, 71, 13, 10, 26, 10 ]))
    return false
}

const publicCaptain = (captain) => {
    const result = captain.toObject()
    delete result.password
    if (result.kyc) delete result.kyc.documents
    return result
}

module.exports.registerCaptain = async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { fullname, email, password, vehicle, phone } = req.body;
    const license = req.files?.license?.[ 0 ]
    const identity = req.files?.identity?.[ 0 ]
    if (!isValidDocument(license) || !isValidDocument(identity)) {
        return res.status(400).json({ message: 'Upload a valid driving licence and government ID (PDF, JPG, or PNG; max 3 MB each).' })
    }

    const cleanEmail = email.toLowerCase().trim();

    const isCaptainAlreadyExist = await captainModel.findOne({ email: cleanEmail });

    if (isCaptainAlreadyExist) {
        return res.status(400).json({ message: 'Captain already exist' });
    }

    const hashedPassword = await captainModel.hashPassword(password);

    const captain = await captainService.createCaptain({
        firstname: fullname.firstname,
        lastname: fullname.lastname,
        email: cleanEmail,
        password: hashedPassword,
        color: vehicle.color,
        plate: vehicle.plate,
        capacity: vehicle.capacity,
        vehicleType: vehicle.vehicleType,
        phone: phone?.trim() || undefined,
        kyc: {
            status: 'pending',
            documentsSubmitted: true,
            submittedAt: new Date(),
            documents: {
                license: { content: license.buffer, contentType: license.mimetype },
                identity: { content: identity.buffer, contentType: identity.mimetype },
            },
        }
    });

    captain.status = 'inactive';
    await captain.save();

    const token = captain.generateAuthToken();

    res.status(201).json({ token, captain: publicCaptain(captain) });
}

module.exports.loginCaptain = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array(), message: errors.array()[0]?.msg || 'Validation error' });
    }

    const { email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    const captain = await captainModel.findOne({ email: cleanEmail }).select('+password');

    if (!captain) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await captain.comparePassword(password);

    if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (captain.isBlocked) {
        return res.status(403).json({ message: 'Your account has been blocked. Please contact support.' });
    }

    captain.status = captain.kyc?.status === 'verified' ? 'active' : 'inactive';
    await captain.save();

    const token = captain.generateAuthToken();

    res.cookie('token', token);

    res.status(200).json({ token, captain: publicCaptain(captain) });
}

module.exports.getCaptainProfile = async (req, res, next) => {
    if (req.captain.kyc?.status === 'verified' && req.captain.status !== 'active') {
        req.captain.status = 'active'
        await req.captain.save()
    }
    res.status(200).json({ captain: req.captain });
}

module.exports.submitCaptainKyc = async (req, res) => {
    const license = req.files?.license?.[ 0 ]
    const identity = req.files?.identity?.[ 0 ]
    if (!isValidDocument(license) || !isValidDocument(identity)) {
        return res.status(400).json({ message: 'Upload a valid driving licence and government ID (PDF, JPG, or PNG; max 3 MB each).' })
    }

    const captain = await captainModel.findById(req.captain._id)
        .select('+kyc.documents.license +kyc.documents.license.content +kyc.documents.identity +kyc.documents.identity.content')
    if (!captain) return res.status(404).json({ message: 'Driver account not found.' })
    const hasExistingDocuments = captain.kyc?.documents?.license?.content && captain.kyc?.documents?.identity?.content
    if (captain.kyc?.status === 'verified' || (captain.kyc?.status !== 'rejected' && hasExistingDocuments)) {
        return res.status(409).json({ message: 'KYC documents can only be resubmitted after a rejection.' })
    }

    captain.kyc = {
        status: 'pending',
        documentsSubmitted: true,
        submittedAt: new Date(),
        reviewNote: undefined,
        documents: {
            license: { content: license.buffer, contentType: license.mimetype },
            identity: { content: identity.buffer, contentType: identity.mimetype },
        },
    }
    captain.status = 'inactive'
    await captain.save()
    return res.status(200).json({ captain: publicCaptain(captain), message: 'Documents submitted for verification.' })
}

module.exports.logoutCaptain = async (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[ 1 ];

    if (req.captain?._id) {
        await captainModel.findByIdAndUpdate(req.captain._id, { status: 'inactive' });
    }

    if (token) {
        await blackListTokenModel.create({ token });
    }

    res.clearCookie('token');

    res.status(200).json({ message: 'Logout successfully' });
}

module.exports.forgotPassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array(), message: errors.array()[0]?.msg });
    }

    const { email } = req.body;
    const cleanEmail = email.toLowerCase().trim();
    const captain = await captainModel.findOne({ email: cleanEmail });

    if (!captain) {
        return res.status(404).json({ message: 'Captain with this email does not exist' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    captain.resetOtp = otp;
    captain.resetOtpExpires = Date.now() + 15 * 60 * 1000;
    await captain.save();

    try {
        const emailService = require('../services/email.service');
        await emailService.sendPasswordResetEmail({
            to: captain.email,
            otp,
            userName: captain.fullname?.firstname || 'Captain'
        });
        return res.status(200).json({ message: 'Password reset OTP sent to your email.' });
    } catch (err) {
        return res.status(500).json({ message: err.message || 'Failed to send reset email.' });
    }
};

module.exports.resetPassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array(), message: errors.array()[0]?.msg });
    }

    const { email, otp, newPassword } = req.body;
    const cleanEmail = email.toLowerCase().trim();
    const captain = await captainModel.findOne({ email: cleanEmail }).select('+resetOtp +resetOtpExpires +password');

    if (!captain || captain.resetOtp !== otp || !captain.resetOtpExpires || captain.resetOtpExpires < Date.now()) {
        return res.status(400).json({ message: 'Invalid or expired OTP code.' });
    }

    const hashedPassword = await captainModel.hashPassword(newPassword);
    captain.password = hashedPassword;
    captain.resetOtp = undefined;
    captain.resetOtpExpires = undefined;
    captain.status = captain.kyc?.status === 'verified' ? 'active' : 'inactive';
    await captain.save();

    return res.status(200).json({ message: 'Password reset successful. You can now log in.' });
};