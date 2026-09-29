/**
 * Service worker de GastroOS.
 *
 * Hace dos cosas y ninguna más: recibir notificaciones push y contestar algo
 * cuando no hay internet. No cachea la aplicación. Es deliberado: un panel de
 * gestión que muestra pedidos y stock viejos porque los sirvió de una caché es
 * peor que uno que dice "no hay conexión". La plata y el stock no se sirven de
 * memoria.
 */

const OFFLINE_URL = '/offline.html';
const CACHE = 'gastroos-offline-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

/**
 * Sólo se intercepta la navegación, y sólo para el caso de que falle: todo lo
 * demás va a la red como si el service worker no existiera.
 */
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE_URL)) || Response.error();
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'GastroOS', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'GastroOS';
  const options = {
    body: payload.body || '',
    icon: '/icono-192.png',
    badge: '/icono-192.png',
    // Un aviso por pedido: si llegan tres seguidos, se ven los tres. El `tag`
    // los apilaría y el segundo taparía al primero.
    tag: payload.tag,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/admin' },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/admin';

  // Si el panel ya está abierto se enfoca esa ventana en vez de abrir otra:
  // terminar con seis pestañas del mismo pedido es la forma más rápida de que
  // alguien apague las notificaciones.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
