// Service Worker para Notificações Push e Alertas em Tempo Real - MetricBarber
const CACHE_NAME = 'metricbarber-sw-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Evento de Recebimento de Push Remoto
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: '✂️ Novo Agendamento!', body: event.data.text() };
    }
  }

  const title = data.title || '✂️ Novo Agendamento Recebido!';
  const options = {
    body: data.body || data.message || 'Um novo agendamento foi recebido no MetricBarber.',
    icon: data.icon || '/barber-hero.jpg',
    badge: data.badge || '/barber-hero.jpg',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/agenda',
      appointmentId: data.appointmentId || null,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open', title: '📅 Ver na Agenda' },
      { action: 'dismiss', title: 'Dispensar' }
    ],
    tag: 'metricbarber-appointment-' + (data.appointmentId || Date.now()),
    renotify: true,
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clique na Notificação Push do Navegador
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/agenda';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já existe uma janela aberta, foca nela e navega
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && client.url && !client.url.includes(targetUrl)) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Se não há janelas abertas, abre uma nova
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Mensagens internas enviadas pela aplicação (ex: disparar notificação local via ServiceWorker)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      icon: '/barber-hero.jpg',
      badge: '/barber-hero.jpg',
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: '📅 Ver na Agenda' },
        { action: 'dismiss', title: 'Fechar' }
      ],
      tag: 'local-notification-' + Date.now(),
      renotify: true,
      ...options,
    });
  }
});
