import React, { createContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import adminApi, { TOKEN_KEY } from './api'

export const AdminDataContext = createContext({ admin: null, setAdmin: () => {} })

const AdminProtectWrapper = ({ children }) => {
    const token = localStorage.getItem(TOKEN_KEY)
    const navigate = useNavigate()
    const [ admin, setAdmin ] = useState(null)

    useEffect(() => {
        if (!token) {
            navigate('/admin/login')
            return
        }

        adminApi.get('/profile')
            .then(response => setAdmin(response.data))
            .catch(err => {
                console.error('Admin auth error:', err)
                localStorage.removeItem(TOKEN_KEY)
                navigate('/admin/login')
            })
    }, [ token, navigate ])

    if (!admin) {
        return (
            <div className='h-screen flex flex-col items-center justify-center bg-[#0d0d0d] text-white'>
                <div className='w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4'></div>
                <p className='text-white/60 text-sm'>Verifying session...</p>
            </div>
        )
    }

    return (
        <AdminDataContext.Provider value={{ admin, setAdmin }}>
            {children}
        </AdminDataContext.Provider>
    )
}

export default AdminProtectWrapper
