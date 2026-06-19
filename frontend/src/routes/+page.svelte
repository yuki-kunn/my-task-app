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

<div class="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-md border border-gray-100">
	<h2 class="text-2xl font-bold text-center text-indigo-600 mb-2 tracking-tight">Tasqa</h2>
	<p class="text-center text-sm text-gray-500 mb-6">タスク・予定管理アプリ</p>
	<form onsubmit={(e) => { e.preventDefault(); handleLogin(); }} class="space-y-4">
		<div>
			<label class="block text-sm font-medium text-gray-700 mb-1" for="email">メールアドレス</label>
			<input
				id="email"
				type="email"
				bind:value={email}
				class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
				placeholder="your@email.com"
				required
			/>
		</div>
		<div>
			<label class="block text-sm font-medium text-gray-700 mb-1" for="pw">パスワード</label>
			<input
				id="pw"
				type="password"
				bind:value={password}
				class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
				placeholder="初期パスワード: pass"
				required
			/>
		</div>
		{#if errorMsg}
			<p class="text-red-500 text-sm">{errorMsg}</p>
		{/if}
		<button
			type="submit"
			disabled={loading}
			class="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
		>
			{loading ? 'ログイン中...' : 'ログイン'}
		</button>
	</form>
	<p class="text-center text-sm text-gray-500 mt-4">
		アカウントをお持ちでない方は
		<a href="/register" class="text-indigo-600 hover:underline font-medium">新規登録</a>
	</p>
</div>
