<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getToken, requestVerificationCode, verifyAndRegister, checkAdminExists, ApiError } from '$lib/api';

	type Step = 'email' | 'verify';

	let step = $state<Step>('email');
	let email = $state('');
	let code = $state('');
	let asAdmin = $state(false);
	let adminExists = $state(true); // assume exists until checked
	let fallbackCode = $state<string | undefined>(undefined);
	let resendError = $state<string | undefined>(undefined);
	let errorMsg = $state('');
	let loading = $state(false);

	onMount(async () => {
		if (getToken()) { goto('/dashboard'); return; }
		adminExists = await checkAdminExists();
	});

	async function handleRequestCode() {
		errorMsg = '';
		loading = true;
		try {
			const result = await requestVerificationCode(email);
			fallbackCode = result.code;
			resendError = result.resendError;
			step = 'verify';
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '登録に失敗しました';
		} finally {
			loading = false;
		}
	}

	async function handleVerify() {
		errorMsg = '';
		loading = true;
		try {
			await verifyAndRegister(email, code, asAdmin);
			await goto('/dashboard');
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '認証に失敗しました';
		} finally {
			loading = false;
		}
	}

	async function resend() {
		code = '';
		errorMsg = '';
		await handleRequestCode();
	}
</script>

<div class="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-md border border-gray-100">
	<h2 class="text-2xl font-bold text-center text-indigo-600 mb-2 tracking-tight">Tasqa</h2>
	<p class="text-center text-sm text-gray-500 mb-6">新規アカウント登録</p>

	{#if step === 'email'}
		<form onsubmit={(e) => { e.preventDefault(); handleRequestCode(); }} class="space-y-4">
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

			{#if !adminExists}
				<label class="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer">
					<input type="checkbox" bind:checked={asAdmin} class="w-4 h-4 rounded text-amber-600" />
					<div>
						<p class="text-sm font-medium text-amber-800">管理者アカウントとして登録</p>
						<p class="text-xs text-amber-600">この操作は一度きりです。管理者が存在しない今のみ選択できます。</p>
					</div>
				</label>
			{/if}

			{#if errorMsg}
				<p class="text-red-500 text-sm">{errorMsg}</p>
			{/if}
			<button
				type="submit"
				disabled={loading}
				class="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
			>
				{loading ? '送信中...' : '認証コードを送信'}
			</button>
		</form>
	{:else}
		<form onsubmit={(e) => { e.preventDefault(); handleVerify(); }} class="space-y-4">
			<p class="text-sm text-gray-600">
				<span class="font-medium">{email}</span> 宛に6桁の認証コードを送信しました。
			</p>
			{#if !fallbackCode}
				<div class="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
					<span class="mt-0.5 shrink-0">📬</span>
					<p>メールが届かない場合は、<span class="font-medium text-gray-700">迷惑メールフォルダ</span>をご確認ください。それでも届かない場合は下の「再送信」をお試しください。</p>
				</div>
			{/if}
			{#if fallbackCode}
				<div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
					<p class="text-amber-700 font-medium mb-1">
						{resendError ? 'メール送信エラー（フォールバック表示）' : '開発モード（メール未設定）'}
					</p>
					{#if resendError}
						<p class="text-xs text-amber-600 mb-1">Resendエラー: {resendError}</p>
					{/if}
					<p class="text-amber-800">認証コード: <span class="font-mono text-lg font-bold tracking-widest">{fallbackCode}</span></p>
				</div>
			{/if}
			{#if asAdmin}
				<div class="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
					<span>⚙️</span> 管理者アカウントとして登録されます
				</div>
			{/if}
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1" for="code">認証コード（6桁）</label>
				<input
					id="code"
					type="text"
					inputmode="numeric"
					maxlength="6"
					bind:value={code}
					oninput={(e) => { code = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6); }}
					class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center font-mono text-xl tracking-widest"
					placeholder="000000"
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
				{loading ? '確認中...' : '認証してアカウント作成'}
			</button>
			<p class="text-center text-sm text-gray-500">
				コードが届かない場合は
				<button type="button" onclick={resend} class="text-indigo-600 hover:underline">再送信</button>
			</p>
		</form>
	{/if}

	<p class="text-center text-sm text-gray-500 mt-4">
		すでにアカウントをお持ちの方は
		<a href="/" class="text-indigo-600 hover:underline font-medium">ログイン</a>
	</p>
</div>
