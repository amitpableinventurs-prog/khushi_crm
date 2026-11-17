import React, { useState } from 'react'
import adminApi, { errorMessage, useAdminData } from '../api'
import { describeDays, formatDate, formatMoney, formatNumber, indiaDayKey, VEHICLE_LABELS, VEHICLES, WEEKDAYS } from '../format'
import { Button, Card, ChipGroup, ErrorBanner, Input, Modal, PageHeader, Select, Spinner, SuccessBanner, Table, Td, Toggle } from '../ui'

const TEXT = {
  offer: {
    title: 'Offers',
    subtitle: 'Automatic discounts: applied without a code whenever an order matches the rules. If several match, the customer gets the biggest one.',
    one: 'offer',
    add: 'Add offer',
    empty: 'No offers yet.',
  },
  coupon: {
    title: 'Coupons',
    subtitle: 'Discount codes the customer enters at booking. If an automatic offer gives more, the offer is used instead of the coupon.',
    one: 'coupon',
    add: 'Add coupon',
    empty: 'No coupons yet.',
  },
}

const DAY_OPTIONS = WEEKDAYS.map((label, value) => ({ value, label }))
const VEHICLE_OPTIONS = VEHICLES.map(v => ({ value: v.key, label: v.label }))

const EMPTY = {
  title: '', description: '', code: '', discountType: 'percent', value: '', maxDiscount: '', minFare: '',
  vehicleTypes: [], days: [], startTime: '', endTime: '', validFrom: '', validTo: '',
  usageLimit: '', perUserLimit: '', firstOrderOnly: false, showToCustomers: true, isActive: true,
}

const toForm = (p) => ({
  ...EMPTY,
  ...Object.fromEntries(Object.entries(p).filter(([ key ]) => key in EMPTY)),
  ...Object.fromEntries([ 'value', 'maxDiscount', 'minFare', 'usageLimit', 'perUserLimit' ].map(k => [ k, p[ k ] ?? '' ])),
  minFare: p.minFare || '',
  validFrom: indiaDayKey(p.validFrom),
  validTo: indiaDayKey(p.validTo),
})

const discountText = (p) => p.discountType === 'percent'
  ? `${p.value}% off${p.maxDiscount ? ` (up to ${formatMoney(p.maxDiscount)})` : ''}`
  : `${formatMoney(p.value)} off`

const rulesText = (p) => [
  p.minFare ? `Orders ${formatMoney(p.minFare)}+` : '',
  p.vehicleTypes?.length ? p.vehicleTypes.map(v => VEHICLE_LABELS[ v ]).join(', ') : '',
  p.days?.length ? describeDays(p.days) : '',
  p.startTime && p.endTime ? `${p.startTime}–${p.endTime}` : '',
  p.firstOrderOnly ? 'First order only' : '',
].filter(Boolean).join(' · ') || 'All orders'

const statusOf = (p) => {
  const now = Date.now()
  if (!p.isActive) return { label: 'Paused', cls: 'bg-white/10 text-[#c3c2b7]', icon: 'ri-pause-circle-line' }
  if (p.validTo && new Date(p.validTo).getTime() < now) return { label: 'Expired', cls: 'bg-red-500/15 text-red-200', icon: 'ri-calendar-close-line' }
  if (p.validFrom && new Date(p.validFrom).getTime() > now) return { label: 'Scheduled', cls: 'bg-sky-500/15 text-sky-200', icon: 'ri-calendar-schedule-line' }
  if (p.usageLimit && p.usage.orders >= p.usageLimit) return { label: 'Used up', cls: 'bg-yellow-500/15 text-yellow-200', icon: 'ri-stop-circle-line' }
  return { label: 'Live', cls: 'bg-emerald-500/15 text-emerald-200', icon: 'ri-checkbox-circle-line' }
}

