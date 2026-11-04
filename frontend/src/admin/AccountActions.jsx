import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import adminApi, { errorMessage } from './api'
import { Button, ErrorBanner, Modal } from './ui'

/**
 * Block/unblock and delete for a rider or captain.
 * `kind` is 'captains' or 'users' (the API path), `noun` is shown to the admin.
 */
const AccountActions = ({ kind, noun, person, onChange, listPath }) => {
  const navigate = useNavigate()
  const [ confirm, setConfirm ] = useState(null)
  const [ error, setError ] = useState('')
  const [ isSaving, setIsSaving ] = useState(false)

  const run = async () => {
    setIsSaving(true)
    setError('')
    try {
      if (confirm === 'delete') {
        await adminApi.delete(`/${kind}/${person._id}`)
        navigate(listPath, { replace: true })
        return
      }
      const response = await adminApi.patch(`/${kind}/${person._id}/block`, { blocked: !person.isBlocked })
      onChange(response.data, person.isBlocked ? `${noun} unblocked.` : `${noun} blocked. They have been signed out and can no longer log in.`)
      setConfirm(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const copy = {
    block: {
      title: `Block this ${noun.toLowerCase()}?`,
      body: kind === 'captains'
        ? 'They will be signed out, set offline, stop receiving ride requests and won’t be able to log in until you unblock them.'
        : 'They will be signed out and won’t be able to log in or book rides until you unblock them.',
      action: 'Block',
    },
    unblock: { title: `Unblock this ${noun.toLowerCase()}?`, body: 'They will be able to log in again.', action: 'Unblock' },
    delete: {
      title: `Delete this ${noun.toLowerCase()}?`,
      body: 'The account is removed permanently. Their past rides stay in ride history. This can’t be undone.',
      action: 'Delete permanently',
    },
  }[ confirm ]

  return (
    <>
      <Button
        icon={person.isBlocked ? 'ri-lock-unlock-line' : 'ri-forbid-line'}
        onClick={() => { setError(''); setConfirm(person.isBlocked ? 'unblock' : 'block') }}
      >
        {person.isBlocked ? 'Unblock' : 'Block'}
      </Button>
      <Button variant='danger' icon='ri-delete-bin-line' onClick={() => { setError(''); setConfirm('delete') }}>Delete</Button>

      {confirm && (
        <Modal
          title={copy.title}
          onClose={() => setConfirm(null)}
          footer={(
            <>
              <Button variant='ghost' onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant={confirm === 'unblock' ? 'primary' : 'danger'} onClick={run} disabled={isSaving}>
                {isSaving ? 'Please wait…' : copy.action}
              </Button>
            </>
          )}
        >
          <ErrorBanner>{error}</ErrorBanner>
          <p className='text-sm text-[#c3c2b7]'>{copy.body}</p>
        </Modal>
      )}
    </>
  )
}

export default AccountActions
