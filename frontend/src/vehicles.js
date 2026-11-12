// Goods vehicles and goods categories shown in the customer, driver and admin apps.
// Keep keys, capacities and goods types in sync with Backend/config/vehicles.js.
export const VEHICLES = [
  { key: 'two_wheeler', label: '2 Wheeler', capacityKg: 20, icon: 'ri-motorbike-fill', desc: 'Documents, parcels and small packets' },
  { key: 'three_wheeler', label: '3 Wheeler', capacityKg: 500, icon: 'ri-caravan-fill', desc: 'Small shop stock and light household items' },
  { key: 'mini_truck', label: 'Mini Truck', capacityKg: 750, icon: 'ri-truck-line', desc: 'Furniture, appliances and cartons' },
  { key: 'pickup', label: 'Pickup 8 ft', capacityKg: 1250, icon: 'ri-truck-fill', desc: 'Bulk goods and 1 BHK shifting' },
  { key: 'truck', label: 'Truck 14 ft', capacityKg: 2500, icon: 'ri-truck-fill', desc: 'Heavy loads and full house shifting' },
]

export const VEHICLE_BY_KEY = Object.fromEntries(VEHICLES.map(v => [ v.key, v ]))

export const VEHICLE_LABELS = {
  ...Object.fromEntries(VEHICLES.map(v => [ v.key, v.label ])),
  unknown: 'Not recorded',
}

export const vehicleLabel = (key) => VEHICLE_LABELS[ key ] || key || 'Vehicle'

export const formatCapacity = (kg) => {
  const value = Number(kg)
  if (!value) return ''
  return value >= 1000 ? `${value / 1000} ton` : `${value} kg`
}

export const GOODS_TYPES = [
  'Furniture / Home items',
  'Electronics / Appliances',
  'Groceries / FMCG',
  'Building / Hardware material',
  'Machinery / Equipment',
  'Textile / Garments',
  'Documents / Parcels',
  'Other',
]

export const MAX_HELPERS = 2

// 'Furniture / Home items · 120 kg · 1 helper'
export const goodsLine = (ride) => [
  ride?.goodsType,
  ride?.goodsWeight ? `${ride.goodsWeight} kg` : '',
  ride?.helpers ? `${ride.helpers} helper${ride.helpers > 1 ? 's' : ''}` : '',
].filter(Boolean).join(' · ')