const PromoForm = ({ kind, promo, onClose, onSaved }) => {
  const [ form, setForm ] = useState(promo ? toForm(promo) : EMPTY)
  const [ error, setError ] = useState('')
  const [ isSaving, setIsSaving ] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [ key ]: e.target.value })
  const text = TEXT[ kind ]

  const save = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      const body = { ...form, kind }
      const response = promo ? await adminApi.put(`/promos/${promo._id}`, body) : await adminApi.post('/promos', body)
      onSaved(response.data, Boolean(promo))
    } catch (err) {
      setError(errorMessage(err))
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title={promo ? `Edit ${text.one}` : text.add}
      onClose={onClose}
      footer={(
        <>
          <Button variant='ghost' onClick={onClose}>Cancel</Button>
          <Button variant='primary' type='submit' form='promo-form' disabled={isSaving}>{isSaving ? 'Saving…' : 'Save'}</Button>
        </>
      )}
    >
      <ErrorBanner>{error}</ErrorBanner>
      <form id='promo-form' onSubmit={save} className='space-y-4'>
        {kind === 'coupon' && (
          <Input
            label='Coupon code'
            required
            pattern='[A-Za-z0-9_\-]{3,20}'
            title='3–20 letters, numbers, - or _'
            value={form.code}
            onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder='e.g. KHUSHI50'
          />
        )}
        <Input label='Title (shown to customers)' required minLength={2} maxLength={80} value={form.title} onChange={set('title')} placeholder={kind === 'offer' ? 'e.g. Night delivery 10% off' : 'e.g. ₹50 off'} />
        <Input label='Description (optional)' maxLength={300} value={form.description} onChange={set('description')} />

        <div className='grid grid-cols-2 gap-3'>
          <Select label='Discount type' value={form.discountType} onChange={set('discountType')} options={[ { value: 'percent', label: 'Percent (%)' }, { value: 'flat', label: 'Flat amount (₹)' } ]} />
          <Input label={form.discountType === 'percent' ? 'Discount (%)' : 'Discount (₹)'} type='number' required min='0.01' max={form.discountType === 'percent' ? 100 : undefined} step='any' value={form.value} onChange={set('value')} />
          {form.discountType === 'percent' && <Input label='Max discount (₹, optional)' type='number' min='1' step='any' value={form.maxDiscount} onChange={set('maxDiscount')} />}
          <Input label='Minimum order (₹, optional)' type='number' min='0' step='any' value={form.minFare} onChange={set('minFare')} />
        </div>

        <ChipGroup label='Vehicles' emptyLabel='All vehicles' options={VEHICLE_OPTIONS} value={form.vehicleTypes} onChange={vehicleTypes => setForm({ ...form, vehicleTypes })} />
        <ChipGroup label='Days' emptyLabel='Every day' options={DAY_OPTIONS} value={form.days} onChange={days => setForm({ ...form, days })} />

        <div>
          <div className='grid grid-cols-2 gap-3'>
            <Input label='Daily from (optional)' type='time' value={form.startTime} onChange={set('startTime')} />
            <Input label='Daily to (optional)' type='time' value={form.endTime} onChange={set('endTime')} />
          </div>
          <p className='text-xs text-[#898781] mt-1.5'>India time. Leave both empty for all day. An end before the start runs past midnight (22:00–06:00).</p>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <Input label='Starts on (optional)' type='date' value={form.validFrom} max={form.validTo || undefined} onChange={set('validFrom')} />
          <Input label='Ends on (optional)' type='date' value={form.validTo} min={form.validFrom || undefined} onChange={set('validTo')} />
          <Input label='Total uses (optional)' type='number' min='1' step='1' value={form.usageLimit} onChange={set('usageLimit')} placeholder='Unlimited' />
          <Input label='Uses per customer (optional)' type='number' min='1' step='1' value={form.perUserLimit} onChange={set('perUserLimit')} placeholder='Unlimited' />
        </div>

        <div className='space-y-3 pt-1'>
          <Toggle label='First order only' hint='Only customers with no earlier orders' checked={form.firstOrderOnly} onChange={firstOrderOnly => setForm({ ...form, firstOrderOnly })} />
          {kind === 'coupon' && <Toggle label='Show this code in the app' hint='Off = a private code you share yourself' checked={form.showToCustomers} onChange={showToCustomers => setForm({ ...form, showToCustomers })} />}
          <Toggle label='Active' checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
        </div>
      </form>
    </Modal>
  )
}

