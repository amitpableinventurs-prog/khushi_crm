import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import adminApi, { errorMessage, useAdminData } from '../api'
import AccountActions from '../AccountActions'
import { plural, formatDate, formatDateTime, formatMoney, formatName } from '../format'
import { Button, Card, DetailList, ErrorBanner, Input, Modal, PageHeader, PersonCell, RouteCell, Spinner, StatTile, StatusBadge, SuccessBanner, Table, Td } from '../ui'

const EditRider = ({ rider, onClose, onSaved }) => {
  const [ form, setForm ] = useState({
    firstname: rider.fullname?.firstname || '',
    lastname: rider.fullname?.lastname || '',
    email: rider.email,
    phone: rider.phone || '',
  })
  const [ error, setError ] = useState('')
  const [ isSaving, setIsSaving ] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [ key ]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      const response = await adminApi.patch(`/users/${rider._id}`, {
        fullname: { firstname: form.firstname, lastname: form.lastname },
        email: form.email,
        phone: form.phone,
      })
      onSaved(response.data)
    } catch (err) {
      setError(errorMessage(err))
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title='Edit rider'
      onClose={onClose}
      footer={(
        <>
          <Button variant='ghost' onClick={onClose}>Cancel</Button>
          <Button variant='primary' type='submit' form='edit-rider' disabled={isSaving}>{isSaving ? 'Saving…' : 'Save changes'}</Button>
        </>
      )}
    >
      <ErrorBanner>{error}</ErrorBanner>
      <form id='edit-rider' onSubmit={save} className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <Input label='First name' required minLength={3} value={form.firstname} onChange={set('firstname')} />
        <Input label='Last name' value={form.lastname} onChange={set('lastname')} />
        <Input label='Email' type='email' required value={form.email} onChange={set('email')} className='sm:col-span-2' />
        <Input label='Phone (for SMS / WhatsApp)' type='tel' value={form.phone} onChange={set('phone')} placeholder='+91 98765 43210' className='sm:col-span-2' />
      </form>
    </Modal>
  )
}

const RiderDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, setData, error } = useAdminData(`/users/${id}`)
  const [ editing, setEditing ] = useState(false)
  const [ notice, setNotice ] = useState('')

  if (!data) return <><PageHeader title='Rider' back={{ to: '/admin/riders', label: 'Riders' }} /><ErrorBanner>{error}</ErrorBanner>{!error && <Spinner />}</>

  const { stats } = data
  const merge = (updated, message) => { setData({ ...data, ...updated }); setNotice(message) }

  return (
    <div>
      <PageHeader
        title={formatName(data.fullname)}
        subtitle={data.email}
        back={{ to: '/admin/riders', label: 'Riders' }}
        actions={(
          <>
            {data.isBlocked && <StatusBadge status='blocked' />}
            <Button icon='ri-edit-line' onClick={() => setEditing(true)}>Edit</Button>
            <AccountActions kind='users' noun='Rider' person={data} onChange={merge} listPath='/admin/riders' />
          </>
        )}
      />
      <SuccessBanner>{notice}</SuccessBanner>

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4'>
        <StatTile label='Total spent' value={formatMoney(stats.totalFare)} hint={`${plural(stats.completedRides, "completed ride")}`} />
        <StatTile label='Rides booked' value={stats.totalRides} />
        <StatTile label='Cancelled' value={stats.cancelledRides} />
        <StatTile label='Average fare' value={formatMoney(stats.completedRides ? stats.totalFare / stats.completedRides : 0)} />
      </div>

      <Card title='Profile' className='mb-4'>
        <DetailList items={[
          [ 'Name', formatName(data.fullname) ],
          [ 'Email', data.email ],
          [ 'Phone', data.phone || 'Not added' ],
          [ 'Joined', formatDate(data.createdAt) ],
          [ 'Last ride', stats.lastRideAt ? formatDateTime(stats.lastRideAt) : 'No rides yet' ],
          [ 'Account', data.isBlocked ? 'Blocked' : 'Allowed' ],
        ]} />
      </Card>

      <Card title='Recent rides' subtitle='Last 20 rides booked by this rider' padded={false}
        actions={<button onClick={() => navigate(`/admin/rides?search=${encodeURIComponent(data.email)}`)} className='text-sm text-[#c3c2b7] hover:text-white'>All rides →</button>}>
        <Table
          columns={[ 'Requested', 'Captain', 'Route', 'Fare', 'Status' ]}
          items={data.recentRides}
          empty='This rider has not booked any rides yet.'
          onRowClick={r => navigate(`/admin/rides/${r._id}`)}
          renderCells={r => (
            <>
              <Td className='whitespace-nowrap text-[#c3c2b7]'>{formatDateTime(r.createdAt)}</Td>
              <Td>{r.captain ? <PersonCell name={formatName(r.captain.fullname)} sub={r.captain.vehicle?.plate} /> : <span className='text-[#898781]'>—</span>}</Td>
              <Td><RouteCell pickup={r.pickup} destination={r.destination} /></Td>
              <Td className='font-medium tabular-nums'>{formatMoney(r.fare)}</Td>
              <Td><StatusBadge status={r.status} /></Td>
            </>
          )}
        />
      </Card>

      {editing && <EditRider rider={data} onClose={() => setEditing(false)} onSaved={(u) => { setEditing(false); merge(u, 'Rider details saved.') }} />}
    </div>
  )
}

export default RiderDetail
