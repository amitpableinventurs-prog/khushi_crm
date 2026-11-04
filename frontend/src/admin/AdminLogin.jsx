import React, { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import adminApi, { TOKEN_KEY, errorMessage } from './api'

const AdminLogin = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()

  if (localStorage.getItem(TOKEN_KEY)) {
    return <Navigate to='/admin' replace />
  }

  const submitHandler = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await adminApi.post('/login', { email, password })
      localStorage.setItem(TOKEN_KEY, response.data.token)
      navigate('/admin')
    } catch (err) {
      setError(errorMessage(err, 'Invalid email or password. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-black text-white font-sans p-6'>
      <div className='w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl'>
        <div className='text-center mb-8'>
          <span className='h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 inline-flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/30'>
            <i className="ri-shield-user-fill text-2xl text-white"></i>
          </span>
          <h2 className='text-3xl font-black tracking-tight'>Admin Sign In</h2>
          <p className='text-gray-400 text-sm mt-1'>Manage riders, captains, rides and fares.</p>
        </div>

        <form onSubmit={submitHandler} className='space-y-5'>
          <div>
            <label htmlFor='admin-email' className='block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2'>Email Address</label>
            <input
              id='admin-email'
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className='bg-white/10 border border-white/10 rounded-2xl px-4 py-3.5 w-full text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors'
              type='email'
              autoComplete='username'
              placeholder='admin@example.com'
            />
          </div>

          <div>
            <label htmlFor='admin-password' className='block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2'>Password</label>
            <input
              id='admin-password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='bg-white/10 border border-white/10 rounded-2xl px-4 py-3.5 w-full text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors'
              type='password'
              autoComplete='current-password'
              placeholder='••••••••'
            />
          </div>

          {error && <p role='alert' className='text-red-400 text-xs text-center font-medium'>{error}</p>}

          <button
            type='submit'
            disabled={isLoading}
            className='w-full bg-white text-black font-bold py-4 rounded-2xl text-base hover:bg-gray-100 transition-all duration-300 shadow-xl disabled:opacity-60'
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className='mt-6 text-center text-sm'>
          <Link to='/' className='text-gray-400 hover:text-white transition-colors'>← Back to site</Link>
        </div>
      </div>
    </div>
  )
}

export default AdminLogin
