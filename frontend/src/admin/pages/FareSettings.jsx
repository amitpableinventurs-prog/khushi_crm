import React, { useEffect, useState } from 'react'
import adminApi, { errorMessage, useAdminData } from '../api'
import { formatMoney, VEHICLE_LABELS } from '../format'
import { Button, Card, ErrorBanner, Input, PageHeader, Spinner, SuccessBanner } from '../ui'

const TYPES = [ 'car', 'auto', 'moto' ]
const FIELDS = [
  { key: 'baseFare', label: 'Base fare (₹)', step: '1' },
  { key: 'perKm', label: 'Per km (₹)', step: '0.5' },
  { key: 'perMinute', label: 'Per minute (₹)', step: '0.5' },
]

const fareFor = (rate, km, minutes) => Math.round(Number(rate.baseFare) + km * Number(rate.perKm) + minutes * Number(rate.perMinute))

const FareSettings = () => {
  const { data, setData, error } = useAdminData('/settings/fares')
  const [ form, setForm ] = useState(null)
  const [ previewKm, setPreviewKm ] = useState(10)
  const [ previewMin, setPreviewMin ] = useState(25)
  const [ saveError, setSaveError ] = useState('')
  const [ notice, setNotice ] = useState('')
  const [ isSaving, setIsSaving ] = useState(false)

  useEffect(() => { if (data) setForm(data) }, [ data ])

  if (!form) return <><PageHeader title='Fare settings' /><ErrorBanner>{error}</ErrorBanner>{!error && <Spinner />}</>

  const isDirty = JSON.stringify(form) !== JSON.stringify(data)
  const set = (type, key) => (e) => setForm({ ...form, [ type ]: { ...form[ type ], [ key ]: e.target.value } })

  const save = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setSaveError('')
    setNotice('')
    try {
      const response = await adminApi.put('/settings/fares', form)
      setData(response.data)
      setNotice('Fares saved. New bookings use these rates right away; existing rides keep their fare.')
    } catch (err) {
      setSaveError(errorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title='Fare settings' subtitle='Fare = base fare + (distance × per-km rate) + (time × per-minute rate), rounded to the nearest rupee' />
      <SuccessBanner>{notice}</SuccessBanner>
      <ErrorBanner>{saveError}</ErrorBanner>

      <form onSubmit={save}>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4'>
          {TYPES.map(type => (
            <Card key={type} title={VEHICLE_LABELS[ type ]}>
              <div className='space-y-3'>
                {FIELDS.map(f => (
                  <Input
                    key={f.key}
                    label={f.label}
                    type='number'
                    min='0'
                    step={f.step}
                    required
                    value={form[ type ][ f.key ]}
                    onChange={set(type, f.key)}
                  />
                ))}
              </div>
              <p className='text-sm text-[#c3c2b7] mt-4 pt-3 border-t border-white/10'>
                {previewKm} km, {previewMin} min trip: <span className='font-semibold text-[#f0efec]'>{formatMoney(fareFor(form[ type ], previewKm, previewMin))}</span>
                {isDirty && <span className='text-xs text-[#898781]'> (now {formatMoney(fareFor(data[ type ], previewKm, previewMin))})</span>}
              </p>
            </Card>
          ))}
        </div>

        <Card title='Preview trip' subtitle='Change the sample trip to see what riders would pay'>
          <div className='flex flex-wrap items-end gap-3'>
            <Input label='Distance (km)' type='number' min='0' step='0.5' value={previewKm} onChange={e => setPreviewKm(Number(e.target.value) || 0)} className='w-36' />
            <Input label='Duration (min)' type='number' min='0' step='1' value={previewMin} onChange={e => setPreviewMin(Number(e.target.value) || 0)} className='w-36' />
            <div className='flex-1'></div>
            {isDirty && <Button variant='ghost' onClick={() => setForm(data)}>Discard changes</Button>}
            <Button type='submit' variant='primary' icon='ri-save-line' disabled={!isDirty || isSaving}>{isSaving ? 'Saving…' : 'Save fares'}</Button>
          </div>
        </Card>
      </form>
    </div>
  )
}

export default FareSettings
