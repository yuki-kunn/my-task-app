/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('push', (event) => {
	const data = event.data?.json() ?? {};
	const title = data.title ?? 'Tasqa';
	const options: NotificationOptions = {
		body: data.body ?? '',
		icon: '/pwa-192x192.png',
		badge: '/pwa-64x64.png',
		data: { url: data.url ?? '/dashboard' }
	};
	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/dashboard';
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			for (const client of clients) {
				if (client.url.includes(url) && 'focus' in client) {
					return client.focus();
				}
			}
			return self.clients.openWindow(url);
		})
	);
});
