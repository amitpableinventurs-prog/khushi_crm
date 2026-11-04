import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { downloadFile, errorMessage, useAdminData } from '../api'
import { useFilters } from '../useFilters'
import { dayKey, formatDateTime, formatDistance, formatMoney, formatName, RIDE_STATUSES, VEHICLE_LABELS } from '../format'
import { Button, Card, ErrorBanner, Input, PageHeader, Pagination, PaymentBadge, PersonCell, RouteCell, Select, Spinner, StatusBadge, Table, Td } from '../ui'

const DEFAULTS = { search: '', status: '', vehicleType: '', payment: '', from: '', to: '' }

// one 'Payment' dropdown -> API paymentMethod / paymentStatus filters
const PAYMENT_FILTERS = {
  online: { paymentMethod: 'online', paymentStatus: 'paid' },
  cash: { paymentMethod: 'cash', paymentStatus: 'paid' },
  pending: { paymentStatus: 'pending' },
  refunded: { paymentStatus: 'refunded' },
}

const Rides = () => {
  const navigate = useNavigate()
  const { filters, page, setFilter, setFilters, setPage, reset } = useFilters(DEFAULTS)
  const [ search, setSearch ] = useState(filters.search)
  const [ exportError, setExportError ] = useState('')
  const [ isExporting, setIsExporting ] = useState(false)
  const { payment, ...rideFilters } = filters
  const apiFilters = { ...rideFilters, ...PAYMENT_FILTERS[ payment ] }
  const { data, error, isLoading } = useAdminData('/rides', { ...apiFilters, page })

  useEffect(() => { setSearch(filters.search) }, [ filters.search ])

  const exportCsv = async () => {
    setExportError('')
    setIsExporting(true)
    try {
      await downloadFile('/rides/export', apiFilters, `rides-${dayKey()}.csv`)
    } catch (err) {
      setExportError(errorMessage(err, 'Export failed. Please try again.'))
    } finally {
      setIsExporting(false)
    }
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div>
      <PageHeader
        title='Rides'
        subtitle='Every ride request, newest first'
        actions={<Button icon='ri-download-2-line' onClick={exportCsv} disabled={isExporting}>{isExporting ? 'Exporting…' : 'Export CSV'}</Button>}
      />
      <ErrorBanner>{error || exportError}</ErrorBanner>

      <form
        onSubmit={e => { e.preventDefault(); setFilter('search', search.trim()) }}
        className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 items-end mb-4'
      >
        <Input label='Search' placeholder='Place, rider, captain or plate' value={search} onChange={e => setSearch(e.target.value)} type='search' />
        <Select
          label='Status'
          value={filters.status}
          onChange={e => setFilter('status', e.target.value)}
          options={[ { value: '', label: 'All statuses' }, ...RIDE_STATUSES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })) ]}
        />
        <Select
          label='Vehicle'
          value={filters.vehicleType}
          onChange={e => setFilter('vehicleType', e.target.value)}
          options={[ { value: '', label: 'All vehicles' }, ...[ 'car', 'auto', 'moto' ].map(v => ({ value: v, label: VEHICLE_LABELS[ v ] })) ]}
        />
        <Select
          label='Payment'
          value={filters.payment}
          onChange={e => setFilter('payment', e.target.value)}
          options={[ { value: '', label: 'Any payment' }, { value: 'online', label: 'Paid online' }, { value: 'cash', label: 'Paid cash' }, { value: 'pending', label: 'Unpaid' }, { value: 'refunded', label: 'Refunded' } ]}
        />
        <Input label='From' type='date' value={filters.from} max={filters.to || undefined} onChange={e => setFilter('from', e.target.value)} />
        <Input label='To' type='date' value={filters.to} min={filters.from || undefined} onChange={e => setFilter('to', e.target.value)} />
        <div className='flex gap-2'>
          <Button type='submit' variant='primary' icon='ri-search-line'>Search</Button>
          {hasFilters && <Button variant='ghost' onClick={() => { setSearch(''); reset() }}>Clear</Button>}
        </div>
      </form>

      <div className='flex flex-wrap gap-2 mb-4' role='group' aria-label='Quick date range'>
        {[ [ 'Today', 0 ], [ 'Last 7 days', 6 ], [ 'Last 30 days', 29 ] ].map(([ label, back ]) => (
          <button
            key={label}
            onClick={() => setFilters({ from: dayKey(new Date(Date.now() - back * 86400000)), to: dayKey() })}
            className='px-3 h-8 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-[#c3c2b7] hover:text-white'
          >
            {label}
          </button>
        ))}
      </div>

      <Card padded={false} className={isLoading && data ? 'opacity-70 transition-opacity' : ''}>
        {!data ? <Spinner /> : (
          <>
            <Table
              columns={[ 'Requested', 'Rider', 'Captain', 'Route', 'Vehicle', 'Distance', 'Fare', 'Payment', 'Status' ]}
              items={data.items}
              empty={hasFilters ? 'No rides match these filters.' : 'No rides yet.'}
              onRowClick={r => navigate(`/admin/rides/${r._id}`)}
              minWidth={1060}
              renderCells={r => (
                <>
                  <Td className='whitespace-nowrap text-[#c3c2b7]'>{formatDateTime(r.createdAt)}</Td>
                  <Td>{r.user ? <PersonCell name={formatName(r.user.fullname)} sub={r.user.email} to={`/admin/riders/${r.user._id}`} /> : <span className='text-[#898781]'>Deleted rider</span>}</Td>
                  <Td>{r.captain ? <PersonCell name={formatName(r.captain.fullname)} sub={r.captain.vehicle?.plate} to={`/admin/captains/${r.captain._id}`} /> : <span className='text-[#898781]'>—</span>}</Td>
                  <Td><RouteCell pickup={r.pickup} destination={r.destination} /></Td>
                  <Td>{VEHICLE_LABELS[ r.vehicleType ] || '—'}</Td>
                  <Td className='whitespace-nowrap tabular-nums'>{formatDistance(r.distance)}</Td>
                  <Td className='font-medium whitespace-nowrap tabular-nums'>{formatMoney(r.fare)}</Td>
                  <Td><PaymentBadge ride={r} /></Td>
                  <Td><StatusBadge status={r.status} /></Td>
                </>
              )}
            />
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  )
}

export default Rides
