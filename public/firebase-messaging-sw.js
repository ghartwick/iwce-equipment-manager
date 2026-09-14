/* global importScripts, firebase, self */

// Firebase Cloud Messaging service worker.
//
// Service workers cannot read Vite env vars, so the app passes the Firebase
// config as query params when it registers this file (see pushNotificationService).
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;

firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId')
});

const messaging = firebase.messaging();

// Fired for data-only messages while the app is backgrounded. Messages that
// already carry a `notification` block are rendered by the browser itself.
messaging.onBackgroundMessage(payload => {
  const title = payload.data?.title || 'Field Hub';
  self.registration.showNotification(title, {
    body: payload.data?.body || '',
    icon: '/top-left-logo.png',
    badge: '/top-left-logo.png',
    tag: payload.data?.tag || undefined,
    data: { url: payload.data?.url || '/' }
  });
});

// Focus an existing tab if one is open, otherwise open a new one.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
