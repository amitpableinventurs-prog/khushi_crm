import React, { useEffect, useState } from 'react'
import adminApi, { errorMessage, useAdminData } from '../api'
import { describeDays, formatMoney, indiaClock, inWindow, VEHICLE_LABELS, VEHICLES, WEEKDAYS } from '../format'
import { Button, Card, ChipGroup, EmptyState, ErrorBanner, Input, PageHeader, Spinner, SuccessBanner } from '../ui'

const DAY_OPTIONS = WEEKDAYS.map((label, value) => ({ value, label }))
const VEHICLE_OPTIONS = VEHICLES.map(v => ({ value: v.key, label: v.label }))
const NEW_SLOT = { name: '', start: '08:00', end: '11:00', days: [], vehicleTypes: [], percent: 15 }

// Which rate a booking gets right now, for one vehicle (first matching slot wins)
const rateNow = (form, vehicleType, clock) => {
  const index = form.slots.findIndex(s => (!s.vehicleTypes.length || s.vehicleTypes.includes(vehicleType)) && inWindow(s, clock))
  const slot = form.slots[ index ]
  return slot ? { percent: Number(slot.percent), rule: slot.name || 'Unnamed slot', index } : { percent: Number(form.defaultPercent), rule: 'Default', index }
}

const Commission = () => {
  const { data, setData, error } = useAdminData('/settings/commission')
  const [ form, setForm ] = useState(null)
  const [ sampleFare, setSampleFare ] = useState(1000)
  const [ saveError, setSaveError ] = useState('')
  const [ notice, setNotice ] = useState('')
  const [ isSaving, setIsSaving ] = useState(false)

  useEffect(() => { if (data) setForm(data) }, [ data ])

  if (!form) return <><PageHeader title='Commission' /><ErrorBanner>{error}</ErrorBanner>{!error && <Spinner />}</>

  const isDirty = JSON.stringify(form) !== JSON.stringify(data)
  const clock = indiaClock()
  const setSlot = (i, patch) => setForm({ ...form, slots: form.slots.map((s, j) => j === i ? { ...s, ...patch } : s) })
  const moveSlot = (i, by) => {
    const slots = [ ...form.slots ]
    ;[ slots[ i ], slots[ i + by ] ] = [ slots[ i + by ], slots[ i ] ]
    setForm({ ...form, slots })
  }

  const save = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setSaveError('')
    setNotice('')
    try {
      const response = await adminApi.put('/settings/commission', form)
      setData(response.data)
      setNotice('Commission saved. New orders use these rates; orders already placed keep the rate they were booked with.')
    } catch (err) {
      setSaveError(errorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title='Commission'
        subtitle='Platform commission is a % of what the customer pays (after any offer or coupon). The driver gets the rest. The rate is picked from the booking time, in India time.'
      />
      <SuccessBanner>{notice}</SuccessBanner>
      <ErrorBanner>{saveError}</ErrorBanner>

      <form onSubmit={save} className='space-y-4'>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
          <Card title='Default commission' subtitle='Used when no time slot below matches'>
            <Input
              label='Commission (%)'
              type='number'
              min='0'
              max='100'
              step='0.5'
              required
              value={form.defaultPercent}
              onChange={e => setForm({ ...form, defaultPercent: e.target.value })}
              className='max-w-[160px]'
            />
          </Card>

          <Card title='Right now' subtitle={`India time ${String(Math.floor(clock.minutes / 60)).padStart(2, '0')}:${String(clock.minutes % 60).padStart(2, '0')}, ${WEEKDAYS[ clock.day ]}`} className='lg:col-span-2'>
            <div className='flex items-end gap-3 mb-3'>
              <Input label='Sample fare (₹)' type='number' min='0' step='50' value={sampleFare} onChange={e => setSampleFare(Number(e.target.value) || 0)} className='w-36' />
            </div>
            <ul className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm'>
              {VEHICLES.map(v => {
                const { percent, rule } = rateNow(form, v.key, clock)
                const commission = Math.round(sampleFare * (percent || 0) / 100)
                return (
                  <li key={v.key} className='flex justify-between gap-3'>
                    <span className='text-[#c3c2b7]'>{v.label} <span className='text-xs text-[#898781]'>· {rule}, {percent || 0}%</span></span>
                    <span className='tabular-nums'>{formatMoney(commission)} <span className='text-[#898781]'>/ driver {formatMoney(sampleFare - commission)}</span></span>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>

        <Card
          title='Time slots'
          subtitle='Checked from top to bottom; the first slot that matches the booking time is used. An end time before the start time runs past midnight (22:00–06:00).'
          actions={<Button icon='ri-add-line' onClick={() => setForm({ ...form, slots: [ ...form.slots, { ...NEW_SLOT } ] })} disabled={form.slots.length >= 20}>Add time slot</Button>}
        >
          {!form.slots.length && <EmptyState icon='ri-time-line'>No time slots yet. Every order uses the default commission.</EmptyState>}
          <div className='space-y-3'>
            {form.slots.map((slot, i) => {
              const live = VEHICLES.some(v => rateNow(form, v.key, clock).index === i)
              return (
                <div key={i} className='rounded-xl border border-white/10 bg-white/[0.02] p-4'>
                  <div className='flex flex-wrap items-end gap-3'>
                    <Input label='Name' required maxLength={40} value={slot.name} placeholder='e.g. Morning peak' onChange={e => setSlot(i, { name: e.target.value })} className='flex-1 min-w-[160px]' />
                    <Input label='From' type='time' required value={slot.start} onChange={e => setSlot(i, { start: e.target.value })} className='w-32' />
                    <Input label='To' type='time' required value={slot.end} onChange={e => setSlot(i, { end: e.target.value })} className='w-32' />
                    <Input label='Commission (%)' type='number' min='0' max='100' step='0.5' required value={slot.percent} onChange={e => setSlot(i, { percent: e.target.value })} className='w-32' />
                    <div className='flex items-center gap-1'>
                      <Button variant='ghost' icon='ri-arrow-up-line' aria-label='Move up' disabled={i === 0} onClick={() => moveSlot(i, -1)} />
                      <Button variant='ghost' icon='ri-arrow-down-line' aria-label='Move down' disabled={i === form.slots.length - 1} onClick={() => moveSlot(i, 1)} />
                      <Button variant='ghost' icon='ri-delete-bin-line' aria-label='Remove slot' onClick={() => setForm({ ...form, slots: form.slots.filter((_, j) => j !== i) })} />
                    </div>
                  </div>
                  <div className='grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3'>
                    <ChipGroup label='Days' emptyLabel='Every day' options={DAY_OPTIONS} value={slot.days} onChange={days => setSlot(i, { days })} />
                    <ChipGroup label='Vehicles' emptyLabel='All vehicles' options={VEHICLE_OPTIONS} value={slot.vehicleTypes} onChange={vehicleTypes => setSlot(i, { vehicleTypes })} />
                  </div>
                  <p className='text-xs text-[#898781] mt-3'>
                    {slot.start}–{slot.end} · {describeDays(slot.days)} · {slot.vehicleTypes.length ? slot.vehicleTypes.map(v => VEHICLE_LABELS[ v ]).join(', ') : 'All vehicles'}
                    {live && <span className='ml-2 text-emerald-300'><i className='ri-checkbox-blank-circle-fill text-[8px] align-middle'></i> Applies right now</span>}
                  </p>
                </div>
              )
            })}
          </div>
        </Card>

        <div className='flex justify-end gap-2'>
          {isDirty && <Button variant='ghost' onClick={() => setForm(data)}>Discard changes</Button>}
          <Button type='submit' variant='primary' icon='ri-save-line' disabled={!isDirty || isSaving}>{isSaving ? 'Saving…' : 'Save commission'}</Button>
        </div>
      </form>
    </div>
  )
}

export default Commission
