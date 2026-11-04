import axios from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'

export const TOKEN_KEY = 'adminToken'

// Axios instance for /admin; attaches the admin token and sends expired sessions back to login
const adminApi = axios.create({ baseURL: `${import.meta.env.VITE_BASE_URL}/admin` })

adminApi.interceptors.request.use(config => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

adminApi.interceptors.response.use(
  response => response,
  error => {
    const isLogin = error.config?.url === '/login'
    if (error.response?.status === 401 && !isLogin) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.assign('/admin/login')
    }
    return Promise.reject(error)
  }
)

export default adminApi

export const errorMessage = (err, fallback = 'Something went wrong. Please try again.') =>
  err?.response?.data?.message || err?.response?.data?.errors?.[ 0 ]?.msg || fallback

// Drops empty values so they don't end up as `?status=` in the URL
export const cleanParams = (params) =>
  Object.fromEntries(Object.entries(params || {}).filter(([ , v ]) => v !== '' && v !== undefined && v !== null))

// GET `path` with `params`; keeps the previous data while reloading so the page doesn't jump
export function useAdminData(path, params, { refreshMs } = {}) {
  const [ data, setData ] = useState(null)
  const [ error, setError ] = useState('')
  const [ isLoading, setIsLoading ] = useState(true)
  const paramsKey = JSON.stringify(cleanParams(params))
  const requestId = useRef(0)

  const reload = useCallback(async () => {
    const id = ++requestId.current
    setIsLoading(true)
    try {
      const response = await adminApi.get(path, { params: JSON.parse(paramsKey) })
      if (id === requestId.current) {
        setData(response.data)
        setError('')
      }
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err, 'Could not load data. Please try again.'))
    } finally {
      if (id === requestId.current) setIsLoading(false)
    }
  }, [ path, paramsKey ])

  useEffect(() => {
    reload()
    if (!refreshMs) return
    const timer = setInterval(reload, refreshMs)
    return () => clearInterval(timer)
  }, [ reload, refreshMs ])

  return { data, setData, error, isLoading, reload }
}

export async function downloadFile(path, params, filename) {
  const response = await adminApi.get(path, { params: cleanParams(params), responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
