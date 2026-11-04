import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminData } from '../api'
import { formatMoney, formatName, timeAgo, VEHICLE_LABELS } from '../format'
import { Card, ErrorBanner, PageHeader, PersonCell, RouteCell, Spinner, StatTile, StatusBadge, Table, Td } from '../ui'

const Live = () => {
  const navigate = useNavigate()
  const { data, error, isLoading } = useAdminData('/live', null, { refreshMs: 10000 })

  if (!data) return <><PageHeader title='Live monitor' /><ErrorBanner>{error}</ErrorBanner>{!error && <Spinner />}</>

  const count = (status) => data.activeRides.filter(r => r.status === status).length
  const freeCaptains = data.onlineCaptains.filter(c => !c.isBusy).length

  return (
    <div>
      <PageHeader
        title='Live monitor'
        subtitle={(
          <span className='inline-flex items-center gap-2'>
            <span className={`h-2 w-2 rounded-full ${isLoading ? 'bg-yellow-400' : 'bg-emerald-400'}`}></span>
            Refreshes every 10 seconds · last update {new Date(data.generatedAt).toLocaleTimeString('en-IN')}
          </span>
        )}
      />
      <ErrorBanner>{error}</ErrorBanner>

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6'>
        <StatTile label='Waiting for a captain' value={count('pending')} icon='ri-time-line' />
        <StatTile label='Captain on the way' value={count('accepted')} icon='ri-user-follow-line' />
        <StatTile label='Ride in progress' value={count('ongoing')} icon='ri-steering-2-line' />
        <StatTile label='Free captains online' value={`${freeCaptains} / ${data.onlineCaptains.length}`} icon='ri-wifi-line' />
      </div>

      <Card title='Active rides' subtitle='Click a ride to see details or cancel it' padded={false} className='mb-4'>
        <Table
          columns={[ 'Requested', 'Status', 'Rider', 'Captain', 'Route', 'Vehicle', 'Fare' ]}
          items={data.activeRides}
          empty='No active rides right now.'
          onRowClick={r => navigate(`/admin/rides/${r._id}`)}
          renderCells={r => (
            <>
              <Td className='whitespace-nowrap text-[#c3c2b7]'>{timeAgo(r.createdAt)}</Td>
              <Td><StatusBadge status={r.status} /></Td>
              <Td><PersonCell name={formatName(r.user?.fullname)} sub={r.user?.email} /></Td>
              <Td>{r.captain ? <PersonCell name={formatName(r.captain.fullname)} sub={r.captain.vehicle?.plate} /> : <span className='text-[#898781]'>Searching…</span>}</Td>
              <Td><RouteCell pickup={r.pickup} destination={r.destination} /></Td>
              <Td>{VEHICLE_LABELS[ r.vehicleType ] || '—'}</Td>
              <Td className='font-medium whitespace-nowrap'>{formatMoney(r.fare)}</Td>
            </>
          )}
        />
      </Card>

      <Card title='Captains online' padded={false}>
        <Table
          columns={[ 'Captain', 'Vehicle', 'State', 'Last location', 'Last seen' ]}
          items={data.onlineCaptains}
          empty='No captains are online.'
          onRowClick={c => navigate(`/admin/captains/${c._id}`)}
          renderCells={c => (
            <>
              <Td><PersonCell name={formatName(c.fullname)} sub={c.email} /></Td>
              <Td className='capitalize'>{VEHICLE_LABELS[ c.vehicle?.vehicleType ]} · {c.vehicle?.plate}</Td>
              <Td><StatusBadge status={c.isBusy ? 'busy' : 'active'} /></Td>
              <Td className='tabular-nums text-[#c3c2b7]'>
                {c.location?.ltd
                  ? <a href={`https://www.google.com/maps?q=${c.location.ltd},${c.location.lng}`} target='_blank' rel='noreferrer' onClick={e => e.stopPropagation()} className='hover:underline'>
                      {c.location.ltd.toFixed(4)}, {c.location.lng.toFixed(4)} <i className='ri-external-link-line'></i>
                    </a>
                  : 'Not shared'}
              </Td>
              <Td className='text-[#c3c2b7] whitespace-nowrap'>{timeAgo(c.updatedAt)}</Td>
            </>
          )}
        />
      </Card>
    </div>
  )
}

export default Live
