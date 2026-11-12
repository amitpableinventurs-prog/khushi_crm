import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'

const VendorLogin = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/vendors/login`, { email, password })
      localStorage.setItem('token', response.data.token)
      localStorage.setItem('role', 'vendor')
      navigate('/vendor-home')
    } catch (err) {
      setError(err.response?.data?.message || 'Vendor sign in failed.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className='min-h-screen bg-black px-4 py-12 text-white'>
      <form onSubmit={submit} className='mx-auto mt-16 max-w-md space-y-4 rounded-3xl border border-yellow-500/20 bg-white/5 p-7 shadow-2xl'>
        <h1 className='text-center text-3xl font-black'>Vendor sign in</h1>
        <input required type='email' className='w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white' placeholder='Business email' value={email} onChange={event => setEmail(event.target.value)} />
        <input required type='password' className='w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white' placeholder='Password' value={password} onChange={event => setPassword(event.target.value)} />
        {error && <p role='alert' className='text-center text-sm text-red-300'>{error}</p>}
        <button disabled={isLoading} className='w-full rounded-xl bg-yellow-400 py-3 font-bold text-black disabled:opacity-60'>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className='text-center text-sm text-gray-400'>New to Khushi Transport? <Link to='/vendor-register' className='text-yellow-300 hover:underline'>Register your fleet</Link></p>
      </form>
    </main>
  )
}

export default VendorLogin