const Promos = ({ kind }) => {
  const text = TEXT[ kind ]
  const { data, setData, error } = useAdminData('/promos', { kind })
  const [ editing, setEditing ] = useState(null) // null | 'new' | promo
  const [ removing, setRemoving ] = useState(null)
  const [ actionError, setActionError ] = useState('')
  const [ notice, setNotice ] = useState('')

  const saved = (promo, existed) => {
    setData(existed ? data.map(p => p._id === promo._id ? promo : p) : [ promo, ...data ])
    setEditing(null)
    setNotice(`${kind === 'coupon' ? promo.code : promo.title} saved.`)
  }

  const setActive = async (promo, isActive) => {
    setActionError('')
    try {
      const response = await adminApi.put(`/promos/${promo._id}`, { ...toForm(promo), isActive })
      setData(data.map(p => p._id === promo._id ? response.data : p))
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  const remove = async () => {
    setActionError('')
    try {
      await adminApi.delete(`/promos/${removing._id}`)
      setData(data.filter(p => p._id !== removing._id))
      setNotice(`${kind === 'coupon' ? removing.code : removing.title} deleted. Orders that used it keep their discount.`)
      setRemoving(null)
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  return (
    <div>
      <PageHeader
        title={text.title}
        subtitle={text.subtitle}
        actions={<Button variant='primary' icon='ri-add-line' onClick={() => setEditing('new')}>{text.add}</Button>}
      />
      <SuccessBanner>{notice}</SuccessBanner>
      <ErrorBanner>{error || (!removing && actionError)}</ErrorBanner>

      <Card padded={false}>
        {!data ? <Spinner /> : (
          <Table
            columns={[ kind === 'coupon' ? 'Code' : 'Offer', 'Discount', 'Rules', 'Valid', 'Used', 'Status', '' ]}
            items={data}
            minWidth={900}
            empty={text.empty}
            renderCells={p => {
              const status = statusOf(p)
              return (
                <>
                  <Td>
                    {kind === 'coupon' && <p className='font-mono font-semibold tracking-wide'>{p.code}</p>}
                    <p className={kind === 'coupon' ? 'text-xs text-[#c3c2b7]' : 'font-medium'}>{p.title}</p>
                    {kind === 'coupon' && !p.showToCustomers && <p className='text-xs text-[#898781]'><i className='ri-eye-off-line'></i> Private code</p>}
                  </Td>
                  <Td className='whitespace-nowrap'>{discountText(p)}</Td>
                  <Td className='text-[#c3c2b7] max-w-[240px]'>{rulesText(p)}</Td>
                  <Td className='text-[#c3c2b7] whitespace-nowrap'>
                    {p.validFrom || p.validTo ? `${p.validFrom ? formatDate(p.validFrom) : 'Now'} – ${p.validTo ? formatDate(p.validTo) : 'No end'}` : 'Always'}
                  </Td>
                  <Td className='tabular-nums whitespace-nowrap'>
                    {formatNumber(p.usage.orders)}{p.usageLimit ? ` / ${formatNumber(p.usageLimit)}` : ''}
                    <p className='text-xs text-[#898781]'>{formatMoney(p.usage.discount)} given</p>
                  </Td>
                  <Td>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium whitespace-nowrap ${status.cls}`}>
                      <i className={status.icon}></i> {status.label}
                    </span>
                  </Td>
                  <Td className='text-right whitespace-nowrap'>
                    <Button variant='ghost' icon={p.isActive ? 'ri-pause-line' : 'ri-play-line'} onClick={() => setActive(p, !p.isActive)}>{p.isActive ? 'Pause' : 'Resume'}</Button>
                    <Button variant='ghost' icon='ri-edit-line' onClick={() => setEditing(p)} aria-label='Edit' />
                    <Button variant='ghost' icon='ri-delete-bin-line' onClick={() => { setActionError(''); setRemoving(p) }} aria-label='Delete' />
                  </Td>
                </>
              )
            }}
          />
        )}
      </Card>

      {editing && <PromoForm kind={kind} promo={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={saved} />}

      {removing && (
        <Modal
          title={`Delete this ${text.one}?`}
          onClose={() => setRemoving(null)}
          footer={(
            <>
              <Button variant='ghost' onClick={() => setRemoving(null)}>Cancel</Button>
              <Button variant='danger' onClick={remove}>Delete</Button>
            </>
          )}
        >
          <ErrorBanner>{actionError}</ErrorBanner>
          <p className='text-sm text-[#c3c2b7]'>
            <span className='text-white'>{kind === 'coupon' ? removing.code : removing.title}</span> stops working for new orders. Orders that already used it keep their discount.
            {' '}To stop it for a while instead, use Pause.
          </p>
        </Modal>
      )}
    </div>
  )
}

export default Promos
