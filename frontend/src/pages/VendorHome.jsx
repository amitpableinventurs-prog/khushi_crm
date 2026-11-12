import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { VEHICLES, VEHICLE_BY_KEY, formatCapacity } from '../vehicles'

const VendorHome = () => {
  const [vendor, setVendor] = useState(null)
  const [form, setForm] = useState({ color: '', plate: '', capacity: '', vehicleType: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_BASE_URL}/vendors/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => setVendor(response.data.vendor))
      .catch(err => setError(err.response?.data?.message || 'Could not load vendor profile.'))
  }, [token])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)
    try {
      const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/vendors/vehicles`, {
        ...form, capacity: Number(form.capacity)
      }, { headers: { Authorization: `Bearer ${token}` } })
      setVendor(current => ({ ...current, vehicles: response.data.vehicles }))
      setForm({ color: '', plate: '', capacity: '', vehicleType: '' })
      setNotice('Vehicle added to your fleet.')
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Could not add vehicle.')
    } finally {
      setIsSaving(false)
    }
  }

  const logout = async () => {
    try {
      await axios.get(`${import.meta.env.VITE_BASE_URL}/vendors/logout`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch (err) {
      console.error('Vendor logout error:', err)
    }
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    navigate('/vendor-login')
  }

  return (
    <main className='min-h-screen bg-slate-950 px-4 py-8 text-white'>
      <div className='mx-auto max-w-5xl'>
        <header className='mb-8 flex flex-wrap items-center justify-between gap-4'>
          <div>
            <p className='text-sm text-yellow-300'>Vendor fleet portal</p>
            <h1 className='text-3xl font-black'>{vendor?.businessName || 'Your fleet'}</h1>
          </div>
          <button onClick={logout} className='rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/10'>Sign out</button>
        </header>

        <div className='grid gap-6 lg:grid-cols-[1fr_1.2fr]'>
          <form onSubmit={submit} className='space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5'>
            <h2 className='text-xl font-bold'>Add a vehicle</h2>
            <input required minLength={3} maxLength={50} className='w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3' placeholder='Vehicle color' value={form.color} onChange={event => setForm({ ...form, color: event.target.value })} />
            <input required minLength={3} maxLength={20} className='w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 uppercase' placeholder='Number plate' value={form.plate} onChange={event => setForm({ ...form, plate: event.target.value })} />
            <select required className='w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3' value={form.vehicleType} onChange={event => {
              const vehicleType = event.target.value
              setForm({ ...form, vehicleType, capacity: String(VEHICLE_BY_KEY[vehicleType]?.capacityKg || '') })
            }}>
              <option value='' disabled>Select vehicle type</option>
              {VEHICLES.map(vehicle => <option key={vehicle.key} value={vehicle.key}>{vehicle.label}</option>)}
            </select>
            <label className='block text-sm text-gray-300'>Load capacity (kg)
              <input required type='number' min='1' max='50000' className='mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3' value={form.capacity} onChange={event => setForm({ ...form, capacity: event.target.value })} />
            </label>
            {error && <p role='alert' className='text-sm text-red-300'>{error}</p>}
            {notice && <p role='status' className='text-sm text-green-300'>{notice}</p>}
            <button disabled={isSaving} className='w-full rounded-xl bg-yellow-400 py-3 font-bold text-black disabled:opacity-60'>
              {isSaving ? 'Adding…' : 'Add vehicle'}
            </button>
          </form>

          <section className='rounded-2xl border border-white/10 bg-white/5 p-5'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-xl font-bold'>Your vehicles</h2>
              <span className='rounded-full bg-white/10 px-3 py-1 text-sm'>{vendor?.vehicles?.length || 0}</span>
            </div>
            {!vendor ? <p className='text-sm text-gray-400'>Loading fleet…</p> : vendor.vehicles.length === 0 ? (
              <p className='rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-gray-400'>No vehicles added yet.</p>
            ) : (
              <ul className='space-y-3'>
                {vendor.vehicles.map(vehicle => (
                  <li key={vehicle._id} className='flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-4'>
                    <div>
                      <p className='font-semibold'>{vehicle.plate} <span className='text-sm font-normal text-gray-400'>· {vehicle.color}</span></p>
                      <p className='text-sm text-gray-400'>{VEHICLE_BY_KEY[vehicle.vehicleType]?.label || vehicle.vehicleType}</p>
                    </div>
                    <span className='whitespace-nowrap text-sm text-yellow-200'>{formatCapacity(vehicle.capacity)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

export default VendorHome
