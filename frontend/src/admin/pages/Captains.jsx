import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminData } from '../api'
import { useFilters } from '../useFilters'
import { formatDate, formatMoney, formatName, VEHICLE_LABELS } from '../format'
import { Button, Card, ErrorBanner, Input, PageHeader, Pagination, PersonCell, Select, Spinner, StatusBadge, Table, Td } from '../ui'

const DEFAULTS = { search: '', status: '', vehicleType: '', blocked: '' }

const Captains = () => {
  const navigate = useNavigate()
  const { filters, page, setFilter, setPage, reset } = useFilters(DEFAULTS)
  const [ search, setSearch ] = useState(filters.search)
  const { data, error, isLoading } = useAdminData('/captains', { ...filters, page })

  useEffect(() => { setSearch(filters.search) }, [ filters.search ])

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div>
      <PageHeader title='Captains' subtitle='Drivers registered on the platform' />
      <ErrorBanner>{error}</ErrorBanner>

      <form
        onSubmit={e => { e.preventDefault(); setFilter('search', search.trim()) }}
        className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-end mb-4'
      >
        <Input label='Search' type='search' placeholder='Name, email, phone or number plate' value={search} onChange={e => setSearch(e.target.value)} />
        <Select label='Online status' value={filters.status} onChange={e => setFilter('status', e.target.value)} options={[
          { value: '', label: 'All' }, { value: 'active', label: 'Online' }, { value: 'inactive', label: 'Offline' },
        ]} />
        <Select label='Vehicle' value={filters.vehicleType} onChange={e => setFilter('vehicleType', e.target.value)} options={[
          { value: '', label: 'All vehicles' }, ...[ 'car', 'auto', 'motorcycle' ].map(v => ({ value: v, label: VEHICLE_LABELS[ v ] })),
        ]} />
        <Select label='Account' value={filters.blocked} onChange={e => setFilter('blocked', e.target.value)} options={[
          { value: '', label: 'All accounts' }, { value: 'false', label: 'Allowed' }, { value: 'true', label: 'Blocked' },
        ]} />
        <div className='flex gap-2'>
          <Button type='submit' variant='primary' icon='ri-search-line'>Search</Button>
          {hasFilters && <Button variant='ghost' onClick={() => { setSearch(''); reset() }}>Clear</Button>}
        </div>
      </form>

      <Card padded={false} className={isLoading && data ? 'opacity-70 transition-opacity' : ''}>
        {!data ? <Spinner /> : (
          <>
            <Table
              columns={[ 'Captain', 'Vehicle', 'Status', 'Completed rides', 'Earnings', 'Today', 'Joined' ]}
              items={data.items}
              empty={hasFilters ? 'No captains match these filters.' : 'No captains registered yet.'}
              onRowClick={c => navigate(`/admin/captains/${c._id}`)}
              minWidth={900}
              renderCells={c => (
                <>
                  <Td><PersonCell name={formatName(c.fullname)} sub={c.email} /></Td>
                  <Td>
                    <p>{VEHICLE_LABELS[ c.vehicle?.vehicleType ]} · {c.vehicle?.capacity} seats</p>
                    <p className='text-xs text-[#898781]'>{c.vehicle?.plate} · {c.vehicle?.color}</p>
                  </Td>
                  <Td><StatusBadge status={c.isBlocked ? 'blocked' : c.status} /></Td>
                  <Td className='tabular-nums'>{c.stats.completedRides}</Td>
                  <Td className='font-medium tabular-nums'>{formatMoney(c.stats.totalFare)}</Td>
                  <Td className='tabular-nums text-[#c3c2b7]'>{c.stats.todayRides} · {formatMoney(c.stats.todayFare)}</Td>
                  <Td className='whitespace-nowrap text-[#c3c2b7]'>{formatDate(c.createdAt)}</Td>
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

export default Captains
