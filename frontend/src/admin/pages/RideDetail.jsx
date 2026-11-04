import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import adminApi, { errorMessage, useAdminData } from '../api'
import { formatDateTime, formatDistance, formatDuration, formatMoney, formatName, VEHICLE_LABELS } from '../format'
import { Button, Card, DetailList, ErrorBanner, Modal, PageHeader, PaymentBadge, Spinner, StatusBadge, SuccessBanner } from '../ui'

const STEPS = [
  { status: 'pending', label: 'Requested', icon: 'ri-time-line' },
  { status: 'accepted', label: 'Captain accepted', icon: 'ri-user-follow-line' },
  { status: 'ongoing', label: 'Ride started (OTP verified)', icon: 'ri-steering-2-line' },
  { status: 'completed', label: 'Completed', icon: 'ri-checkbox-circle-line' },
]

const RideDetail = () => {
  const { id } = useParams()
  const { data: ride, setData, error } = useAdminData(`/rides/${id}`)
  const [ showCancel, setShowCancel ] = useState(false)
  const [ showRefund, setShowRefund ] = useState(false)
  const [ reason, setReason ] = useState('')
  const [ actionError, setActionError ] = useState('')
  const [ notice, setNotice ] = useState('')
  const [ isSaving, setIsSaving ] = useState(false)

  if (!ride) return <><PageHeader title='Ride' back={{ to: '/admin/rides', label: 'Rides' }} /><ErrorBanner>{error}</ErrorBanner>{!error && <Spinner />}</>

  const canCancel = [ 'pending', 'accepted', 'ongoing' ].includes(ride.status)
  const canRefund = ride.paymentMethod === 'online' && ride.paymentStatus === 'paid' && ride.paymentID

  const refundRide = async () => {
    setIsSaving(true)
    setActionError('')
    try {
      const response = await adminApi.post(`/rides/${id}/refund`)
      setData(response.data)
      setShowRefund(false)
      setNotice(`Refund of ${formatMoney(ride.fare)} started. Razorpay usually returns the money in 5–7 working days.`)
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }
  const reached = STEPS.findIndex(s => s.status === ride.status)

  const cancelRide = async () => {
    setIsSaving(true)
    setActionError('')
    try {
      const response = await adminApi.post(`/rides/${id}/cancel`, { reason })
      setData(response.data)
      setShowCancel(false)
      setNotice('Ride cancelled. The rider and captain have been notified if they are online.')
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={`Ride · ${formatMoney(ride.fare)}`}
        subtitle={`ID ${ride._id}`}
        back={{ to: '/admin/rides', label: 'Rides' }}
        actions={(
          <>
            <StatusBadge status={ride.status} />
            {canCancel && <Button variant='danger' icon='ri-close-circle-line' onClick={() => setShowCancel(true)}>Cancel ride</Button>}
          </>
        )}
      />
      <SuccessBanner>{notice}</SuccessBanner>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
        <div className='lg:col-span-2 space-y-4'>
          <Card title='Trip'>
            <div className='space-y-3 mb-5'>
              <div className='flex gap-3'>
                <i className='ri-map-pin-2-fill text-emerald-400 text-lg'></i>
                <div><p className='text-xs text-[#898781]'>Pickup</p><p>{ride.pickup}</p></div>
              </div>
              <div className='flex gap-3'>
                <i className='ri-flag-2-fill text-red-400 text-lg'></i>
                <div><p className='text-xs text-[#898781]'>Destination</p><p>{ride.destination}</p></div>
              </div>
            </div>
            <DetailList items={[
              [ 'Fare', formatMoney(ride.fare) ],
              [ 'Vehicle type', VEHICLE_LABELS[ ride.vehicleType ] || 'Not recorded' ],
              [ 'Distance', formatDistance(ride.distance) ],
              [ 'Estimated duration', formatDuration(ride.duration) ],
              ride.status === 'cancelled' && [ 'Cancelled by', ride.cancelledBy === 'admin' ? 'Admin' : 'Rider' ],
              ride.status === 'cancelled' && ride.cancelReason && [ 'Cancel reason', ride.cancelReason ],
            ]} />
          </Card>

          <Card title='Timeline'>
            <ol className='space-y-3'>
              {STEPS.map((step, i) => {
                const done = ride.status !== 'cancelled' && i <= reached
                return (
                  <li key={step.status} className={`flex items-center gap-3 text-sm ${done ? 'text-[#f0efec]' : 'text-[#898781]'}`}>
                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ${done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5'}`}>
                      <i className={done ? 'ri-check-line' : step.icon}></i>
                    </span>
                    <span className='flex-1'>{step.label}</span>
                    {step.status === 'pending' && <span className='text-xs text-[#898781]'>{formatDateTime(ride.createdAt)}</span>}
                    {step.status === 'completed' && ride.completedAt && <span className='text-xs text-[#898781]'>{formatDateTime(ride.completedAt)}</span>}
                  </li>
                )
              })}
              {ride.status === 'cancelled' && (
                <li className='flex items-center gap-3 text-sm text-red-200'>
                  <span className='h-8 w-8 rounded-full flex items-center justify-center bg-red-500/15'><i className='ri-close-line'></i></span>
                  <span className='flex-1'>Cancelled by {ride.cancelledBy === 'admin' ? 'admin' : 'rider'}</span>
                  <span className='text-xs text-[#898781]'>{formatDateTime(ride.updatedAt)}</span>
                </li>
              )}
            </ol>
          </Card>
        </div>

        <div className='space-y-4'>
          <Card
            title='Payment'
            actions={canRefund && <Button variant='danger' icon='ri-refund-2-line' onClick={() => { setActionError(''); setShowRefund(true) }}>Refund</Button>}
          >
            <div className='mb-3'><PaymentBadge ride={ride} /></div>
            <DetailList items={[
              [ 'Method', ride.paymentMethod === 'online' ? 'Online (Razorpay)' : ride.paymentMethod === 'cash' ? 'Cash' : 'Not paid yet' ],
              ride.paidAt && [ 'Paid at', formatDateTime(ride.paidAt) ],
              ride.paymentID && [ 'Razorpay payment ID', <a key='p' className='hover:underline break-all' href={`https://dashboard.razorpay.com/app/payments/${ride.paymentID}`} target='_blank' rel='noreferrer'>{ride.paymentID} <i className='ri-external-link-line'></i></a> ],
              ride.orderId && [ 'Razorpay order ID', <span key='o' className='break-all'>{ride.orderId}</span> ],
              ride.refundId && [ 'Refund ID', <span key='r' className='break-all'>{ride.refundId}</span> ],
              ride.refundedAt && [ 'Refunded at', formatDateTime(ride.refundedAt) ],
            ]} />
          </Card>
          <Card title='Rider'>
            {ride.user ? (
              <div className='space-y-1 text-sm'>
                <p className='font-medium'>{formatName(ride.user.fullname)}</p>
                <p className='text-[#c3c2b7]'>{ride.user.email}</p>
                <Link to={`/admin/riders/${ride.user._id}`} className='inline-block mt-2 text-emerald-300 hover:underline'>View rider →</Link>
              </div>
            ) : <p className='text-sm text-[#898781]'>This rider account was deleted.</p>}
          </Card>
          <Card title='Captain'>
            {ride.captain ? (
              <div className='space-y-1 text-sm'>
                <p className='font-medium'>{formatName(ride.captain.fullname)}</p>
                <p className='text-[#c3c2b7]'>{ride.captain.email}</p>
                <p className='text-[#c3c2b7] capitalize'>{VEHICLE_LABELS[ ride.captain.vehicle?.vehicleType ]} · {ride.captain.vehicle?.color} · {ride.captain.vehicle?.plate}</p>
                <Link to={`/admin/captains/${ride.captain._id}`} className='inline-block mt-2 text-emerald-300 hover:underline'>View captain →</Link>
              </div>
            ) : <p className='text-sm text-[#898781]'>{ride.status === 'pending' ? 'No captain has accepted yet.' : 'No captain assigned.'}</p>}
          </Card>
        </div>
      </div>

      {showRefund && (
        <Modal
          title={`Refund ${formatMoney(ride.fare)}?`}
          onClose={() => setShowRefund(false)}
          footer={(
            <>
              <Button variant='ghost' onClick={() => setShowRefund(false)}>Keep payment</Button>
              <Button variant='danger' onClick={refundRide} disabled={isSaving}>{isSaving ? 'Refunding…' : 'Refund in full'}</Button>
            </>
          )}
        >
          <ErrorBanner>{actionError}</ErrorBanner>
          <p className='text-sm text-[#c3c2b7]'>The full fare goes back to the rider’s original payment method through Razorpay. This can’t be undone.</p>
        </Modal>
      )}

      {showCancel && (
        <Modal
          title='Cancel this ride?'
          onClose={() => setShowCancel(false)}
          footer={(
            <>
              <Button variant='ghost' onClick={() => setShowCancel(false)}>Keep ride</Button>
              <Button variant='danger' onClick={cancelRide} disabled={isSaving}>{isSaving ? 'Cancelling…' : 'Cancel ride'}</Button>
            </>
          )}
        >
          <ErrorBanner>{actionError}</ErrorBanner>
          <p className='text-sm text-[#c3c2b7] mb-4'>The ride will be marked as cancelled by admin and the rider and captain will be notified. This can’t be undone.</p>
          <label className='flex flex-col gap-1.5 text-sm'>
            <span className='text-xs font-medium text-[#c3c2b7]'>Reason (optional)</span>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={300}
              rows={3}
              className='bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500'
              placeholder='e.g. Rider requested by phone'
            />
          </label>
        </Modal>
      )}
    </div>
  )
}

export default RideDetail
