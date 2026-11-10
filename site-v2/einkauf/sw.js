/* Service Worker der Nachschub-Liste: nur für Handy-Benachrichtigungen.
   Speichert nichts zwischen, die Seite kommt immer frisch vom Server. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'THE BAKERY', {
    body: d.body || '',
    icon: '/assets/img/icon-180.png',
    badge: '/assets/img/icon-180.png',
    tag: d.tag || 'einkauf',
    renotify: true,
    data: { url: d.url || '/einkauf/#liste' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/einkauf/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if (c.url.includes('/einkauf/') && 'focus' in c) { c.postMessage({ open: 'list' }); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
