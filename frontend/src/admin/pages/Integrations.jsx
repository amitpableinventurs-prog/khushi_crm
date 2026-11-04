import React, { useContext, useEffect, useState } from 'react'
import adminApi, { errorMessage, useAdminData } from '../api'
import { AdminDataContext } from '../AdminProtectWrapper'
import { Button, Card, ErrorBanner, Input, PageHeader, Select, Spinner, SuccessBanner } from '../ui'

const SMTP_PRESETS = [
  { value: '', label: 'Fill from a provider…' },
  { value: 'gmail', label: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 587 },
  { value: 'outlook', label: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587 },
  { value: 'zoho', label: 'Zoho Mail (India)', host: 'smtp.zoho.in', port: 587 },
  { value: 'brevo', label: 'Brevo', host: 'smtp-relay.brevo.com', port: 587 },
]

const INTEGRATIONS = {
  googleMaps: {
    title: 'Google Maps Platform',
    icon: 'ri-google-line',
    about: 'Address search, distance & time for fares, and "use my location". When off or failing, the app falls back to OpenStreetMap.',
    help: (
      <>
        Create a key in <a className='underline' href='https://console.cloud.google.com/google/maps-apis/credentials' target='_blank' rel='noreferrer'>Google Cloud → Credentials</a> and
        enable <b>Geocoding API</b>, <b>Distance Matrix API</b> and <b>Places API</b>. The key is only used by the server, so restrict it by IP address, not website.
      </>
    ),
    fields: [ { key: 'apiKey', label: 'API key', secret: true, placeholder: 'AIza…' } ],
  },
  openStreetMap: {
    title: 'OpenStreetMap (Nominatim)',
    icon: 'ri-map-2-line',
    about: 'Free address search used when Google Maps is off or fails. No key needed.',
    help: (
      <>
        Nominatim’s <a className='underline' href='https://operations.osmfoundation.org/policies/nominatim/' target='_blank' rel='noreferrer'>usage policy</a> allows
        about one request per second and asks for a contact email. For heavy traffic, use Google Maps.
      </>
    ),
    fields: [
      { key: 'countryCode', label: 'Limit results to countries', placeholder: 'in', hint: 'Two-letter codes, comma separated (e.g. in or in,np). Leave empty for worldwide.' },
      { key: 'contactEmail', label: 'Contact email', type: 'email', placeholder: 'ops@yourcompany.com', hint: 'Sent to OpenStreetMap so they can contact you about usage.' },
    ],
  },
  smtp: {
    title: 'Email (SMTP)',
    icon: 'ri-mail-send-line',
    about: 'Sends password-reset OTP emails to riders and captains. When off, OTPs are only printed in the backend console.',
    help: (
      <>
        For Gmail, turn on 2-step verification and create an <a className='underline' href='https://myaccount.google.com/apppasswords' target='_blank' rel='noreferrer'>app password</a> —
        your normal Gmail password won’t work. Port 587 uses STARTTLS; port 465 uses SSL.
      </>
    ),
    fields: [
      { key: 'host', label: 'SMTP host', placeholder: 'smtp.gmail.com' },
      { key: 'port', label: 'Port', type: 'number', placeholder: '587' },
      { key: 'user', label: 'Username', placeholder: 'you@gmail.com', autoComplete: 'off' },
      { key: 'password', label: 'Password / app password', secret: true },
      { key: 'fromName', label: 'Sender name', placeholder: 'Khushi Transport', hint: 'Also used as the brand name inside emails.' },
      { key: 'fromEmail', label: 'Sender email', type: 'email', placeholder: 'Same as username', hint: 'Most providers require this to match the username.' },
    ],
  },
  razorpay: {
    title: 'Razorpay payments',
    icon: 'ri-secure-payment-line',
    about: 'Lets riders pay online with UPI, cards, netbanking and wallets at the end of the ride. Refunds can be issued from the ride page.',
    help: (
      <>
        Get keys from <a className='underline' href='https://dashboard.razorpay.com/app/website-app-settings/api-keys' target='_blank' rel='noreferrer'>Razorpay Dashboard → API Keys</a>.
        Use <b>rzp_test_</b> keys first: no real money moves. For the webhook, add the URL below in Razorpay → Webhooks with events <b>payment.captured</b> and <b>order.paid</b> (it needs a public URL, so it won’t work on localhost).
      </>
    ),
    extra: <WebhookUrl />,
    fields: [
      { key: 'keyId', label: 'Key ID', placeholder: 'rzp_test_…' },
      { key: 'keySecret', label: 'Key Secret', secret: true },
      { key: 'webhookSecret', label: 'Webhook secret (optional)', secret: true, hint: 'The secret you type when creating the webhook in Razorpay.' },
      { key: 'allowCash', label: 'Also allow cash payment', type: 'toggle', hint: 'Turn off to make online payment mandatory.' },
    ],
  },
  twilio: {
    title: 'Twilio SMS & WhatsApp',
    icon: 'ri-message-3-line',
    about: 'Ride updates by SMS and WhatsApp (captain on the way with OTP, cancellations…). Choose which updates in Notifications. The switch on the right turns on SMS.',
    help: (
      <>
        Find the Account SID and Auth Token on the <a className='underline' href='https://console.twilio.com/' target='_blank' rel='noreferrer'>Twilio Console</a> home page.
        For India, SMS needs DLT registration. WhatsApp outside a 24-hour chat window needs approved templates; for testing use the <a className='underline' href='https://www.twilio.com/docs/whatsapp/sandbox' target='_blank' rel='noreferrer'>WhatsApp sandbox</a>.
        Riders and captains need a phone number on their profile.
      </>
    ),
    testLabel: 'Send test SMS & WhatsApp to',
    testPlaceholder: '+91 98765 43210 (optional)',
    fields: [
      { key: 'accountSid', label: 'Account SID', placeholder: 'AC…' },
      { key: 'authToken', label: 'Auth Token', secret: true },
      { key: 'smsFrom', label: 'SMS sender', placeholder: '+1415… or MG… Messaging Service SID' },
      { key: 'defaultCountryCode', label: 'Default country code', placeholder: '+91', hint: 'Added to 10-digit numbers.' },
      { key: 'whatsappEnabled', label: 'Send WhatsApp messages', type: 'toggle' },
      { key: 'whatsappFrom', label: 'WhatsApp sender', placeholder: '+14155238886', hint: 'Your WhatsApp-enabled Twilio number (sandbox: +14155238886).' },
    ],
  },
  firebase: {
    title: 'Browser push (Firebase)',
    icon: 'ri-notification-3-line',
    about: 'Pop-up notifications on riders’ and captains’ devices, even when the site is closed. They turn it on with the bell button in the app.',
    help: (
      <>
        In the <a className='underline' href='https://console.firebase.google.com/' target='_blank' rel='noreferrer'>Firebase console</a>: Project settings → <b>Service accounts</b> → Generate new private key (paste the whole file).
        Project settings → General → your web app gives the <b>API key, App ID, Sender ID</b>. Cloud Messaging → Web Push certificates gives the <b>VAPID key</b>.
      </>
    ),
    fields: [
      { key: 'serviceAccountJson', label: 'Service account JSON', secret: true, type: 'textarea', placeholder: '{ "type": "service_account", "project_id": … }', wide: true },
      { key: 'webApiKey', label: 'Web API key', placeholder: 'AIza…' },
      { key: 'webAppId', label: 'App ID', placeholder: '1:1234:web:abcd' },
      { key: 'messagingSenderId', label: 'Sender ID', placeholder: '1234567890' },
      { key: 'vapidKey', label: 'VAPID key (Web Push certificate)', placeholder: 'B…' },
    ],
  },
}

