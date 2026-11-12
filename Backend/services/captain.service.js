const captainModel = require('../models/captain.model');


module.exports.createCaptain = async ({
    firstname, lastname, email, password, color, plate, capacity, vehicleType, phone, kyc
}) => {
    if (!firstname || !email || !password || !color || !plate || !capacity || !vehicleType) {
        throw new Error('All fields are required');
    }
    const captain = captainModel.create({
        fullname: {
            firstname,
            lastname
        },
        email,
        password,
        phone,
        kyc,
        vehicle: {
            color,
            plate,
            capacity,
            vehicleType
        }
    })

    return captain;
}