import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'

const VendorSignup = () => {
  const [form, setForm] = useState({
    firstname: '', lastname: '', businessName: '', email: '', phone: '', password: ''
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/vendors/register`, {
        fullname: { firstname: form.firstname, lastname: form.lastname },
        businessName: form.businessName,
        email: form.email,
        phone: form.phone,
        password: form.password,
      })
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('role', 'vendor')
      navigate('/vendor-home')
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Vendor registration failed.')
    } finally {
      setIsLoading(false)
    }
  }

  const fieldClass = 'w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none'
  return (
    <main className='min-h-screen bg-black px-4 py-12 text-white'>
      <form onSubmit={submit} className='mx-auto mt-8 max-w-lg space-y-4 rounded-3xl border border-yellow-500/20 bg-white/5 p-7 shadow-2xl'>
        <h1 className='text-center text-3xl font-black'>Vendor registration</h1>
        <p className='text-center text-sm text-gray-400'>Create a fleet account and add multiple vehicles.</p>
        <div className='grid grid-cols-2 gap-3'>
          <input required minLength={3} className={fieldClass} placeholder='First name' value={form.firstname} onChange={update('firstname')} />
          <input minLength={3} className={fieldClass} placeholder='Last name (optional)' value={form.lastname} onChange={update('lastname')} />
        </div>
        <input required minLength={2} className={fieldClass} placeholder='Business / fleet name' value={form.businessName} onChange={update('businessName')} />
        <input required type='email' className={fieldClass} placeholder='Business email' value={form.email} onChange={update('email')} />
        <input required type='tel' pattern='[+0-9 -]{10,16}' className={fieldClass} placeholder='Phone number' value={form.phone} onChange={update('phone')} />
        <input required minLength={8} type='password' className={fieldClass} placeholder='Password (at least 8 characters)' value={form.password} onChange={update('password')} />
        {error && <p role='alert' className='text-center text-sm text-red-300'>{error}</p>}
        <button disabled={isLoading} className='w-full rounded-xl bg-yellow-400 py-3 font-bold text-black disabled:opacity-60'>
          {isLoading ? 'Creating account…' : 'Register vendor'}
        </button>
        <p className='text-center text-sm text-gray-400'>Already registered? <Link to='/vendor-login' className='text-yellow-300 hover:underline'>Vendor sign in</Link></p>
      </form>
    </main>
  )
}

export default VendorSignup