function WebhookUrl() {
  const url = `${import.meta.env.VITE_BASE_URL}/payments/webhook`
  const [ copied, setCopied ] = useState(false)
  return (
    <div className='flex flex-wrap items-center gap-2 text-sm'>
      <span className='text-xs text-[#898781]'>Webhook URL</span>
      <code className='bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[#f0efec] break-all'>{url}</code>
      <button type='button' className='text-xs underline text-[#c3c2b7] hover:text-white' onClick={() => { navigator.clipboard?.writeText(url); setCopied(true) }}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

const SOURCE_LABEL = { admin: 'Saved here', env: 'From .env file', default: 'Default' }

const Toggle = ({ checked, onChange, label }) => (
  <button
    type='button'
    role='switch'
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-white/20'}`}
  >
    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}></span>
  </button>
)

const IntegrationCard = ({ name, saved, onSaved }) => {
  const { admin } = useContext(AdminDataContext)
  const def = INTEGRATIONS[ name ]
  const initialForm = () => ({
    enabled: saved.enabled.value,
    ...Object.fromEntries(def.fields.map(f => [ f.key, f.secret ? '' : (saved[ f.key ].value ?? '') ])),
  })
  const [ form, setForm ] = useState(initialForm)
  const [ clearSecrets, setClearSecrets ] = useState([])
  const [ testTo, setTestTo ] = useState(name === 'smtp' ? admin.email : '')
  const hasTestTo = name === 'smtp' || name === 'twilio'
  const [ result, setResult ] = useState(null)
  const [ message, setMessage ] = useState({})
  const [ busy, setBusy ] = useState('')

  useEffect(() => { setForm(initialForm()); setClearSecrets([]) }, [ saved ]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm()) || clearSecrets.length > 0
  const set = (key, value) => setForm(f => ({ ...f, [ key ]: value }))

  const save = async (e) => {
    e.preventDefault()
    setBusy('save')
    setMessage({})
    try {
      const response = await adminApi.put(`/settings/integrations/${name}`, { ...form, clearSecrets })
      onSaved(response.data)
      setMessage({ ok: 'Saved. The app uses the new settings within 30 seconds.' })
    } catch (err) {
      setMessage({ error: errorMessage(err) })
    } finally {
      setBusy('')
    }
  }

  const test = async () => {
    setBusy('test')
    setResult(null)
    try {
      const response = await adminApi.post(`/settings/integrations/${name}/test`, { values: form, testTo: hasTestTo ? testTo : undefined })
      setResult(response.data)
    } catch (err) {
      setResult({ ok: false, message: errorMessage(err) })
    } finally {
      setBusy('')
    }
  }

  return (
    <Card>
      <form onSubmit={save} className='space-y-4'>
        <div className='flex items-start gap-3'>
          <span className='h-10 w-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center'><i className={`${def.icon} text-xl`}></i></span>
          <div className='flex-1 min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='font-semibold text-[#f0efec]'>{def.title}</h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${saved.enabled.value ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-[#c3c2b7]'}`}>
                <i className={saved.enabled.value ? 'ri-checkbox-circle-line' : 'ri-pause-circle-line'}></i> {saved.enabled.value ? 'On' : 'Off'}
              </span>
            </div>
            <p className='text-sm text-[#c3c2b7] mt-1'>{def.about}</p>
          </div>
          <Toggle checked={form.enabled} onChange={v => set('enabled', v)} label={`Turn ${def.title} ${form.enabled ? 'off' : 'on'}`} />
        </div>

        {name === 'smtp' && (
          <Select
            label='Provider preset'
            value=''
            onChange={e => {
              const preset = SMTP_PRESETS.find(p => p.value === e.target.value)
              if (preset?.host) setForm(f => ({ ...f, host: preset.host, port: preset.port }))
            }}
            options={SMTP_PRESETS}
            className='max-w-xs'
          />
        )}

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          {def.fields.map(f => {
            const info = saved[ f.key ]
            const removing = clearSecrets.includes(f.key)
            const placeholder = f.secret && info.hasValue && !removing ? `Saved ${info.masked} — leave blank to keep` : f.placeholder
            return (
              <div key={f.key} className={def.fields.length === 1 || f.wide ? 'sm:col-span-2' : ''}>
                {f.type === 'toggle' ? (
                  <div className='flex items-center justify-between gap-3 h-[62px] px-3 rounded-xl bg-white/5 border border-white/10'>
                    <span className='text-sm text-[#f0efec]'>{f.label}</span>
                    <Toggle checked={Boolean(form[ f.key ])} onChange={v => set(f.key, v)} label={f.label} />
                  </div>
                ) : f.type === 'textarea' ? (
                  <label className='flex flex-col gap-1.5 text-sm'>
                    <span className='text-xs font-medium text-[#c3c2b7]'>{f.label}</span>
                    <textarea
                      rows={4}
                      value={form[ f.key ]}
                      onChange={e => set(f.key, e.target.value)}
                      placeholder={placeholder}
                      disabled={removing}
                      spellCheck={false}
                      className='bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-[#898781] focus:outline-none focus:border-emerald-500'
                    />
                  </label>
                ) : (
                  <Input
                    label={f.label}
                    type={f.secret ? 'password' : (f.type || 'text')}
                    value={form[ f.key ]}
                    onChange={e => set(f.key, e.target.value)}
                    placeholder={placeholder}
                    autoComplete={f.secret ? 'new-password' : (f.autoComplete || 'off')}
                    disabled={removing}
                  />
                )}
                <p className='text-xs text-[#898781] mt-1'>
                  {f.hint && <>{f.hint} </>}
                  {info.source !== 'default' && <span className='whitespace-nowrap'>{f.hint ? '· ' : ''}{SOURCE_LABEL[ info.source ]}</span>}
                  {f.secret && info.source === 'admin' && (
                    <button type='button' onClick={() => setClearSecrets(c => removing ? c.filter(k => k !== f.key) : [ ...c, f.key ])} className='ml-2 underline hover:text-white'>
                      {removing ? 'Keep saved value' : 'Remove saved value'}
                    </button>
                  )}
                </p>
              </div>
            )
          })}
        </div>

        {def.extra}
        <p className='text-xs text-[#898781] bg-white/5 rounded-xl px-3 py-2.5'><i className='ri-information-line'></i> {def.help}</p>

        {result && (
          <div role='status' className={`rounded-xl border px-4 py-3 text-sm ${result.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-red-500/30 bg-red-500/10 text-red-100'}`}>
            <p className='flex items-start gap-2'><i className={result.ok ? 'ri-checkbox-circle-line mt-0.5' : 'ri-error-warning-line mt-0.5'}></i> {result.message}</p>
            {result.checks && (
              <ul className='mt-2 space-y-1 pl-6'>
                {result.checks.map(c => (
                  <li key={c.name} className='flex gap-2'>
                    <i className={c.ok ? 'ri-check-line text-emerald-300' : 'ri-close-line text-red-300'}></i>
                    <span><b>{c.name}</b>: {c.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <SuccessBanner>{message.ok}</SuccessBanner>
        <ErrorBanner>{message.error}</ErrorBanner>

        <div className='flex flex-wrap items-end gap-2 pt-1'>
          {hasTestTo && (
            <Input
              label={def.testLabel || 'Send test email to'}
              type={name === 'smtp' ? 'email' : 'tel'}
              placeholder={def.testPlaceholder}
              value={testTo}
              onChange={e => setTestTo(e.target.value)}
              className='flex-1 min-w-[200px] max-w-xs'
            />
          )}
          <div className='flex-1'></div>
          <Button icon='ri-flask-line' onClick={test} disabled={busy !== ''}>{busy === 'test' ? 'Testing…' : 'Test connection'}</Button>
          {isDirty && <Button variant='ghost' onClick={() => { setForm(initialForm()); setClearSecrets([]) }}>Discard</Button>}
          <Button type='submit' variant='primary' icon='ri-save-line' disabled={!isDirty || busy !== ''}>{busy === 'save' ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Card>
  )
}

const Integrations = () => {
  const { data, setData, error } = useAdminData('/settings/integrations')

  return (
    <div className='max-w-4xl'>
      <PageHeader
        title='Integrations'
        subtitle='Maps, email, payments, SMS/WhatsApp and push. Keys and passwords are stored encrypted and are never shown again after saving.'
        actions={(
          <nav className='flex flex-wrap gap-1 text-xs' aria-label='Jump to integration'>
            {Object.entries(INTEGRATIONS).map(([ key, def ]) => (
              <a key={key} href={`#integration-${key}`} className='px-2.5 h-8 inline-flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 text-[#c3c2b7] hover:text-white'>
                <i className={def.icon}></i> {def.title.split(' ')[ 0 ]}
              </a>
            ))}
          </nav>
        )}
      />
      <ErrorBanner>{error}</ErrorBanner>
      {!data ? (!error && <Spinner />) : (
        <div className='space-y-4'>
          {Object.keys(INTEGRATIONS).map(name => (
            <div key={name} id={`integration-${name}`} className='scroll-mt-20'>
              <IntegrationCard name={name} saved={data[ name ]} onSaved={setData} />
            </div>
          ))}
          <p className='text-xs text-[#898781]'>
            The rider map preview uses Google’s free embed and needs no key. Database and login-token settings stay in <code>Backend/.env</code> because the app needs them before it can read anything from the database.
          </p>
        </div>
      )}
    </div>
  )
}

export default Integrations
