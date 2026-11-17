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

// Orders and driver vehicles share one list of goods vehicle types
export { VEHICLE_LABELS, VEHICLES, formatCapacity, goodsLine } from '../vehicles'

export const RIDE_STATUSES = [ 'pending', 'accepted', 'ongoing', 'completed', 'cancelled' ]

// local 'YYYY-MM-DD'
export const dayKey = (date = new Date()) => date.toLocaleDateString('en-CA')

export const daysAgoKey = (days) => dayKey(new Date(Date.now() - days * 24 * 60 * 60 * 1000))

export const WEEKDAYS = [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ]

// Minutes since midnight and weekday in India time (commission slots and offers use India time)
export const indiaClock = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(date)
  const get = (type) => parts.find(p => p.type === type).value
  return { minutes: Number(get('hour')) * 60 + Number(get('minute')), day: WEEKDAYS.indexOf(get('weekday')) }
}

const toMinutes = (hhmm) => { const [ h, m ] = hhmm.split(':').map(Number); return h * 60 + m }

// Same rule as the backend: an end before the start runs past midnight and belongs to the start day
export const inWindow = ({ start, end, days }, clock) => {
  let day = clock.day
  if (start && end && start !== end) {
    const s = toMinutes(start), e = toMinutes(end), m = clock.minutes
    if (s < e) {
      if (m < s || m >= e) return false
    } else {
      if (m < s && m >= e) return false
      if (m < e) day = (day + 6) % 7
    }
  }
  return !days?.length || days.includes(day)
}

export const describeDays = (days) => days?.length ? [ ...days ].sort().map(d => WEEKDAYS[ d ]).join(', ') : 'Every day'

// Date from the API -> 'YYYY-MM-DD' in India time, for date inputs
export const indiaDayKey = (value) => value ? new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : ''
