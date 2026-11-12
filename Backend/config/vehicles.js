// Goods vehicles offered for booking. The same keys are used on rides
// (ride.vehicleType) and on drivers (captain.vehicle.vehicleType).
// Keep in sync with frontend/src/vehicles.js.
const VEHICLES = [
    { key: 'two_wheeler', label: '2 Wheeler', capacityKg: 20, fare: { baseFare: 40, perKm: 8, perMinute: 1 } },
    { key: 'three_wheeler', label: '3 Wheeler', capacityKg: 500, fare: { baseFare: 150, perKm: 18, perMinute: 1.5 } },
    { key: 'mini_truck', label: 'Mini Truck', capacityKg: 750, fare: { baseFare: 250, perKm: 25, perMinute: 2 } },
    { key: 'pickup', label: 'Pickup 8 ft', capacityKg: 1250, fare: { baseFare: 350, perKm: 30, perMinute: 2.5 } },
    { key: 'truck', label: 'Truck 14 ft', capacityKg: 2500, fare: { baseFare: 600, perKm: 40, perMinute: 3 } },
];

const GOODS_TYPES = [
    'Furniture / Home items',
    'Electronics / Appliances',
    'Groceries / FMCG',
    'Building / Hardware material',
    'Machinery / Equipment',
    'Textile / Garments',
    'Documents / Parcels',
    'Other',
];

const VEHICLE_TYPES = VEHICLES.map(v => v.key);
const VEHICLE_BY_KEY = Object.fromEntries(VEHICLES.map(v => [ v.key, v ]));

module.exports = {
    VEHICLES,
    VEHICLE_TYPES,
    VEHICLE_BY_KEY,
    GOODS_TYPES,
    // Loading/unloading helpers a customer can add to a booking
    MAX_HELPERS: 2,
    DEFAULT_HELPER_CHARGE: 150,
    vehicleLabel: (key) => VEHICLE_BY_KEY[ key ]?.label || key || '',
};
