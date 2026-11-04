import React, { useContext, useState } from 'react'
import adminApi, { errorMessage, useAdminData } from '../api'
import { AdminDataContext } from '../AdminProtectWrapper'
import { Button, Card, ErrorBanner, Input, Modal, PageHeader, PersonCell, Spinner, SuccessBanner, Table, Td } from '../ui'

const AddAdmin = ({ onClose, onAdded }) => {
  const [ form, setForm ] = useState({ fullname: '', email: '', password: '' })
  const [ error, setError ] = useState('')
  const [ isSaving, setIsSaving ] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [ key ]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      const response = await adminApi.post('/admins', form)
      onAdded(response.data)
    } catch (err) {
      setError(errorMessage(err))
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title='Add admin'
      onClose={onClose}
      footer={(
        <>
          <Button variant='ghost' onClick={onClose}>Cancel</Button>
          <Button variant='primary' type='submit' form='add-admin' disabled={isSaving}>{isSaving ? 'Adding…' : 'Add admin'}</Button>
        </>
      )}
    >
      <ErrorBanner>{error}</ErrorBanner>
      <form id='add-admin' onSubmit={save} className='space-y-3'>
        <Input label='Full name' required minLength={2} value={form.fullname} onChange={set('fullname')} />
        <Input label='Email' type='email' required value={form.email} onChange={set('email')} autoComplete='off' />
        <Input label='Password (min 8 characters)' type='password' required minLength={8} value={form.password} onChange={set('password')} autoComplete='new-password' />
        <p className='text-xs text-[#898781]'>Share the password with them privately. They can change it under My account.</p>
      </form>
    </Modal>
  )
}

const Admins = () => {
  const { admin: me } = useContext(AdminDataContext)
  const { data, setData, error } = useAdminData('/admins')
  const [ adding, setAdding ] = useState(false)
  const [ removing, setRemoving ] = useState(null)
  const [ actionError, setActionError ] = useState('')
  const [ notice, setNotice ] = useState('')

  const remove = async () => {
    setActionError('')
    try {
      await adminApi.delete(`/admins/${removing._id}`)
      setData(data.filter(a => a._id !== removing._id))
      setNotice(`${removing.email} no longer has admin access.`)
      setRemoving(null)
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  return (
    <div>
      <PageHeader
        title='Admin users'
        subtitle='Everyone here has full access to this panel'
        actions={<Button variant='primary' icon='ri-user-add-line' onClick={() => setAdding(true)}>Add admin</Button>}
      />
      <SuccessBanner>{notice}</SuccessBanner>
      <ErrorBanner>{error}</ErrorBanner>

      <Card padded={false}>
        {!data ? <Spinner /> : (
          <Table
            columns={[ 'Admin', '' ]}
            items={data}
            minWidth={360}
            empty='No admins.'
            renderCells={a => (
              <>
                <Td><PersonCell name={<>{a.fullname} {a._id === me._id && <span className='text-xs text-emerald-300 font-normal'>(you)</span>}</>} sub={a.email} /></Td>
                <Td className='text-right'>
                  {a._id !== me._id && <Button variant='ghost' icon='ri-delete-bin-line' onClick={() => { setActionError(''); setRemoving(a) }}>Remove</Button>}
                </Td>
              </>
            )}
          />
        )}
      </Card>

      {adding && <AddAdmin onClose={() => setAdding(false)} onAdded={(a) => { setData([ ...data, a ]); setAdding(false); setNotice(`${a.email} added as admin.`) }} />}

      {removing && (
        <Modal
          title='Remove admin access?'
          onClose={() => setRemoving(null)}
          footer={(
            <>
              <Button variant='ghost' onClick={() => setRemoving(null)}>Cancel</Button>
              <Button variant='danger' onClick={remove}>Remove</Button>
            </>
          )}
        >
          <ErrorBanner>{actionError}</ErrorBanner>
          <p className='text-sm text-[#c3c2b7]'><span className='text-white'>{removing.email}</span> will lose access to the admin panel.</p>
        </Modal>
      )}
    </div>
  )
}

export default Admins
