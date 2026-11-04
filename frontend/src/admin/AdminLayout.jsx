import React, { useContext, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import adminApi, { TOKEN_KEY } from './api'
import { AdminDataContext } from './AdminProtectWrapper'

const MENU = [
  {
    section: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: 'ri-dashboard-line', end: true },
      { to: '/admin/live', label: 'Live monitor', icon: 'ri-radar-line' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { to: '/admin/rides', label: 'Rides', icon: 'ri-route-line' },
      { to: '/admin/captains', label: 'Captains', icon: 'ri-steering-2-line' },
      { to: '/admin/riders', label: 'Riders', icon: 'ri-user-3-line' },
    ],
  },
  {
    section: 'Business',
    items: [
      { to: '/admin/reports', label: 'Reports', icon: 'ri-file-chart-line' },
      { to: '/admin/fares', label: 'Fare settings', icon: 'ri-money-rupee-circle-line' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { to: '/admin/integrations', label: 'Integrations', icon: 'ri-plug-line' },
      { to: '/admin/notifications', label: 'Notifications', icon: 'ri-notification-3-line' },
      { to: '/admin/admins', label: 'Admin users', icon: 'ri-shield-user-line' },
      { to: '/admin/account', label: 'My account', icon: 'ri-user-settings-line' },
    ],
  },
]

const Sidebar = ({ admin, onNavigate, onLogout }) => (
  <div className='flex flex-col h-full'>
    <div className='flex items-center gap-3 px-5 h-16 border-b border-white/10 shrink-0'>
      <span className='h-9 w-9 shrink-0 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center'>
        <i className='ri-shield-user-fill text-lg text-white'></i>
      </span>
      <div className='min-w-0'>
        <p className='font-bold leading-tight text-white'>Khushi Transport</p>
        <p className='text-xs text-[#898781]'>Admin panel</p>
      </div>
    </div>

    <nav className='flex-1 overflow-y-auto px-3 py-4 space-y-5' aria-label='Admin'>
      {MENU.map(group => (
        <div key={group.section}>
          <p className='px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#898781]'>{group.section}</p>
          <ul className='space-y-0.5'>
            {group.items.map(item => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-[#c3c2b7] hover:text-white hover:bg-white/5'}`}
                >
                  {({ isActive }) => (
                    <>
                      <i className={`${item.icon} text-lg ${isActive ? 'text-emerald-400' : ''}`}></i>
                      {item.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>

    <div className='border-t border-white/10 p-3 shrink-0'>
      <div className='flex items-center gap-3 px-2 py-2'>
        <span className='h-8 w-8 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white'>
          {(admin.fullname || admin.email).charAt(0).toUpperCase()}
        </span>
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-medium text-white truncate'>{admin.fullname}</p>
          <p className='text-xs text-[#898781] truncate'>{admin.email}</p>
        </div>
        <button onClick={onLogout} className='p-2 rounded-lg text-[#c3c2b7] hover:text-white hover:bg-white/10' aria-label='Log out' title='Log out'>
          <i className='ri-logout-box-r-line text-lg'></i>
        </button>
      </div>
    </div>
  </div>
)

const AdminLayout = () => {
  const { admin } = useContext(AdminDataContext)
  const navigate = useNavigate()
  const location = useLocation()
  const [ menuOpen, setMenuOpen ] = useState(false)

  useEffect(() => { setMenuOpen(false) }, [ location.pathname ])

  const logout = async () => {
    try {
      await adminApi.get('/logout')
    } catch (err) {
      console.error('Admin logout error:', err)
    }
    localStorage.removeItem(TOKEN_KEY)
    navigate('/admin/login')
  }

  return (
    <div className='min-h-screen bg-[#0d0d0d] text-[#f0efec] font-sans'>
      {/* desktop sidebar */}
      <aside className='hidden lg:block fixed inset-y-0 left-0 w-64 bg-[#141413] border-r border-white/10'>
        <Sidebar admin={admin} onLogout={logout} />
      </aside>

      {/* mobile drawer */}
      {menuOpen && (
        <div className='lg:hidden fixed inset-0 z-40' role='dialog' aria-modal='true'>
          <div className='absolute inset-0 bg-black/70' onClick={() => setMenuOpen(false)}></div>
          <aside className='absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[#141413] border-r border-white/10'>
            <Sidebar admin={admin} onNavigate={() => setMenuOpen(false)} onLogout={logout} />
          </aside>
        </div>
      )}

      <div className='lg:pl-64'>
        <header className='lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-[#141413]/95 backdrop-blur border-b border-white/10'>
          <button onClick={() => setMenuOpen(true)} className='p-2 -ml-2 rounded-lg hover:bg-white/10' aria-label='Open menu'>
            <i className='ri-menu-line text-xl'></i>
          </button>
          <p className='font-semibold'>Admin panel</p>
        </header>

        <main className='max-w-7xl mx-auto px-4 sm:px-6 py-6'>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
