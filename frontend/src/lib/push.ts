import { getVapidPublicKey, subscribePush, unsubscribePush } from './api';

function urlBase64ToUint8Array(base64String: string) {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; i++) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

export function isPushSupported() {
	return (
		typeof window !== 'undefined' &&
		'serviceWorker' in navigator &&
		'PushManager' in window &&
		'Notification' in window
	);
}

export async function getPushSubscription() {
	const registration = await navigator.serviceWorker.ready;
	return registration.pushManager.getSubscription();
}

export async function enablePushNotifications() {
	const permission = await Notification.requestPermission();
	if (permission !== 'granted') {
		throw new Error('通知の許可が得られませんでした');
	}

	const { key } = await getVapidPublicKey();
	if (!key) {
		throw new Error('サーバーで通知機能が設定されていません');
	}

	const registration = await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(key)
	});

	await subscribePush(subscription.toJSON() as PushSubscriptionJSON);
	return subscription;
}

export async function disablePushNotifications() {
	const subscription = await getPushSubscription();
	if (!subscription) return;
	await unsubscribePush(subscription.endpoint);
	await subscription.unsubscribe();
}
