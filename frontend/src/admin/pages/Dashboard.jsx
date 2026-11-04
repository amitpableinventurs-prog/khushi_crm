import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminData } from '../api'
import { BarList, ChartTableToggle, ColumnChart } from '../charts'
import { plural, formatDayShort, formatMoney, formatName, formatNumber, formatDateTime, VEHICLE_LABELS } from '../format'
import { Card, ErrorBanner, PageHeader, PersonCell, RouteCell, Spinner, StatTile, StatusBadge, Table, Td } from '../ui'

const PERIODS = [ 7, 30, 90 ]

const Dashboard = () => {
  const navigate = useNavigate()
  const [ days, setDays ] = useState(7)
  const { data, error, isLoading, reload } = useAdminData('/dashboard', { days }, { refreshMs: 30000 })

  if (!data) return <><PageHeader title='Dashboard' /><ErrorBanner>{error}</ErrorBanner>{!error && <Spinner />}</>

  const { period, today } = data
  const daily = period.daily.map(d => ({ ...d, key: d.date, label: formatDayShort(d.date) }))

  return (
    <div className={isLoading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
      <PageHeader
        title='Dashboard'
        subtitle='Updates every 30 seconds'
        actions={(
          <>
            <div className='flex bg-white/5 border border-white/10 rounded-xl p-0.5' role='group' aria-label='Period'>
              {PERIODS.map(p => (
                <button
                  key={p}
                  onClick={() => setDays(p)}
                  aria-pressed={days === p}
                  className={`px-3 h-8 rounded-lg text-sm font-medium ${days === p ? 'bg-white text-black' : 'text-[#c3c2b7] hover:text-white'}`}
                >
                  {p} days
                </button>
              ))}
            </div>
            <button onClick={reload} className='h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20' aria-label='Refresh'>
              <i className={`ri-refresh-line ${isLoading ? 'animate-spin inline-block' : ''}`}></i>
            </button>
          </>
        )}
      />
      <ErrorBanner>{error}</ErrorBanner>

      <div className='grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6'>
        <StatTile label="Today's revenue" value={formatMoney(today.revenue)} hint={`${today.ridesCompleted} completed today`} icon='ri-money-rupee-circle-line' />
        <StatTile label='Rides right now' value={formatNumber(data.rides.active)} hint={`${data.rides.byStatus.pending} waiting for a captain`} icon='ri-radar-line' />
        <StatTile label='Captains online' value={`${data.captains.online} / ${data.captains.total}`} hint={`${data.captains.blocked} blocked`} icon='ri-steering-2-line' />
        <StatTile label='Riders' value={formatNumber(data.users.total)} hint={`${period.summary.newUsers} new in ${days} days`} icon='ri-user-3-line' />
        <StatTile label={`Revenue, ${days} days`} value={formatMoney(period.summary.revenue)} hint={`Avg fare ${formatMoney(period.summary.averageFare)}`} icon='ri-line-chart-line' />
        <StatTile
          label='Completion rate'
          value={period.summary.completionRate === null ? '—' : `${period.summary.completionRate}%`}
          hint={`${period.summary.ridesCancelled} cancelled in ${days} days`}
          icon='ri-checkbox-circle-line'
        />
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4'>
        <Card title='Completed rides per day' subtitle={`Last ${days} days`}>
          <ChartTableToggle
            chart={<ColumnChart data={daily.map(d => ({ ...d, value: d.completed }))} formatValue={v => `${v} ride${v === 1 ? '' : 's'}`} ariaLabel='Completed rides per day' />}
            columns={[ 'Date', 'Requested', 'Completed' ]}
            rows={daily.map(d => [ d.label, d.rides, d.completed ])}
          />
        </Card>
        <Card title='Revenue per day' subtitle={`Completed rides, last ${days} days`}>
          <ChartTableToggle
            chart={<ColumnChart data={daily.map(d => ({ ...d, value: d.revenue }))} formatValue={formatMoney} ariaLabel='Revenue per day' />}
            columns={[ 'Date', 'Revenue' ]}
            rows={daily.map(d => [ d.label, formatMoney(d.revenue) ])}
          />
        </Card>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4'>
        <Card title='Revenue by vehicle type' subtitle={`Last ${days} days`}>
          {period.byVehicle.length
            ? <BarList data={period.byVehicle.map(v => ({ key: v.vehicleType, label: VEHICLE_LABELS[ v.vehicleType ] || v.vehicleType, value: v.revenue, hint: plural(v.rides, "ride") }))} formatValue={formatMoney} />
            : <p className='text-sm text-[#898781] py-6 text-center'>No completed rides in this period.</p>}
        </Card>
        <Card title='Rides by status' subtitle={`Requested in the last ${days} days`}>
          <BarList data={Object.entries(period.byStatus).map(([ status, count ]) => ({ key: status, label: status.charAt(0).toUpperCase() + status.slice(1), value: count }))} formatValue={formatNumber} />
        </Card>
        <Card title='Top captains' subtitle={`By earnings, last ${days} days`}>
          {period.topCaptains.length ? (
            <ol className='space-y-3 text-sm'>
              {period.topCaptains.slice(0, 5).map((c, i) => (
                <li key={c._id} className='flex items-center gap-3'>
                  <span className='w-5 text-[#898781] tabular-nums'>{i + 1}</span>
                  <div className='flex-1 min-w-0'>
                    <PersonCell name={formatName(c.captain?.fullname)} sub={c.captain?.vehicle?.plate} to={c.captain ? `/admin/captains/${c.captain._id}` : undefined} />
                  </div>
                  <div className='text-right'>
                    <p className='font-medium'>{formatMoney(c.revenue)}</p>
                    <p className='text-xs text-[#898781]'>{plural(c.rides, 'ride')}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className='text-sm text-[#898781] py-6 text-center'>No completed rides in this period.</p>}
        </Card>
      </div>

      <Card title='Latest rides' padded={false} actions={<button onClick={() => navigate('/admin/rides')} className='text-sm text-[#c3c2b7] hover:text-white'>View all →</button>}>
        <Table
          columns={[ 'Requested', 'Rider', 'Captain', 'Route', 'Fare', 'Status' ]}
          items={data.recentRides}
          empty='No rides yet. They will appear here as soon as riders book.'
          onRowClick={r => navigate(`/admin/rides/${r._id}`)}
          renderCells={r => (
            <>
              <Td className='whitespace-nowrap text-[#c3c2b7]'>{formatDateTime(r.createdAt)}</Td>
              <Td><PersonCell name={formatName(r.user?.fullname)} sub={r.user?.email} /></Td>
              <Td>{r.captain ? <PersonCell name={formatName(r.captain.fullname)} sub={r.captain.vehicle?.plate} /> : <span className='text-[#898781]'>—</span>}</Td>
              <Td><RouteCell pickup={r.pickup} destination={r.destination} /></Td>
              <Td className='font-medium whitespace-nowrap'>{formatMoney(r.fare)}</Td>
              <Td><StatusBadge status={r.status} /></Td>
            </>
          )}
        />
      </Card>
    </div>
  )
}

export default Dashboard
