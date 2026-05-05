// Minimal service worker for web push notifications
// Handles generic push payloads and shows a notification.
// FCM will deliver payloads with `notification` or `data` fields.

self.addEventListener('push', function (event) {
  try {
    const payload = event.data ? event.data.json() : {}
    const title = (payload.notification && payload.notification.title) || payload.title || 'Notification'
    const body = (payload.notification && payload.notification.body) || payload.body || ''
    const data = payload.data || {}

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        data,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
      })
    )
  } catch (e) {
    // Fallback: show a generic notification
    event.waitUntil(
      self.registration.showNotification('Notification', {
        body: 'You have a new message',
      })
    )
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.click_action) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})

