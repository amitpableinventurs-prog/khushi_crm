const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


const adminSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        select: false,
    },
})

// role claim keeps user/captain tokens (same secret) from passing as admin tokens
adminSchema.methods.generateAuthToken = function () {
    const token = jwt.sign({ _id: this._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
    return token;
}

adminSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
}

adminSchema.statics.hashPassword = async function (password) {
    return await bcrypt.hash(password, 10);
}

const adminModel = mongoose.model('admin', adminSchema);


module.exports = adminModel;
