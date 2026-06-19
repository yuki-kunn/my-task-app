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

<div class="min-h-screen flex items-center justify-center px-4">
	<div class="w-full max-w-sm">
		<!-- カード -->
		<div class="relative bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden
			border border-indigo-100/80
			shadow-[0_8px_48px_rgba(30,27,75,0.12),0_2px_12px_rgba(30,27,75,0.08)]">

			<!-- 上部ゴールドライン -->
			<div class="h-px w-full bg-gradient-to-r from-transparent via-[#c8a96e] to-transparent opacity-70"></div>

			<div class="px-8 py-9">
				<!-- ロゴ -->
				<div class="flex flex-col items-center mb-8">
					<span class="tasqa-logo" style="font-size:2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">Tasqa</span>
					<p class="mt-2 text-[11px] tracking-[0.25em] text-indigo-300 uppercase"
						style="font-family: 'Noto Serif JP', serif;">Task & Schedule</p>
					<div class="mt-4 w-16 h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent"></div>
				</div>

				<!-- フォーム -->
				<form onsubmit={(e) => { e.preventDefault(); handleLogin(); }} class="space-y-5">
					<div>
						<label class="block text-[11px] tracking-widest text-indigo-400 mb-1.5 uppercase"
							style="font-family:'Noto Serif JP',serif;" for="email">メールアドレス</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							class="w-full px-4 py-2.5 bg-indigo-50/60 border border-indigo-100 rounded-lg text-sm text-gray-800
								focus:ring-2 focus:ring-indigo-300/50 focus:border-indigo-300 focus:outline-none
								placeholder-gray-300 transition"
							placeholder="your@email.com"
							required
						/>
					</div>
					<div>
						<label class="block text-[11px] tracking-widest text-indigo-400 mb-1.5 uppercase"
							style="font-family:'Noto Serif JP',serif;" for="pw">パスワード</label>
						<input
							id="pw"
							type="password"
							bind:value={password}
							class="w-full px-4 py-2.5 bg-indigo-50/60 border border-indigo-100 rounded-lg text-sm text-gray-800
								focus:ring-2 focus:ring-indigo-300/50 focus:border-indigo-300 focus:outline-none
								placeholder-gray-300 transition"
							placeholder="初期パスワード: pass"
							required
						/>
					</div>

					{#if errorMsg}
						<p class="text-red-400 text-xs text-center">{errorMsg}</p>
					{/if}

					<button
						type="submit"
						disabled={loading}
						class="btn-royal w-full py-2.5 rounded-lg text-sm mt-2"
					>
						{loading ? 'ログイン中…' : 'ログイン'}
					</button>
				</form>

				<div class="mt-6 flex items-center gap-3">
					<div class="flex-1 h-px bg-gradient-to-r from-transparent via-indigo-100 to-transparent"></div>
					<span class="text-[10px] tracking-widest text-indigo-300 uppercase" style="font-family:'Noto Serif JP',serif;">or</span>
					<div class="flex-1 h-px bg-gradient-to-l from-transparent via-indigo-100 to-transparent"></div>
				</div>

				<p class="text-center text-[11px] text-gray-400 mt-4" style="font-family:'Noto Serif JP',serif;">
					アカウントをお持ちでない方は
					<a href="/register" class="text-indigo-500 hover:text-indigo-700 font-medium transition-colors">新規登録</a>
				</p>
			</div>

			<!-- 下部ゴールドライン -->
			<div class="h-px w-full bg-gradient-to-r from-transparent via-[#c8a96e] to-transparent opacity-40"></div>
		</div>
	</div>
</div>
