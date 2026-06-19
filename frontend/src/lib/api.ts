import { goto } from '$app/navigation';
import type { Task, Event, AiItem } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const TOKEN_KEY = 'task_token';

export function getToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
	localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
	localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const token = getToken();
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...(options.headers as Record<string, string> | undefined)
	};
	if (token) headers.Authorization = `Bearer ${token}`;

	let res: Response;
	try {
		res = await fetch(`${API_URL}${path}`, { ...options, headers });
	} catch {
		throw new ApiError('サーバーに接続できませんでした');
	}

	if (res.status === 401) {
		clearToken();
		goto('/');
		throw new ApiError('認証が切れました。再度ログインしてください');
	}

	if (!res.ok) {
		const body = await res.json().catch(() => null);
		throw new ApiError(body?.message ?? `エラーが発生しました (${res.status})`);
	}

	return res.json() as Promise<T>;
}

export async function login(email: string, password: string) {
	const res = await fetch(`${API_URL}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});
	const data = await res.json();
	if (!data.success) throw new ApiError(data.message ?? 'メールアドレスまたはパスワードが違います');
	setToken(data.token);
}

export async function requestVerificationCode(email: string): Promise<{ fallback: boolean; code?: string }> {
	const res = await fetch(`${API_URL}/auth/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email })
	});
	const data = await res.json();
	if (!data.success) throw new ApiError(data.message ?? '登録に失敗しました');
	return { fallback: data.fallback, code: data.code };
}

export async function verifyAndRegister(email: string, code: string) {
	const res = await fetch(`${API_URL}/auth/verify`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, code })
	});
	const data = await res.json();
	if (!data.success) throw new ApiError(data.message ?? '認証に失敗しました');
	setToken(data.token);
}

export function fetchMe() {
	return request<{ email: string | null }>('/settings/me');
}

export async function changePassword(newPassword: string) {
	await request<{ success: boolean }>('/settings/password', {
		method: 'PUT',
		body: JSON.stringify({ newPassword })
	});
}

export function fetchTasks() {
	return request<Task[]>('/tasks');
}

export function createTask(task: Omit<Task, 'sort_order'> & { sort_order?: number }) {
	return request<{ success: boolean }>('/tasks', {
		method: 'POST',
		body: JSON.stringify(task)
	});
}

export function updateTask(task: Task) {
	return request<{ success: boolean }>(`/tasks/${task.id}`, {
		method: 'PUT',
		body: JSON.stringify(task)
	});
}

export function deleteTask(id: string) {
	return request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' });
}

export function reorderTasks(orders: { id: string; sort_order: number }[]) {
	return request<{ success: boolean }>('/tasks/reorder', {
		method: 'PUT',
		body: JSON.stringify({ orders })
	});
}

export function fetchEvents() {
	return request<Event[]>('/events');
}

export function createEvent(event: Omit<Event, 'id'> & { id: string }) {
	return request<{ success: boolean }>('/events', {
		method: 'POST',
		body: JSON.stringify(event)
	});
}

export function updateEvent(event: Event) {
	return request<{ success: boolean }>(`/events/${event.id}`, {
		method: 'PUT',
		body: JSON.stringify(event)
	});
}

export function deleteEvent(id: string) {
	return request<{ success: boolean }>(`/events/${id}`, { method: 'DELETE' });
}

export function parseAiText(text: string, mode: 'simple' | 'organize') {
	return request<{ success: boolean; items: AiItem[] }>('/ai/parse', {
		method: 'POST',
		body: JSON.stringify({ text, mode })
	});
}

export function getVapidPublicKey() {
	return request<{ key: string | null }>('/push/vapid-public-key');
}

export function subscribePush(subscription: PushSubscriptionJSON) {
	return request<{ success: boolean }>('/push/subscribe', {
		method: 'POST',
		body: JSON.stringify(subscription)
	});
}

export function unsubscribePush(endpoint: string) {
	return request<{ success: boolean }>('/push/unsubscribe', {
		method: 'POST',
		body: JSON.stringify({ endpoint })
	});
}
