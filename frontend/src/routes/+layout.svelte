<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { CheckSquare, Calendar, Settings, LogOut, Sparkles } from 'lucide-svelte';
	import { getToken, clearToken } from '$lib/api';

	let { children } = $props();

	let isAuthenticated = $state(false);
	let checked = $state(false);

	$effect(() => {
		// Re-check on every navigation so logging in updates the nav bar without a reload.
		page.url.pathname;
		isAuthenticated = !!getToken();
		const publicPaths = ['/', '/register'];
		if (!isAuthenticated && !publicPaths.includes(page.url.pathname)) {
			goto('/');
		}
		checked = true;
	});

	function logout() {
		clearToken();
		isAuthenticated = false;
		goto('/');
	}

	const showNav = $derived(isAuthenticated && page.url.pathname !== '/');
</script>

<div class="min-h-screen flex flex-col pb-16 md:pb-0">
	{#if showNav}
		<header
			class="hidden md:flex bg-indigo-600 text-white justify-between items-center px-6 py-4 shadow-md"
		>
			<h1 class="text-xl font-bold tracking-wider">Tasqa</h1>
			<nav class="flex gap-6 items-center">
				<a href="/dashboard" class="flex items-center gap-1 hover:text-indigo-200">
					<CheckSquare size={18} /> ダッシュボード
				</a>
				<a href="/calendar" class="flex items-center gap-1 hover:text-indigo-200">
					<Calendar size={18} /> カレンダー
				</a>
				<a href="/ai" class="flex items-center gap-1 hover:text-indigo-200">
					<Sparkles size={18} /> AI登録
				</a>
				<a href="/settings" class="flex items-center gap-1 hover:text-indigo-200">
					<Settings size={18} /> 設定
				</a>
				<button
					onclick={logout}
					class="flex items-center gap-1 bg-indigo-700 px-3 py-1.5 rounded hover:bg-indigo-800 text-sm"
				>
					<LogOut size={16} /> ログアウト
				</button>
			</nav>
		</header>
	{/if}

	<main class="flex-grow container mx-auto p-4 max-w-4xl">
		{#if checked}
			{@render children()}
		{/if}
	</main>

	{#if showNav}
		<nav
			class="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50 shadow-lg"
		>
			<a href="/dashboard" class="flex-1 flex flex-col items-center justify-center py-3 text-xs text-gray-600 hover:text-indigo-600 hover:bg-indigo-50">
				<CheckSquare size={22} class="mb-1" /> ダッシュボード
			</a>
			<a href="/calendar" class="flex-1 flex flex-col items-center justify-center py-3 text-xs text-gray-600 hover:text-indigo-600 hover:bg-indigo-50">
				<Calendar size={22} class="mb-1" /> カレンダー
			</a>
			<a href="/ai" class="flex-1 flex flex-col items-center justify-center py-3 text-xs text-gray-600 hover:text-indigo-600 hover:bg-indigo-50">
				<Sparkles size={22} class="mb-1" /> AI
			</a>
			<a href="/settings" class="flex-1 flex flex-col items-center justify-center py-3 text-xs text-gray-600 hover:text-indigo-600 hover:bg-indigo-50">
				<Settings size={22} class="mb-1" /> 設定
			</a>
		</nav>
	{/if}
</div>
