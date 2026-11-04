import React, { useContext, useState } from 'react'
import adminApi, { errorMessage } from '../api'
import { AdminDataContext } from '../AdminProtectWrapper'
import { Button, Card, ErrorBanner, Input, PageHeader, SuccessBanner } from '../ui'

const Account = () => {
  const { admin, setAdmin } = useContext(AdminDataContext)
  const [ name, setName ] = useState(admin.fullname)
  const [ nameMsg, setNameMsg ] = useState({})
  const [ passwords, setPasswords ] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [ passMsg, setPassMsg ] = useState({})

  const saveName = async (e) => {
    e.preventDefault()
    try {
      const response = await adminApi.patch('/profile', { fullname: name })
      setAdmin(response.data)
      setNameMsg({ ok: 'Name updated.' })
    } catch (err) {
      setNameMsg({ error: errorMessage(err) })
    }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    if (passwords.newPassword !== passwords.confirm) {
      setPassMsg({ error: 'New passwords do not match.' })
      return
    }
    try {
      await adminApi.patch('/password', { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword })
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' })
      setPassMsg({ ok: 'Password changed. Use the new password next time you sign in.' })
    } catch (err) {
      setPassMsg({ error: errorMessage(err) })
    }
  }

  const setPw = (key) => (e) => setPasswords({ ...passwords, [ key ]: e.target.value })

  return (
    <div className='max-w-2xl'>
      <PageHeader title='My account' subtitle={admin.email} />

      <Card title='Profile' className='mb-4'>
        <SuccessBanner>{nameMsg.ok}</SuccessBanner>
        <ErrorBanner>{nameMsg.error}</ErrorBanner>
        <form onSubmit={saveName} className='flex flex-wrap items-end gap-3'>
          <Input label='Full name' required minLength={2} value={name} onChange={e => setName(e.target.value)} className='flex-1 min-w-[200px]' />
          <Button type='submit' variant='primary' disabled={name.trim() === admin.fullname}>Save</Button>
        </form>
      </Card>

      <Card title='Change password'>
        <SuccessBanner>{passMsg.ok}</SuccessBanner>
        <ErrorBanner>{passMsg.error}</ErrorBanner>
        <form onSubmit={savePassword} className='space-y-3'>
          <Input label='Current password' type='password' required autoComplete='current-password' value={passwords.currentPassword} onChange={setPw('currentPassword')} />
          <Input label='New password (min 8 characters)' type='password' required minLength={8} autoComplete='new-password' value={passwords.newPassword} onChange={setPw('newPassword')} />
          <Input label='Confirm new password' type='password' required minLength={8} autoComplete='new-password' value={passwords.confirm} onChange={setPw('confirm')} />
          <Button type='submit' variant='primary' icon='ri-lock-password-line'>Change password</Button>
        </form>
      </Card>
    </div>
  )
}

export default Account
