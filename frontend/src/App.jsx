import React, { useContext, useEffect } from 'react'
import { Route, Routes, Navigate, useNavigate } from 'react-router-dom'
import Start from './pages/Start'
import UserLogin from './pages/UserLogin'
import UserSignup from './pages/UserSignup'
import Captainlogin from './pages/Captainlogin'
import CaptainSignup from './pages/CaptainSignup'
import Home from './pages/Home'
import UserProtectWrapper from './pages/UserProtectWrapper'
import UserLogout from './pages/UserLogout'
import CaptainHome from './pages/CaptainHome'
import CaptainProtectWrapper from './pages/CaptainProtectWrapper'
import CaptainLogout from './pages/CaptainLogout'
import Riding from './pages/Riding'
import CaptainRiding from './pages/CaptainRiding'
import Profile from './pages/Profile'
import ForgotPassword from './pages/ForgotPassword'
import AdminLogin from './admin/AdminLogin'
import AdminProtectWrapper from './admin/AdminProtectWrapper'
import AdminLayout from './admin/AdminLayout'
import AdminDashboard from './admin/pages/Dashboard'
import AdminLive from './admin/pages/Live'
import AdminRides from './admin/pages/Rides'
import AdminRideDetail from './admin/pages/RideDetail'
import AdminCaptains from './admin/pages/Captains'
import AdminCaptainDetail from './admin/pages/CaptainDetail'
import AdminRiders from './admin/pages/Riders'
import AdminRiderDetail from './admin/pages/RiderDetail'
import AdminReports from './admin/pages/Reports'
import AdminFareSettings from './admin/pages/FareSettings'
import AdminAdmins from './admin/pages/Admins'
import AdminAccount from './admin/pages/Account'
import AdminIntegrations from './admin/pages/Integrations'
import AdminNotifications from './admin/pages/Notifications'
import 'remixicon/fonts/remixicon.css'

// Redirects already-logged-in users away from auth pages
const AuthGuard = ({ children }) => {
  const token = localStorage.getItem('token')
  const role = localStorage.getItem('role')
  if (token) {
    return <Navigate to={role === 'captain' ? '/captain-home' : '/home'} replace />
  }
  return children
}

const CaptainAuthGuard = ({ children }) => {
  const token = localStorage.getItem('token')
  const role = localStorage.getItem('role')
  if (token) {
    return <Navigate to={role === 'captain' ? '/captain-home' : '/home'} replace />
  }
  return children
}

const App = () => {
  return (
    <div>
      <Routes>
        <Route path='/' element={<Start />} />

        {/* Auth routes with reverse guard */}
        <Route path='/login' element={<AuthGuard><UserLogin /></AuthGuard>} />
        <Route path='/signup' element={<AuthGuard><UserSignup /></AuthGuard>} />
        <Route path='/captain-login' element={<CaptainAuthGuard><Captainlogin /></CaptainAuthGuard>} />
        <Route path='/captain-signup' element={<CaptainAuthGuard><CaptainSignup /></CaptainAuthGuard>} />
        <Route path='/forgot-password' element={<ForgotPassword />} />

        {/* Riding pages — protected with user & captain auth wrappers */}
        <Route path='/riding' element={
          <UserProtectWrapper>
            <Riding />
          </UserProtectWrapper>
        } />
        <Route path='/captain-riding' element={
          <CaptainProtectWrapper>
            <CaptainRiding />
          </CaptainProtectWrapper>
        } />

        <Route path='/profile' element={
          <UserProtectWrapper>
            <Profile />
          </UserProtectWrapper>
        } />
        <Route path='/captain-profile' element={
          <CaptainProtectWrapper>
            <Profile />
          </CaptainProtectWrapper>
        } />

        {/* Protected user routes */}
        <Route path='/home' element={
          <UserProtectWrapper>
            <Home />
          </UserProtectWrapper>
        } />
        <Route path='/user/logout' element={
          <UserProtectWrapper>
            <UserLogout />
          </UserProtectWrapper>
        } />

        {/* Protected captain routes */}
        <Route path='/captain-home' element={
          <CaptainProtectWrapper>
            <CaptainHome />
          </CaptainProtectWrapper>
        } />
        <Route path='/captain/logout' element={
          <CaptainProtectWrapper>
            <CaptainLogout />
          </CaptainProtectWrapper>
        } />

        {/* Admin panel — uses its own token (adminToken), separate from rider/captain sessions */}
        <Route path='/admin/login' element={<AdminLogin />} />
        <Route path='/admin' element={
          <AdminProtectWrapper>
            <AdminLayout />
          </AdminProtectWrapper>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path='live' element={<AdminLive />} />
          <Route path='rides' element={<AdminRides />} />
          <Route path='rides/:id' element={<AdminRideDetail />} />
          <Route path='captains' element={<AdminCaptains />} />
          <Route path='captains/:id' element={<AdminCaptainDetail />} />
          <Route path='riders' element={<AdminRiders />} />
          <Route path='riders/:id' element={<AdminRiderDetail />} />
          <Route path='reports' element={<AdminReports />} />
          <Route path='fares' element={<AdminFareSettings />} />
          <Route path='integrations' element={<AdminIntegrations />} />
          <Route path='notifications' element={<AdminNotifications />} />
          <Route path='admins' element={<AdminAdmins />} />
          <Route path='account' element={<AdminAccount />} />
          <Route path='*' element={<Navigate to='/admin' replace />} />
        </Route>
      </Routes>
    </div>
  )
}

export default App