import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import adminApi, { errorMessage, useAdminData } from '../api'
import AccountActions from '../AccountActions'
import { plural, formatDate, formatDateTime, formatMoney, formatName, timeAgo, VEHICLE_LABELS } from '../format'
import { Button, Card, DetailList, ErrorBanner, Input, Modal, PageHeader, RouteCell, Select, Spinner, StatTile, StatusBadge, SuccessBanner, Table, Td } from '../ui'

const EditCaptain = ({ captain, onClose, onSaved }) => {
  const [ form, setForm ] = useState({
    firstname: captain.fullname?.firstname || '',
    lastname: captain.fullname?.lastname || '',
    email: captain.email,
    phone: captain.phone || '',
    status: captain.status,
    color: captain.vehicle?.color || '',
    plate: captain.vehicle?.plate || '',
    capacity: captain.vehicle?.capacity || 1,
    vehicleType: captain.vehicle?.vehicleType || 'car',
  })
  const [ error, setError ] = useState('')
  const [ isSaving, setIsSaving ] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [ key ]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      const response = await adminApi.patch(`/captains/${captain._id}`, {
        fullname: { firstname: form.firstname, lastname: form.lastname },
        email: form.email,
        phone: form.phone,
        status: form.status,
        vehicle: { color: form.color, plate: form.plate, capacity: Number(form.capacity), vehicleType: form.vehicleType },
      })
      onSaved(response.data)
    } catch (err) {
      setError(errorMessage(err))
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title='Edit captain'
      onClose={onClose}
      footer={(
        <>
          <Button variant='ghost' onClick={onClose}>Cancel</Button>
          <Button variant='primary' type='submit' form='edit-captain' disabled={isSaving}>{isSaving ? 'Saving…' : 'Save changes'}</Button>
        </>
      )}
    >
      <ErrorBanner>{error}</ErrorBanner>
      <form id='edit-captain' onSubmit={save} className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <Input label='First name' required minLength={3} value={form.firstname} onChange={set('firstname')} />
        <Input label='Last name' value={form.lastname} onChange={set('lastname')} />
        <Input label='Email' type='email' required value={form.email} onChange={set('email')} className='sm:col-span-2' />
        <Input label='Phone (for SMS / WhatsApp)' type='tel' value={form.phone} onChange={set('phone')} placeholder='+91 98765 43210' className='sm:col-span-2' />
        <Select label='Vehicle type' value={form.vehicleType} onChange={set('vehicleType')} options={[ 'car', 'auto', 'motorcycle' ].map(v => ({ value: v, label: VEHICLE_LABELS[ v ] }))} />
        <Input label='Seats' type='number' min={1} max={20} required value={form.capacity} onChange={set('capacity')} />
        <Input label='Number plate' required minLength={3} value={form.plate} onChange={set('plate')} />
        <Input label='Color' required minLength={3} value={form.color} onChange={set('color')} />
        <Select label='Online status' value={form.status} onChange={set('status')} className='sm:col-span-2' options={[
          { value: 'active', label: 'Online' }, { value: 'inactive', label: 'Offline (stops ride requests until they log in again)' },
        ]} />
      </form>
    </Modal>
  )
}

const CaptainDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, setData, error } = useAdminData(`/captains/${id}`)
  const [ editing, setEditing ] = useState(false)
  const [ notice, setNotice ] = useState('')

  if (!data) return <><PageHeader title='Captain' back={{ to: '/admin/captains', label: 'Captains' }} /><ErrorBanner>{error}</ErrorBanner>{!error && <Spinner />}</>

  const { stats } = data
  const merge = (updated, message) => { setData({ ...data, ...updated }); setNotice(message) }

  return (
    <div>
      <PageHeader
        title={formatName(data.fullname)}
        subtitle={data.email}
        back={{ to: '/admin/captains', label: 'Captains' }}
        actions={(
          <>
            <StatusBadge status={data.isBlocked ? 'blocked' : data.status} />
            <Button icon='ri-edit-line' onClick={() => setEditing(true)}>Edit</Button>
            <AccountActions kind='captains' noun='Captain' person={data} onChange={merge} listPath='/admin/captains' />
          </>
        )}
      />
      <SuccessBanner>{notice}</SuccessBanner>

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4'>
        <StatTile label='Total earnings' value={formatMoney(stats.totalFare)} hint={`${plural(stats.completedRides, "completed ride")}`} />
        <StatTile label="Today's earnings" value={formatMoney(stats.todayFare)} hint={`${plural(stats.todayRides, "ride")} today`} />
        <StatTile label='Average fare' value={formatMoney(stats.completedRides ? stats.totalFare / stats.completedRides : 0)} />
        <StatTile label='Cancelled rides' value={stats.cancelledRides} hint={`of ${stats.totalRides} assigned`} />
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4'>
        <Card title='Profile'>
          <DetailList items={[
            [ 'Name', formatName(data.fullname) ],
            [ 'Email', data.email ],
            [ 'Phone', data.phone || 'Not added' ],
            [ 'Joined', formatDate(data.createdAt) ],
            [ 'Last activity', timeAgo(data.updatedAt) ],
            [ 'Last ride', stats.lastRideAt ? formatDateTime(stats.lastRideAt) : 'No rides yet' ],
            [ 'Account', data.isBlocked ? 'Blocked' : 'Allowed' ],
          ]} />
        </Card>
        <Card title='Vehicle'>
          <DetailList items={[
            [ 'Type', VEHICLE_LABELS[ data.vehicle?.vehicleType ] ],
            [ 'Number plate', data.vehicle?.plate ],
            [ 'Color', data.vehicle?.color ],
            [ 'Seats', data.vehicle?.capacity ],
            [ 'Last location', data.location?.ltd
              ? <a className='hover:underline' href={`https://www.google.com/maps?q=${data.location.ltd},${data.location.lng}`} target='_blank' rel='noreferrer'>{data.location.ltd.toFixed(4)}, {data.location.lng.toFixed(4)} <i className='ri-external-link-line'></i></a>
              : 'Not shared' ],
          ]} />
        </Card>
      </div>

      <Card title='Recent rides' subtitle='Last 20 rides assigned to this captain' padded={false}
        actions={<button onClick={() => navigate(`/admin/rides?search=${encodeURIComponent(data.email)}`)} className='text-sm text-[#c3c2b7] hover:text-white'>All rides →</button>}>
        <Table
          columns={[ 'Requested', 'Rider', 'Route', 'Fare', 'Status' ]}
          items={data.recentRides}
          empty='This captain has not taken any rides yet.'
          onRowClick={r => navigate(`/admin/rides/${r._id}`)}
          renderCells={r => (
            <>
              <Td className='whitespace-nowrap text-[#c3c2b7]'>{formatDateTime(r.createdAt)}</Td>
              <Td>{formatName(r.user?.fullname)}</Td>
              <Td><RouteCell pickup={r.pickup} destination={r.destination} /></Td>
              <Td className='font-medium tabular-nums'>{formatMoney(r.fare)}</Td>
              <Td><StatusBadge status={r.status} /></Td>
            </>
          )}
        />
      </Card>

      {editing && <EditCaptain captain={data} onClose={() => setEditing(false)} onSaved={(c) => { setEditing(false); merge(c, 'Captain details saved.') }} />}
    </div>
  )
}

export default CaptainDetail
