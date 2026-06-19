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

	const navItems = [
		{ href: '/dashboard', icon: CheckSquare, label: 'タスク' },
		{ href: '/calendar',  icon: Calendar,    label: 'カレンダー' },
		{ href: '/ai',        icon: Sparkles,    label: 'AI登録' },
		{ href: '/settings',  icon: Settings,    label: '設定' },
	];
</script>

<div class="min-h-screen flex flex-col pb-16 md:pb-0">

	{#if showNav}
		<!-- ── PC ヘッダー ─────────────────────────── -->
		<header class="royal-header hidden md:flex justify-between items-center px-8 py-0 h-[60px]">
			<!-- ロゴ -->
			<a href="/dashboard" class="tasqa-logo select-none">Tasqa</a>

			<!-- ナビ -->
			<nav class="flex items-center gap-7">
				{#each navItems as item}
					<a
						href={item.href}
						class="nav-link flex items-center gap-1.5"
						class:active={page.url.pathname === item.href}
					>
						<svelte:component this={item.icon} size={15} />
						{item.label}
					</a>
				{/each}

				{#if isAdmin}
					<a
						href="/admin"
						class="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium tracking-wider
							border border-yellow-400/40 text-yellow-200 hover:text-yellow-100 hover:border-yellow-300/60
							transition-all duration-200 bg-white/5 hover:bg-white/10"
						style="font-family: 'Noto Serif JP', serif; letter-spacing: 0.08em;"
					>
						<ShieldCheck size={13} /> 管理
					</a>
				{/if}

				<!-- 区切り線 -->
				<span class="h-5 w-px bg-white/15"></span>

				<button
					onclick={logout}
					class="flex items-center gap-1.5 text-[11px] tracking-wider
						text-white/50 hover:text-red-300 transition-colors duration-200"
					style="font-family: 'Noto Serif JP', serif;"
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
		<!-- ── モバイル下部ナビ ─────────────────────── -->
		<nav class="md:hidden fixed bottom-0 left-0 right-0 z-50
			bg-gradient-to-t from-[#1e1b4b] to-[#2d2a6e]
			border-t border-[rgba(200,169,110,0.2)]
			shadow-[0_-4px_24px_rgba(30,27,75,0.5)]
			flex">

			{#each navItems as item}
				{@const active = page.url.pathname === item.href}
				<a
					href={item.href}
					class="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[9px] tracking-wider transition-colors duration-200
						{active ? 'text-yellow-200' : 'text-indigo-300/70 hover:text-indigo-100'}"
					style="font-family: 'Noto Serif JP', serif;"
				>
					<svelte:component this={item.icon} size={19} />
					{item.label}
				</a>
			{/each}

			{#if isAdmin}
				<a
					href="/admin"
					class="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[9px] tracking-wider
						text-yellow-300/80 hover:text-yellow-200 transition-colors duration-200"
					style="font-family: 'Noto Serif JP', serif;"
				>
					<ShieldCheck size={19} /> 管理
				</a>
			{/if}
		</nav>
	{/if}

</div>

<style>
	.nav-link.active {
		color: #e8d5a3;
	}
	.nav-link.active::after {
		transform: scaleX(1);
	}
</style>
