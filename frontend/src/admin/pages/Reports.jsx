import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { downloadFile, errorMessage, useAdminData } from '../api'
import { BarList, ChartTableToggle, ColumnChart } from '../charts'
import { useFilters } from '../useFilters'
import { plural, dayKey, daysAgoKey, formatDayShort, formatMoney, formatName, formatNumber, VEHICLE_LABELS } from '../format'
import { Button, Card, ErrorBanner, Input, PageHeader, Spinner, StatTile, Table, Td } from '../ui'

const PRESETS = [
  { label: 'Today', from: () => dayKey() },
  { label: 'Last 7 days', from: () => daysAgoKey(6) },
  { label: 'Last 30 days', from: () => daysAgoKey(29) },
  { label: 'Last 90 days', from: () => daysAgoKey(89) },
  { label: 'This month', from: () => dayKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) },
]

const toCsv = (rows) => rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n')

const Reports = () => {
  const { filters, setFilters } = useFilters({ from: daysAgoKey(29), to: dayKey() })
  const { data, error, isLoading } = useAdminData('/reports', filters)
  const [ exportError, setExportError ] = useState('')

  const exportSummary = () => {
    const rows = [ [ 'Date', 'Rides requested', 'Rides completed', 'Revenue (INR)' ], ...data.daily.map(d => [ d.date, d.rides, d.completed, d.revenue ]) ]
    const blob = new Blob([ '﻿' + toCsv(rows) ], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `daily-report-${filters.from}-to-${filters.to}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const exportRides = async () => {
    setExportError('')
    try {
      await downloadFile('/rides/export', filters, `rides-${filters.from}-to-${filters.to}.csv`)
    } catch (err) {
      setExportError(errorMessage(err, 'Export failed. Please try again.'))
    }
  }

  const daily = data?.daily.map(d => ({ ...d, key: d.date, label: formatDayShort(d.date) })) || []
  const s = data?.summary

  return (
    <div>
      <PageHeader
        title='Reports'
        subtitle='Revenue, rides and top performers for any date range (up to one year)'
        actions={data && (
          <>
            <Button icon='ri-download-2-line' onClick={exportSummary}>Daily summary CSV</Button>
            <Button icon='ri-download-2-line' onClick={exportRides}>All rides CSV</Button>
          </>
        )}
      />

      <div className='flex flex-wrap items-end gap-3 mb-6'>
        <div className='flex flex-wrap gap-2' role='group' aria-label='Date range presets'>
          {PRESETS.map(p => {
            const active = filters.from === p.from() && filters.to === dayKey()
            return (
              <button
                key={p.label}
                onClick={() => setFilters({ from: p.from(), to: dayKey() })}
                aria-pressed={active}
                className={`px-3 h-9 rounded-xl text-sm font-medium border ${active ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-[#c3c2b7] hover:text-white'}`}
              >
                {active && <i className='ri-check-line mr-1'></i>}{p.label}
              </button>
            )
          })}
        </div>
        <div className='flex items-end gap-2'>
          <Input label='From' type='date' value={filters.from} max={filters.to} onChange={e => e.target.value && setFilters({ from: e.target.value })} />
          <Input label='To' type='date' value={filters.to} min={filters.from} max={dayKey()} onChange={e => e.target.value && setFilters({ to: e.target.value })} />
        </div>
      </div>

      <ErrorBanner>{error || exportError}</ErrorBanner>

      {!data ? (!error && <Spinner />) : (
        <div className={isLoading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4'>
            <StatTile label='Revenue' value={formatMoney(s.revenue)} hint={`Avg fare ${formatMoney(s.averageFare)}`} />
            <StatTile label='Completed rides' value={formatNumber(s.ridesCompleted)} hint={`${formatNumber(s.totalDistanceKm)} km driven`} />
            <StatTile label='Ride requests' value={formatNumber(s.ridesRequested)} hint={`${s.ridesCancelled} cancelled`} />
            <StatTile label='Completion rate' value={s.completionRate === null ? '—' : `${s.completionRate}%`} hint='Completed ÷ (completed + cancelled)' />
            <StatTile label='New riders' value={formatNumber(s.newUsers)} />
            <StatTile label='New captains' value={formatNumber(s.newCaptains)} />
            <StatTile label='Cancelled by riders' value={formatNumber(data.cancellations.user || 0)} />
            <StatTile label='Cancelled by admin' value={formatNumber(data.cancellations.admin || 0)} />
          </div>

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4'>
            <Card title='Revenue per day' subtitle={`${formatDayShort(data.range.from)} – ${formatDayShort(data.range.to)}`}>
              <ChartTableToggle
                chart={<ColumnChart data={daily.map(d => ({ ...d, value: d.revenue }))} formatValue={formatMoney} ariaLabel='Revenue per day' />}
                columns={[ 'Date', 'Revenue' ]}
                rows={daily.map(d => [ d.label, formatMoney(d.revenue) ])}
              />
            </Card>
            <Card title='Ride requests per day' subtitle='All statuses'>
              <ChartTableToggle
                chart={<ColumnChart data={daily.map(d => ({ ...d, value: d.rides }))} formatValue={v => `${v} request${v === 1 ? '' : 's'}`} ariaLabel='Ride requests per day' />}
                columns={[ 'Date', 'Requested', 'Completed' ]}
                rows={daily.map(d => [ d.label, d.rides, d.completed ])}
              />
            </Card>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4'>
            <Card title='Revenue by vehicle type'>
              {data.byVehicle.length
                ? <BarList data={data.byVehicle.map(v => ({ key: v.vehicleType, label: VEHICLE_LABELS[ v.vehicleType ] || v.vehicleType, value: v.revenue, hint: plural(v.rides, "ride") }))} formatValue={formatMoney} />
                : <p className='text-sm text-[#898781] py-6 text-center'>No completed rides in this range.</p>}
            </Card>
            <Card title='Rides by status' subtitle='Requested in this range'>
              <BarList data={Object.entries(data.byStatus).map(([ status, count ]) => ({ key: status, label: status.charAt(0).toUpperCase() + status.slice(1), value: count }))} formatValue={formatNumber} />
            </Card>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
            <Card title='Top captains' subtitle='By earnings in this range' padded={false}>
              <Table
                columns={[ '#', 'Captain', 'Rides', 'Earnings' ]}
                items={data.topCaptains}
                minWidth={360}
                empty='No completed rides in this range.'
                renderCells={c => (
                  <>
                    <Td className='text-[#898781] tabular-nums'>{data.topCaptains.indexOf(c) + 1}</Td>
                    <Td>{c.captain ? <Link to={`/admin/captains/${c.captain._id}`} className='hover:underline'>{formatName(c.captain.fullname)}</Link> : 'Deleted captain'}</Td>
                    <Td className='tabular-nums'>{c.rides}</Td>
                    <Td className='font-medium tabular-nums'>{formatMoney(c.revenue)}</Td>
                  </>
                )}
              />
            </Card>
            <Card title='Top riders' subtitle='By amount spent in this range' padded={false}>
              <Table
                columns={[ '#', 'Rider', 'Rides', 'Spent' ]}
                items={data.topRiders}
                minWidth={360}
                empty='No completed rides in this range.'
                renderCells={u => (
                  <>
                    <Td className='text-[#898781] tabular-nums'>{data.topRiders.indexOf(u) + 1}</Td>
                    <Td>{u.user ? <Link to={`/admin/riders/${u.user._id}`} className='hover:underline'>{formatName(u.user.fullname)}</Link> : 'Deleted rider'}</Td>
                    <Td className='tabular-nums'>{u.rides}</Td>
                    <Td className='font-medium tabular-nums'>{formatMoney(u.spent)}</Td>
                  </>
                )}
              />
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

export default Reports
