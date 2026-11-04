const settingModel = require('../models/setting.model');

// Used until an admin saves custom rates
const DEFAULT_FARES = {
    auto: { baseFare: 30, perKm: 10, perMinute: 2 },
    car: { baseFare: 50, perKm: 15, perMinute: 3 },
    moto: { baseFare: 20, perKm: 8, perMinute: 1.5 },
};

module.exports.VEHICLE_TYPES = Object.keys(DEFAULT_FARES);

module.exports.getFareSettings = async () => {
    const setting = await settingModel.findOne({ key: 'fares' }).lean();
    const saved = setting?.value || {};

    return Object.fromEntries(Object.entries(DEFAULT_FARES).map(([ type, defaults ]) => (
        [ type, { ...defaults, ...saved[ type ] } ]
    )));
}

module.exports.updateFareSettings = async (fares) => {
    await settingModel.findOneAndUpdate(
        { key: 'fares' },
        { value: fares },
        { upsert: true }
    );
    return module.exports.getFareSettings();
}
