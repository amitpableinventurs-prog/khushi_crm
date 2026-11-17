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

// ---------- Platform commission ----------
// { defaultPercent, slots: [ { name, start: 'HH:MM', end: 'HH:MM', days: [0-6], vehicleTypes: [], percent } ] }
// The first slot that matches the booking time (India time) wins; otherwise defaultPercent.
const DEFAULT_COMMISSION = { defaultPercent: 10, slots: [] };

module.exports.getCommissionSettings = async () => {
    const setting = await settingModel.findOne({ key: 'commission' }).lean();
    return { ...DEFAULT_COMMISSION, ...setting?.value };
}

module.exports.updateCommissionSettings = async (value) => {
    await settingModel.findOneAndUpdate({ key: 'commission' }, { value }, { upsert: true });
    return module.exports.getCommissionSettings();
}
