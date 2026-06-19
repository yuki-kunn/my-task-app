<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { CheckSquare, Calendar, Settings, LogOut, Sparkles, ShieldCheck } from 'lucide-svelte';
	import { getToken, clearToken, fetchMe, getPasswordIsDefault } from '$lib/api';

	let { children } = $props();

	let isAuthenticated = $state(false);
	let isAdmin = $state(false);
	let mustChangePassword = $state(false);
	let checked = $state(false);

	$effect(() => {
		page.url.pathname;
		isAuthenticated = !!getToken();
		const publicPaths = ['/', '/register'];
		if (!isAuthenticated && !publicPaths.includes(page.url.pathname)) {
			goto('/');
			return;
		}
		mustChangePassword = isAuthenticated ? getPasswordIsDefault() : false;
		if (mustChangePassword && page.url.pathname !== '/settings') {
			goto('/settings');
		}
		checked = true;
	});

	$effect(() => {
		page.url.pathname;
		if (isAuthenticated) {
			fetchMe().then((me) => { isAdmin = me.role === 'admin'; }).catch(() => {});
		} else {
			isAdmin = false;
		}
	});

	function logout() {
		clearToken();
		isAuthenticated = false;
		mustChangePassword = false;
		goto('/');
	}

	const hiddenPaths = ['/', '/register'];
	const showNav = $derived(isAuthenticated && !hiddenPaths.includes(page.url.pathname));
</script>

<div class="min-h-screen flex flex-col pb-16 md:pb-0">

	{#if showNav}
		<header class="hidden md:flex bg-indigo-700 text-white justify-between items-center px-6 py-0 h-14 shadow-sm">
			<a href="/dashboard" class="tasqa-logo select-none">Tasqa</a>
			<nav class="flex items-center gap-6 text-sm">
				<a href="/dashboard" class="flex items-center gap-1.5 text-indigo-200 hover:text-white transition-colors
					{page.url.pathname === '/dashboard' ? 'text-white' : ''}">
					<CheckSquare size={15} /> ダッシュボード
				</a>
				<a href="/calendar" class="flex items-center gap-1.5 text-indigo-200 hover:text-white transition-colors
					{page.url.pathname === '/calendar' ? 'text-white' : ''}">
					<Calendar size={15} /> カレンダー
				</a>
				<a href="/ai" class="flex items-center gap-1.5 text-indigo-200 hover:text-white transition-colors
					{page.url.pathname === '/ai' ? 'text-white' : ''}">
					<Sparkles size={15} /> AI登録
				</a>
				<a href="/settings" class="flex items-center gap-1.5 text-indigo-200 hover:text-white transition-colors
					{page.url.pathname === '/settings' ? 'text-white' : ''}">
					<Settings size={15} /> 設定
				</a>
				{#if isAdmin}
					<a href="/admin" class="flex items-center gap-1.5 bg-indigo-600 px-3 py-1 rounded text-sm hover:bg-indigo-500 transition-colors">
						<ShieldCheck size={14} /> 管理
					</a>
				{/if}
				<button
					onclick={logout}
					class="flex items-center gap-1.5 text-indigo-300 hover:text-white transition-colors ml-1"
				>
					<LogOut size={14} /> ログアウト
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
		<nav class="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50 shadow-lg">
			<a href="/dashboard" class="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px]
				{page.url.pathname === '/dashboard' ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}">
				<CheckSquare size={20} /> タスク
			</a>
			<a href="/calendar" class="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px]
				{page.url.pathname === '/calendar' ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}">
				<Calendar size={20} /> カレンダー
			</a>
			<a href="/ai" class="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px]
				{page.url.pathname === '/ai' ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}">
				<Sparkles size={20} /> AI
			</a>
			<a href="/settings" class="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px]
				{page.url.pathname === '/settings' ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}">
				<Settings size={20} /> 設定
			</a>
			{#if isAdmin}
				<a href="/admin" class="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] text-indigo-600">
					<ShieldCheck size={20} /> 管理
				</a>
			{/if}
		</nav>
	{/if}

</div>
