/* Firebase Cloud Messaging service worker: shows ride notifications while the site is closed.
   The public Firebase web config is passed in the registration URL by PushNotificationButton.
   Clicking a notification opens its link (set by the backend via webpush.fcm_options.link). */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

const params = new URL(self.location.href).searchParams
const config = {
    apiKey: params.get('apiKey'),
    projectId: params.get('projectId'),
    messagingSenderId: params.get('messagingSenderId'),
    appId: params.get('appId'),
}

if (config.apiKey && config.projectId) {
    firebase.initializeApp(config)
    // Messages with a `notification` payload are displayed automatically by the SDK
    firebase.messaging()
}
