<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getToken, login, ApiError } from '$lib/api';

	let email = $state('');
	let password = $state('');
	let errorMsg = $state('');
	let loading = $state(false);

	onMount(() => {
		if (getToken()) goto('/dashboard');
	});

	async function handleLogin() {
		errorMsg = '';
		loading = true;
		try {
			await login(email, password);
			await goto('/dashboard');
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : 'ログインに失敗しました';
		} finally {
			loading = false;
		}
	}
</script>

<div class="max-w-sm mx-auto mt-20 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
	<div class="text-center mb-8">
		<h1 class="tasqa-logo" style="color: #4338ca; font-size: 2rem; letter-spacing: 0.15em;">Tasqa</h1>
		<p class="text-xs text-gray-400 mt-1 tracking-widest uppercase">Task & Schedule</p>
	</div>

	<form onsubmit={(e) => { e.preventDefault(); handleLogin(); }} class="space-y-4">
		<div>
			<label class="block text-xs font-medium text-gray-500 mb-1.5" for="email">メールアドレス</label>
			<input
				id="email"
				type="email"
				bind:value={email}
				class="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 focus:outline-none transition"
				placeholder="your@email.com"
				required
			/>
		</div>
		<div>
			<label class="block text-xs font-medium text-gray-500 mb-1.5" for="pw">パスワード</label>
			<input
				id="pw"
				type="password"
				bind:value={password}
				class="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 focus:outline-none transition"
				placeholder="初期パスワード: pass"
				required
			/>
		</div>
		{#if errorMsg}
			<p class="text-red-500 text-xs">{errorMsg}</p>
		{/if}
		<button
			type="submit"
			disabled={loading}
			class="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50 mt-1"
		>
			{loading ? 'ログイン中…' : 'ログイン'}
		</button>
	</form>

	<p class="text-center text-xs text-gray-400 mt-6">
		アカウントをお持ちでない方は
		<a href="/register" class="text-indigo-500 hover:text-indigo-700 font-medium transition-colors">新規登録</a>
	</p>
</div>
