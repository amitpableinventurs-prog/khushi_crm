import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import adminApi, { errorMessage, useAdminData } from '../api'
import { useFilters } from '../useFilters'
import { formatDateTime } from '../format'
import { Button, Card, ErrorBanner, Input, PageHeader, Pagination, Select, Spinner, SuccessBanner, Table, Td } from '../ui'

const CHANNELS = [
  { key: 'email', label: 'Email', icon: 'ri-mail-line' },
  { key: 'sms', label: 'SMS', icon: 'ri-message-2-line' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'ri-whatsapp-line' },
  { key: 'push', label: 'Push', icon: 'ri-notification-3-line' },
]

const LOG_STATUS = {
  sent: { cls: 'bg-emerald-500/15 text-emerald-200', icon: 'ri-check-line' },
  failed: { cls: 'bg-red-500/15 text-red-200', icon: 'ri-close-line' },
  skipped: { cls: 'bg-white/10 text-[#c3c2b7]', icon: 'ri-skip-forward-line' },
}

const Rules = ({ data, onSaved }) => {
  const [ rules, setRules ] = useState(data.rules)
  const [ message, setMessage ] = useState({})
  const [ isSaving, setIsSaving ] = useState(false)

  useEffect(() => { setRules(data.rules) }, [ data.rules ])

  const isDirty = JSON.stringify(rules) !== JSON.stringify(data.rules)
  const toggle = (event, channel) => setRules(r => ({ ...r, [ event ]: { ...r[ event ], [ channel ]: !r[ event ][ channel ] } }))

  const save = async () => {
    setIsSaving(true)
    setMessage({})
    try {
      const response = await adminApi.put('/notifications/rules', { rules })
      onSaved(response.data.rules)
      setMessage({ ok: 'Saved. New ride events use these rules within 30 seconds.' })
    } catch (err) {
      setMessage({ error: errorMessage(err) })
    } finally {
      setIsSaving(false)
    }
  }

  const groups = [ [ 'rider', 'Riders get' ], [ 'captain', 'Captains get' ] ]

  return (
    <Card
      title='What gets sent'
      subtitle='Switch each update on or off per channel. A channel only sends when its integration is ready.'
      actions={(
        <>
          {isDirty && <Button variant='ghost' onClick={() => setRules(data.rules)}>Discard</Button>}
          <Button variant='primary' icon='ri-save-line' onClick={save} disabled={!isDirty || isSaving}>{isSaving ? 'Saving…' : 'Save'}</Button>
        </>
      )}
    >
      <SuccessBanner>{message.ok}</SuccessBanner>
      <ErrorBanner>{message.error}</ErrorBanner>
      <div className='overflow-x-auto -mx-4 sm:-mx-5'>
        <table className='w-full min-w-[640px] text-sm'>
          <thead>
            <tr className='text-xs text-[#898781]'>
              <th className='text-left font-medium px-4 sm:px-5 py-2'>Update</th>
              {CHANNELS.map(c => (
                <th key={c.key} className='font-medium px-2 py-2 w-24'>
                  <span className='inline-flex flex-col items-center gap-0.5'>
                    <i className={`${c.icon} text-base`}></i>{c.label}
                    {!data.channels[ c.key ].ready && <span className='text-[10px] text-yellow-200/80'>not set up</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map(([ audience, heading ]) => (
            <tbody key={audience}>
              <tr><td colSpan={5} className='px-4 sm:px-5 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-[#898781]'>{heading}</td></tr>
              {data.events.filter(e => e.audience === audience).map(ev => (
                <tr key={ev.key} className='border-t border-white/5'>
                  <td className='px-4 sm:px-5 py-2.5'>
                    <p className='text-[#f0efec]'>{ev.label}</p>
                    <p className='text-xs text-[#898781]'>{ev.description}</p>
                  </td>
                  {CHANNELS.map(c => (
                    <td key={c.key} className='text-center px-2'>
                      <input
                        type='checkbox'
                        checked={Boolean(rules[ ev.key ]?.[ c.key ])}
                        onChange={() => toggle(ev.key, c.key)}
                        aria-label={`${ev.label} by ${c.label}`}
                        className='h-4 w-4 accent-emerald-500 cursor-pointer'
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Card>
  )
}

const TestSend = ({ channels }) => {
  const [ channel, setChannel ] = useState('email')
  const [ to, setTo ] = useState('')
  const [ result, setResult ] = useState(null)
  const [ isSending, setIsSending ] = useState(false)

  const placeholder = {
    email: 'name@example.com',
    sms: '+91 98765 43210',
    whatsapp: '+91 98765 43210',
    push: 'Email of a rider or captain who turned on notifications',
  }[ channel ]

  const send = async (e) => {
    e.preventDefault()
    setIsSending(true)
    setResult(null)
    try {
      setResult((await adminApi.post('/notifications/test', { channel, to })).data)
    } catch (err) {
      setResult({ ok: false, message: errorMessage(err) })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card title='Send a test' subtitle='Sends one message right now and records it in the log below'>
      <form onSubmit={send} className='grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-3 items-end'>
        <Select label='Channel' value={channel} onChange={e => { setChannel(e.target.value); setResult(null) }} options={CHANNELS.map(c => ({ value: c.key, label: `${c.label}${channels[ c.key ].ready ? '' : ' (not set up)'}` }))} />
        <Input label={channel === 'push' ? 'Send to account (email)' : 'Send to'} required value={to} onChange={e => setTo(e.target.value)} placeholder={placeholder} />
        <Button type='submit' variant='primary' icon='ri-send-plane-line' disabled={isSending}>{isSending ? 'Sending…' : 'Send test'}</Button>
      </form>
      {!channels[ channel ].ready && (
        <p className='text-xs text-yellow-200/80 mt-2'>
          <i className='ri-error-warning-line'></i> {channels[ channel ].integration} is not set up yet. <Link to='/admin/integrations' className='underline'>Open Integrations</Link>
        </p>
      )}
      {result && (
        <p role='status' className={`mt-3 text-sm rounded-xl border px-4 py-3 ${result.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-red-500/30 bg-red-500/10 text-red-100'}`}>
          <i className={result.ok ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}></i> {result.message}
        </p>
      )}
    </Card>
  )
}

const Log = ({ events }) => {
  const { filters, page, setFilter, setPage } = useFilters({ channel: '', status: '' })
  const { data, error, isLoading, reload } = useAdminData('/notifications/log', { ...filters, page }, { refreshMs: 15000 })
  const eventLabel = Object.fromEntries(events.map(e => [ e.key, e.label ]))

  return (
    <Card
      title='Delivery log'
      subtitle='Last 30 days · refreshes every 15 seconds'
      padded={false}
      actions={(
        <>
          <Select value={filters.channel} onChange={e => setFilter('channel', e.target.value)} options={[ { value: '', label: 'All channels' }, ...CHANNELS.map(c => ({ value: c.key, label: c.label })) ]} />
          <Select value={filters.status} onChange={e => setFilter('status', e.target.value)} options={[ { value: '', label: 'All results' }, { value: 'sent', label: 'Sent' }, { value: 'failed', label: 'Failed' }, { value: 'skipped', label: 'Skipped' } ]} />
          <Button variant='ghost' icon={`ri-refresh-line ${isLoading ? 'animate-spin' : ''}`} onClick={reload} aria-label='Refresh' />
        </>
      )}
    >
      <ErrorBanner>{error}</ErrorBanner>
      {!data ? <Spinner /> : (
        <>
          <Table
            columns={[ 'Time', 'Update', 'Channel', 'Recipient', 'Result', 'Details' ]}
            items={data.items}
            minWidth={820}
            empty='Nothing sent yet. Messages appear here as rides happen.'
            renderCells={l => (
              <>
                <Td className='whitespace-nowrap text-[#c3c2b7]'>{formatDateTime(l.createdAt)}</Td>
                <Td>
                  {l.event === 'test' ? 'Test message' : eventLabel[ l.event ] || l.event}
                  {l.ride && <Link to={`/admin/rides/${l.ride}`} className='block text-xs text-[#898781] hover:underline'>View ride</Link>}
                </Td>
                <Td className='capitalize whitespace-nowrap'>{CHANNELS.find(c => c.key === l.channel)?.label}</Td>
                <Td>
                  <p>{l.recipientName || '—'}</p>
                  <p className='text-xs text-[#898781] capitalize'>{l.recipientType}{l.to ? ` · ${l.to}` : ''}</p>
                </Td>
                <Td>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium capitalize ${LOG_STATUS[ l.status ].cls}`}>
                    <i className={LOG_STATUS[ l.status ].icon}></i> {l.status}
                  </span>
                </Td>
                <Td className='text-[#c3c2b7] max-w-[280px] break-words'>{l.detail || '—'}</Td>
              </>
            )}
          />
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </>
      )}
    </Card>
  )
}

const Notifications = () => {
  const { data, setData, error } = useAdminData('/notifications')

  if (!data) return <><PageHeader title='Notifications' /><ErrorBanner>{error}</ErrorBanner>{!error && <Spinner />}</>

  return (
    <div>
      <PageHeader title='Notifications' subtitle='Ride updates sent to riders and captains by email, SMS, WhatsApp and push' />

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4'>
        {CHANNELS.map(c => {
          const status = data.channels[ c.key ]
          return (
            <Link key={c.key} to='/admin/integrations' className='bg-[#1a1a19] border border-white/10 rounded-2xl p-4 hover:border-white/20'>
              <div className='flex items-center justify-between'>
                <p className='text-sm text-[#c3c2b7]'>{c.label}</p>
                <i className={`${c.icon} text-lg text-[#898781]`}></i>
              </div>
              <p className={`mt-2 inline-flex items-center gap-1 text-sm font-medium ${status.ready ? 'text-emerald-200' : 'text-yellow-200/90'}`}>
                <i className={status.ready ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}></i>
                {status.ready ? 'Ready' : 'Not set up'}
              </p>
              <p className='text-xs text-[#898781] mt-0.5'>{status.integration}</p>
            </Link>
          )
        })}
      </div>

      <div className='space-y-4'>
        <Rules data={data} onSaved={rules => setData({ ...data, rules })} />
        <TestSend channels={data.channels} />
        <Log events={data.events} />
      </div>
    </div>
  )
}

export default Notifications
