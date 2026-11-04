import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminData } from '../api'
import { useFilters } from '../useFilters'
import { formatDate, formatDateTime, formatMoney, formatName } from '../format'
import { Button, Card, ErrorBanner, Input, PageHeader, Pagination, PersonCell, Select, Spinner, StatusBadge, Table, Td } from '../ui'

const DEFAULTS = { search: '', blocked: '' }

const Riders = () => {
  const navigate = useNavigate()
  const { filters, page, setFilter, setPage, reset } = useFilters(DEFAULTS)
  const [ search, setSearch ] = useState(filters.search)
  const { data, error, isLoading } = useAdminData('/users', { ...filters, page })

  useEffect(() => { setSearch(filters.search) }, [ filters.search ])

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div>
      <PageHeader title='Riders' subtitle='Customers who book rides' />
      <ErrorBanner>{error}</ErrorBanner>

      <form
        onSubmit={e => { e.preventDefault(); setFilter('search', search.trim()) }}
        className='grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-3 items-end mb-4'
      >
        <Input label='Search' type='search' placeholder='Name, email or phone' value={search} onChange={e => setSearch(e.target.value)} />
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
              columns={[ 'Rider', 'Account', 'Rides', 'Completed', 'Cancelled', 'Total spent', 'Last ride', 'Joined' ]}
              items={data.items}
              empty={hasFilters ? 'No riders match these filters.' : 'No riders registered yet.'}
              onRowClick={u => navigate(`/admin/riders/${u._id}`)}
              minWidth={900}
              renderCells={u => (
                <>
                  <Td><PersonCell name={formatName(u.fullname)} sub={u.email} /></Td>
                  <Td>{u.isBlocked ? <StatusBadge status='blocked' /> : <span className='text-[#c3c2b7]'>Allowed</span>}</Td>
                  <Td className='tabular-nums'>{u.stats.totalRides}</Td>
                  <Td className='tabular-nums'>{u.stats.completedRides}</Td>
                  <Td className='tabular-nums'>{u.stats.cancelledRides}</Td>
                  <Td className='font-medium tabular-nums'>{formatMoney(u.stats.totalFare)}</Td>
                  <Td className='whitespace-nowrap text-[#c3c2b7]'>{u.stats.lastRideAt ? formatDateTime(u.stats.lastRideAt) : '—'}</Td>
                  <Td className='whitespace-nowrap text-[#c3c2b7]'>{formatDate(u.createdAt)}</Td>
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

export default Riders
