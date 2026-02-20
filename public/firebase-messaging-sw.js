// Give the service worker access to Firebase Messaging.
importScripts('/_cozzy_external/www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('/_cozzy_external/www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
// Replace with your actual Firebase config

firebase.initializeApp({
    apiKey: 'AIzaSyB-kC7o09-CdIfM9nTEgf783YDDOUthM7g',
    authDomain: 'cozzy-corner-1933e.firebaseapp.com',
    projectId: 'cozzy-corner-1933e',
    storageBucket: 'cozzy-corner-1933e.firebasestorage.app',
    messagingSenderId: '279941043573',
    appId: '1:279941043573:web:f0b8f3f984f2e1292aaf3c',
});

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('Received background message:', payload);

    const notificationTitle = payload.notification?.title || 'New Notification';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new notification',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            url: '/orders', // ← This is where the user will go when they click
            ...payload.data,
        },
        requireInteraction: true, // ← Keeps notification visible until clicked
        tag: 'order-notification',
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    event.notification.close(); // Close the notification

    // Get the URL from notification data (default to orders page)
    const urlToOpen = event.notification.data?.url || '/orders';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there is already a window/tab open with the app
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                // If app is already open, navigate to the URL and focus
                if (client.url.includes(self.registration.scope) && 'focus' in client) {
                    client.navigate(urlToOpen);
                    return client.focus();
                }
            }
            // If app is not open, open it with the URL
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        }),
    );
});
