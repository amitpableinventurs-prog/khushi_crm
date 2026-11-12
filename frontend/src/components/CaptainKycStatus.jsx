import { useCallback, useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { CaptainDataContext } from '../context/CapatainContext'

const CaptainKycStatus = () => {
  const { captain, setCaptain } = useContext(CaptainDataContext)
  const [licenseFile, setLicenseFile] = useState(null)
  const [identityFile, setIdentityFile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const status = captain?.kyc?.status || 'pending'
  const needsDocuments = status === 'rejected' || !captain?.kyc?.documentsSubmitted

  const refreshStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_BASE_URL}/captains/profile`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setCaptain(response.data.captain)
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || 'Could not refresh KYC status.')
    }
  }, [setCaptain])

  useEffect(() => {
    const interval = setInterval(refreshStatus, 30000)
    return () => clearInterval(interval)
  }, [refreshStatus])

  const submitHandler = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    setNotice('')
    try {
      const formData = new FormData()
      formData.append('license', licenseFile)
      formData.append('identity', identityFile)
      const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/captains/kyc`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setCaptain(response.data.captain)
      setNotice(response.data.message)
      setLicenseFile(null)
      setIdentityFile(null)
      event.target.reset()
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit KYC documents.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className='max-w-xl mx-auto mt-20 rounded-3xl border border-yellow-500/30 bg-black/80 p-6 text-white shadow-2xl'>
      <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400/15 text-yellow-300'>
        <i className='ri-shield-user-line text-2xl'></i>
      </div>
      <h1 className='mt-4 text-2xl font-bold'>Driver KYC verification</h1>
      <p className='mt-2 text-sm text-gray-300'>
        {needsDocuments
          ? status === 'rejected'
            ? 'Your documents need an update. Upload both documents again to request a new review.'
            : 'Upload your driving licence and government ID to request KYC verification.'
          : 'Your documents are with our admin team for review. Ride requests will be enabled after approval.'}
      </p>
      <p className='mt-4 inline-flex rounded-full bg-yellow-400/15 px-3 py-1 text-sm font-semibold capitalize text-yellow-200'>
        Status: {status}
      </p>
      {captain?.kyc?.reviewNote && (
        <p className='mt-3 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200'>
          Review note: {captain.kyc.reviewNote}
        </p>
      )}

      {needsDocuments && (
        <form onSubmit={submitHandler} className='mt-5 space-y-4'>
          <label className='block text-sm text-gray-300'>
            Updated driving licence
            <input required type='file' accept='.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
              onChange={event => setLicenseFile(event.target.files?.[0] || null)}
              className='mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white' />
          </label>
          <label className='block text-sm text-gray-300'>
            Updated government ID
            <input required type='file' accept='.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
              onChange={event => setIdentityFile(event.target.files?.[0] || null)}
              className='mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white' />
          </label>
          <button disabled={isLoading} className='w-full rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black disabled:opacity-60'>
            {isLoading ? 'Submitting…' : status === 'rejected' ? 'Resubmit documents' : 'Submit documents'}
          </button>
        </form>
      )}

      {error && <p role='alert' className='mt-4 text-sm text-red-300'>{error}</p>}
      {notice && <p role='status' className='mt-4 text-sm text-green-300'>{notice}</p>}
      {!needsDocuments && (
        <button onClick={refreshStatus} className='mt-5 text-sm font-semibold text-yellow-300 hover:underline'>
          Refresh verification status
        </button>
      )}
    </section>
  )
}

export default CaptainKycStatus
