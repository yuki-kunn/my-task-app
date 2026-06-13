import { goto } from '$app/navigation';
import type { Task } from './types';

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

export async function login(password: string) {
	const res = await fetch(`${API_URL}/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ password })
	});
	const data = await res.json();
	if (!data.success) throw new ApiError(data.message ?? 'パスワードが違います');
	setToken(data.token);
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
