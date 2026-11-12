import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const VendorProtectWrapper = ({ children }) => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || localStorage.getItem('role') !== 'vendor') {
      navigate('/vendor-login', { replace: true })
      return
    }

    axios.get(`${import.meta.env.VITE_BASE_URL}/vendors/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(() => setIsLoading(false)).catch(() => {
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      navigate('/vendor-login', { replace: true })
    })
  }, [navigate])

  if (isLoading) {
    return <div className='min-h-screen flex items-center justify-center bg-slate-950 text-white'>Checking vendor session…</div>
  }
  return children
}

export default VendorProtectWrapper
