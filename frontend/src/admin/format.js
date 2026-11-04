export const formatMoney = (value) => `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`

export const formatNumber = (value) => (Number(value) || 0).toLocaleString('en-IN')

// plural(1, 'ride') -> '1 ride', plural(3, 'ride') -> '3 rides'
export const plural = (count, word) => `${formatNumber(count)} ${word}${Number(count) === 1 ? '' : 's'}`

export const formatName = (fullname) => {
  if (!fullname) return '—'
  if (typeof fullname === 'string') return fullname
  return [ fullname.firstname, fullname.lastname ].filter(Boolean).join(' ') || '—'
}

export const formatDateTime = (value) => value
  ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  : '—'

export const formatDate = (value) => value
  ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' })
  : '—'

// 'YYYY-MM-DD' -> '3 Nov'
export const formatDayShort = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export const formatDistance = (meters) => meters ? `${(meters / 1000).toFixed(1)} km` : '—'

export const formatDuration = (seconds) => seconds ? `${Math.round(seconds / 60)} min` : '—'

export const timeAgo = (value) => {
  if (!value) return '—'
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return formatDate(value)
}

// Rides use auto/car/moto, captain vehicles use auto/car/motorcycle
export const VEHICLE_LABELS = {
  car: 'Car',
  auto: 'Auto',
  moto: 'Moto',
  motorcycle: 'Motorcycle',
  unknown: 'Not recorded',
}

export const RIDE_STATUSES = [ 'pending', 'accepted', 'ongoing', 'completed', 'cancelled' ]

// local 'YYYY-MM-DD'
export const dayKey = (date = new Date()) => date.toLocaleDateString('en-CA')

export const daysAgoKey = (days) => dayKey(new Date(Date.now() - days * 24 * 60 * 60 * 1000))
