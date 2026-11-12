const settingModel = require('../models/setting.model');
const { VEHICLES, VEHICLE_TYPES, DEFAULT_HELPER_CHARGE } = require('../config/vehicles');

// Used until an admin saves custom rates
const DEFAULT_FARES = Object.fromEntries(VEHICLES.map(v => [ v.key, v.fare ]));

module.exports.VEHICLE_TYPES = VEHICLE_TYPES;

// Returns { <vehicleType>: { baseFare, perKm, perMinute }, ..., helperCharge }
module.exports.getFareSettings = async () => {
    const setting = await settingModel.findOne({ key: 'fares' }).lean();
    const saved = setting?.value || {};

    const fares = Object.fromEntries(Object.entries(DEFAULT_FARES).map(([ type, defaults ]) => (
        [ type, { ...defaults, ...saved[ type ] } ]
    )));
    // Charged per loading helper
    fares.helperCharge = Number.isFinite(saved.helperCharge) ? saved.helperCharge : DEFAULT_HELPER_CHARGE;
    return fares;
}

module.exports.updateFareSettings = async (fares) => {
    await settingModel.findOneAndUpdate(
        { key: 'fares' },
        { value: fares },
        { upsert: true }
    );
    return module.exports.getFareSettings();
}
