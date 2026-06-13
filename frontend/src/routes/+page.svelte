<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getToken, login, ApiError } from '$lib/api';

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
			await login(password);
			await goto('/dashboard');
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : 'ログインに失敗しました';
		} finally {
			loading = false;
		}
	}
</script>

<div class="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-md border border-gray-100">
	<h2 class="text-2xl font-bold text-center text-indigo-600 mb-6">YukiTask Login</h2>
	<form onsubmit={(e) => { e.preventDefault(); handleLogin(); }} class="space-y-4">
		<div>
			<label class="block text-sm font-medium text-gray-700 mb-1" for="pw">パスワードを入力</label>
			<input
				id="pw"
				type="password"
				bind:value={password}
				class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
				placeholder="初期pass: yukitask"
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
</div>
