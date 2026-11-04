import React, { useEffect, useState } from 'react'
import axios from 'axios'

// Bell button that subscribes this browser to ride notifications (Firebase Cloud Messaging).
// Shows nothing unless push is set up in Admin > Integrations.

const TOKEN_KEY = 'pushToken'
const api = (path) => `${import.meta.env.VITE_BASE_URL}${path}`
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

const supported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window

async function getMessagingToken(pushConfig) {
    const { initializeApp, getApps } = await import('firebase/app')
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging')

    const app = getApps()[ 0 ] || initializeApp(pushConfig.firebase)
    const query = new URLSearchParams(pushConfig.firebase).toString()
    const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`)
    const messaging = getMessaging(app)

    // While the page is open, FCM doesn't show anything itself
    onMessage(messaging, (payload) => {
        if (Notification.permission === 'granted' && payload.notification) {
            registration.showNotification(payload.notification.title, { body: payload.notification.body, icon: '/vite.svg' })
        }
    })

    return getToken(messaging, { vapidKey: pushConfig.vapidKey, serviceWorkerRegistration: registration })
}

const PushNotificationButton = () => {
    const [ pushConfig, setPushConfig ] = useState(null)
    const [ state, setState ] = useState('idle') // idle | on | busy | blocked | error
    const [ message, setMessage ] = useState('')

    useEffect(() => {
        if (!supported()) return
        axios.get(api('/notifications/push-config')).then(res => {
            if (!res.data.enabled) return
            setPushConfig(res.data)
            if (Notification.permission === 'denied') setState('blocked')
            else if (Notification.permission === 'granted' && localStorage.getItem(TOKEN_KEY)) {
                setState('on')
                // refresh the token quietly (it can rotate) and re-attach the foreground listener
                getMessagingToken(res.data).then(token => {
                    if (!token) return
                    localStorage.setItem(TOKEN_KEY, token)
                    return axios.post(api('/notifications/push-token'), { token }, { headers: authHeaders() })
                }).catch(() => {})
            }
        }).catch(() => {})
    }, [])

    useEffect(() => {
        if (!message) return
        const timer = setTimeout(() => setMessage(''), 3000)
        return () => clearTimeout(timer)
    }, [ message ])

    if (!pushConfig) return null

    const turnOn = async () => {
        setState('busy')
        setMessage('')
        try {
            const permission = await Notification.requestPermission()
            if (permission !== 'granted') {
                setState(permission === 'denied' ? 'blocked' : 'idle')
                return
            }
            const token = await getMessagingToken(pushConfig)
            await axios.post(api('/notifications/push-token'), { token }, { headers: authHeaders() })
            localStorage.setItem(TOKEN_KEY, token)
            setState('on')
            setMessage('Notifications on')
        } catch (err) {
            console.error('Push subscribe error:', err)
            setState('error')
            setMessage('Could not turn on notifications')
        }
    }

    const turnOff = async () => {
        setState('busy')
        const token = localStorage.getItem(TOKEN_KEY)
        try {
            if (token) await axios.delete(api('/notifications/push-token'), { data: { token }, headers: authHeaders() })
        } catch (err) {
            console.error('Push unsubscribe error:', err)
        }
        localStorage.removeItem(TOKEN_KEY)
        setState('idle')
        setMessage('Notifications off')
    }

    const title = {
        idle: 'Turn on ride notifications',
        on: 'Ride notifications are on — click to turn off',
        busy: 'Please wait…',
        blocked: 'Notifications are blocked. Allow them in your browser’s site settings.',
        error: message || 'Could not turn on notifications — try again',
    }[ state ]

    return (
        <div className='relative'>
            <button
                type='button'
                onClick={state === 'on' ? turnOff : turnOn}
                disabled={state === 'busy' || state === 'blocked'}
                title={title}
                aria-label={title}
                aria-pressed={state === 'on'}
                className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all duration-200 shadow-sm disabled:opacity-60 ${state === 'on' ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-100/80 text-gray-700 hover:bg-black hover:text-white'}`}
            >
                <i className={`text-sm ${state === 'on' ? 'ri-notification-3-fill' : state === 'blocked' ? 'ri-notification-off-line' : state === 'busy' ? 'ri-loader-4-line animate-spin' : 'ri-notification-3-line'}`}></i>
            </button>
            {message && state !== 'busy' && (
                <span role='status' className='absolute right-0 top-11 whitespace-nowrap rounded-lg bg-black text-white text-[11px] font-medium px-2 py-1 shadow-lg'>
                    {message}
                </span>
            )}
        </div>
    )
}

export default PushNotificationButton
