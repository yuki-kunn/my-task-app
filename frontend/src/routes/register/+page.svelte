<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getToken, requestVerificationCode, verifyAndRegister, ApiError } from '$lib/api';

	type Step = 'email' | 'verify';

	let step = $state<Step>('email');
	let email = $state('');
	let code = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let fallbackCode = $state<string | undefined>(undefined);
	let resendError = $state<string | undefined>(undefined);
	let errorMsg = $state('');
	let loading = $state(false);

	onMount(() => {
		if (getToken()) goto('/dashboard');
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
		if (password.length < 8) {
			errorMsg = 'パスワードは8文字以上で設定してください';
			return;
		}
		if (password !== confirmPassword) {
			errorMsg = '確認用パスワードが一致しません';
			return;
		}
		loading = true;
		try {
			await verifyAndRegister(email, code, password);
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
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1" for="reg-pw">パスワード（8文字以上）</label>
				<input
					id="reg-pw"
					type="password"
					bind:value={password}
					minlength="8"
					class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
					placeholder="新しいパスワード"
					required
				/>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1" for="reg-pw2">パスワード（確認）</label>
				<input
					id="reg-pw2"
					type="password"
					bind:value={confirmPassword}
					minlength="8"
					class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
					placeholder="もう一度入力"
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
