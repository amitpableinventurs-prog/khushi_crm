import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'

// Shared building blocks for the admin panel (dark theme)

export const Card = ({ title, subtitle, actions, children, className = '', padded = true }) => (
  <section className={`bg-[#1a1a19] border border-white/10 rounded-2xl ${padded ? 'p-4 sm:p-5' : ''} ${className}`}>
    {(title || actions) && (
      <div className={`flex flex-wrap items-start justify-between gap-3 ${padded ? 'mb-4' : 'p-4 sm:p-5 pb-0 mb-4'}`}>
        <div className='min-w-0'>
          {title && <h2 className='text-base font-semibold text-[#f0efec]'>{title}</h2>}
          {subtitle && <p className='text-xs text-[#898781] mt-0.5'>{subtitle}</p>}
        </div>
        {actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
      </div>
    )}
    {children}
  </section>
)

export const PageHeader = ({ title, subtitle, actions, back }) => (
  <div className='flex flex-wrap items-end justify-between gap-3 mb-6'>
    <div className='min-w-0'>
      {back && (
        <Link to={back.to} className='inline-flex items-center gap-1 text-sm text-[#c3c2b7] hover:text-white mb-2'>
          <i className='ri-arrow-left-line'></i> {back.label}
        </Link>
      )}
      <h1 className='text-2xl font-bold tracking-tight text-[#f0efec]'>{title}</h1>
      {subtitle && <p className='text-sm text-[#c3c2b7] mt-1'>{subtitle}</p>}
    </div>
    {actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
  </div>
)

export const StatTile = ({ label, value, hint, icon }) => (
  <div className='bg-[#1a1a19] border border-white/10 rounded-2xl p-4 min-w-0'>
    <div className='flex items-center justify-between gap-2'>
      <p className='text-sm text-[#c3c2b7] truncate'>{label}</p>
      {icon && <i className={`${icon} text-lg text-[#898781]`}></i>}
    </div>
    <p className='text-2xl font-semibold text-[#f0efec] mt-1 truncate'>{value}</p>
    {hint && <p className='text-xs text-[#898781] mt-1 truncate'>{hint}</p>}
  </div>
)

const BADGE_STYLES = {
  pending: { cls: 'bg-yellow-500/15 text-yellow-200', icon: 'ri-time-line' },
  accepted: { cls: 'bg-sky-500/15 text-sky-200', icon: 'ri-user-follow-line' },
  ongoing: { cls: 'bg-indigo-500/15 text-indigo-200', icon: 'ri-steering-2-line' },
  completed: { cls: 'bg-emerald-500/15 text-emerald-200', icon: 'ri-checkbox-circle-line' },
  cancelled: { cls: 'bg-red-500/15 text-red-200', icon: 'ri-close-circle-line' },
  active: { cls: 'bg-emerald-500/15 text-emerald-200', icon: 'ri-wifi-line', label: 'Online' },
  inactive: { cls: 'bg-white/10 text-[#c3c2b7]', icon: 'ri-wifi-off-line', label: 'Offline' },
  blocked: { cls: 'bg-red-500/15 text-red-200', icon: 'ri-forbid-line', label: 'Blocked' },
  busy: { cls: 'bg-indigo-500/15 text-indigo-200', icon: 'ri-steering-2-line', label: 'On a ride' },
}

// Status chips always pair the color with an icon and a word
export const StatusBadge = ({ status }) => {
  const style = BADGE_STYLES[ status ] || { cls: 'bg-white/10 text-[#c3c2b7]', icon: 'ri-question-line' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium capitalize whitespace-nowrap ${style.cls}`}>
      <i className={style.icon}></i> {style.label || status}
    </span>
  )
}

const BUTTON_STYLES = {
  primary: 'bg-white text-black hover:bg-gray-200',
  secondary: 'bg-white/10 text-white hover:bg-white/20',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  ghost: 'text-[#c3c2b7] hover:text-white hover:bg-white/10',
}

export const Button = ({ variant = 'secondary', icon, children, className = '', ...props }) => (
  <button
    type='button'
    className={`inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_STYLES[ variant ]} ${className}`}
    {...props}
  >
    {icon && <i className={icon}></i>}
    {children}
  </button>
)

const fieldClass = 'h-9 bg-white/5 border border-white/10 rounded-xl px-3 text-sm text-white placeholder-[#898781] focus:outline-none focus:border-emerald-500'

export const Input = ({ label, className = '', ...props }) => (
  <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
    {label && <span className='text-xs font-medium text-[#c3c2b7]'>{label}</span>}
    <input className={`${fieldClass} w-full`} {...props} />
  </label>
)

export const Select = ({ label, options, className = '', ...props }) => (
  <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
    {label && <span className='text-xs font-medium text-[#c3c2b7]'>{label}</span>}
    <select className={`${fieldClass} w-full`} {...props}>
      {options.map(o => <option key={o.value} value={o.value} className='bg-[#1a1a19]'>{o.label}</option>)}
    </select>
  </label>
)

export const ErrorBanner = ({ children }) => children ? (
  <p role='alert' className='flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-200 text-sm rounded-xl px-4 py-3 mb-4'>
    <i className='ri-error-warning-line mt-0.5'></i> <span>{children}</span>
  </p>
) : null

export const SuccessBanner = ({ children }) => children ? (
  <p role='status' className='flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm rounded-xl px-4 py-3 mb-4'>
    <i className='ri-checkbox-circle-line mt-0.5'></i> <span>{children}</span>
  </p>
) : null

export const Spinner = () => (
  <div className='py-16 flex justify-center'>
    <div className='w-9 h-9 border-4 border-white/15 border-t-white rounded-full animate-spin'></div>
  </div>
)

export const EmptyState = ({ icon = 'ri-inbox-line', children }) => (
  <div className='py-10 text-center text-sm text-[#898781]'>
    <i className={`${icon} text-3xl block mb-2`}></i>
    {children}
  </div>
)

export const Td = ({ children, className = '' }) => <td className={`px-4 py-3 align-top ${className}`}>{children}</td>

// `renderCells(item)` returns <Td> cells; `onRowClick` makes rows act as links
export const Table = ({ columns, items, renderCells, empty, onRowClick, minWidth = 720 }) => {
  if (!items.length) return <EmptyState>{empty}</EmptyState>

  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-sm text-left text-[#f0efec]' style={{ minWidth }}>
        <thead className='text-xs text-[#898781]'>
          <tr>
            {columns.map(c => <th key={c} className='px-4 py-2.5 font-medium border-b border-white/10 whitespace-nowrap'>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr
              key={item._id}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={`border-b border-white/5 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-white/5' : ''}`}
            >
              {renderCells(item)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const Pagination = ({ page, pages, total, onChange }) => (
  <div className='flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-white/10 text-sm text-[#c3c2b7]'>
    <span>{total.toLocaleString('en-IN')} result{total === 1 ? '' : 's'}</span>
    <div className='flex items-center gap-2'>
      <Button variant='ghost' icon='ri-arrow-left-s-line' disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label='Previous page' />
      <span className='tabular-nums'>Page {page} of {pages}</span>
      <Button variant='ghost' icon='ri-arrow-right-s-line' disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label='Next page' />
    </div>
  </div>
)

export const Modal = ({ title, onClose, children, footer }) => {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ onClose ])

  return (
    <div className='fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4' onClick={onClose}>
      <div
        role='dialog'
        aria-modal='true'
        aria-label={title}
        className='w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[#1a1a19] border border-white/10 rounded-t-2xl sm:rounded-2xl'
        onClick={e => e.stopPropagation()}
      >
        <div className='flex items-center justify-between px-5 py-4 border-b border-white/10'>
          <h2 className='font-semibold text-[#f0efec]'>{title}</h2>
          <Button variant='ghost' icon='ri-close-line' onClick={onClose} aria-label='Close' />
        </div>
        <div className='px-5 py-4'>{children}</div>
        {footer && <div className='flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-white/10'>{footer}</div>}
      </div>
    </div>
  )
}

// A label/value list for detail pages
export const DetailList = ({ items }) => (
  <dl className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm'>
    {items.filter(Boolean).map(([ label, value ]) => (
      <div key={label} className='min-w-0'>
        <dt className='text-xs text-[#898781]'>{label}</dt>
        <dd className='text-[#f0efec] break-words'>{value ?? '—'}</dd>
      </div>
    ))}
  </dl>
)

export const PersonCell = ({ name, sub, to }) => (
  <div className='min-w-0'>
    {to ? <Link to={to} onClick={e => e.stopPropagation()} className='font-medium hover:underline'>{name}</Link> : <p className='font-medium'>{name}</p>}
    {sub && <p className='text-xs text-[#898781] truncate'>{sub}</p>}
  </div>
)

export const RouteCell = ({ pickup, destination }) => (
  <div className='max-w-[260px]'>
    <p className='truncate' title={pickup}><i className='ri-map-pin-2-line text-[#898781]'></i> {pickup}</p>
    <p className='truncate text-[#c3c2b7]' title={destination}><i className='ri-flag-2-line text-[#898781]'></i> {destination}</p>
  </div>
)

// Payment state of a ride, for tables and detail pages
export const PaymentBadge = ({ ride }) => {
  const state = ride.paymentStatus === 'refunded'
    ? { cls: 'bg-red-500/15 text-red-200', icon: 'ri-refund-2-line', label: 'Refunded' }
    : ride.paymentStatus === 'paid'
      ? { cls: 'bg-emerald-500/15 text-emerald-200', icon: ride.paymentMethod === 'online' ? 'ri-bank-card-line' : 'ri-money-rupee-circle-line', label: ride.paymentMethod === 'online' ? 'Paid online' : 'Paid cash' }
      : ride.status === 'cancelled'
        ? { cls: 'bg-white/10 text-[#c3c2b7]', icon: 'ri-subtract-line', label: 'No payment' }
        : { cls: 'bg-yellow-500/15 text-yellow-200', icon: 'ri-time-line', label: 'Unpaid' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium whitespace-nowrap ${state.cls}`}>
      <i className={state.icon}></i> {state.label}
    </span>
  )
}
