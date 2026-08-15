<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { LogOut, ShieldAlert, Bell, User, KeyRound, Link2, Trash2, Copy, Check } from 'lucide-svelte';
	import {
		changePassword, fetchMe, updateDisplayName, clearToken, getPasswordIsDefault,
		fetchApiTokens, createApiToken, deleteApiToken, ApiError
	} from '$lib/api';
	import type { ApiToken } from '$lib/api';
	import {
		isPushSupported,
		getPushSubscription,
		enablePushNotifications,
		disablePushNotifications
	} from '$lib/push';

	let newPassword = $state('');
	let confirmPassword = $state('');
	let successMsg = $state('');
	let errorMsg = $state('');
	let saving = $state(false);

	let myEmail = $state<string | null>(null);
	let mustChangePassword = $state(false);

	let displayName = $state('');
	let savingName = $state(false);
	let nameSuccessMsg = $state('');
	let nameErrorMsg = $state('');

	let pushSupported = $state(false);
	let pushEnabled = $state(false);
	let pushBusy = $state(false);
	let pushError = $state('');

	let apiTokens = $state<ApiToken[]>([]);
	let newTokenName = $state('');
	let issuedToken = $state<string | null>(null);
	let tokenBusy = $state(false);
	let tokenError = $state('');
	let copied = $state(false);

	onMount(async () => {
		mustChangePassword = getPasswordIsDefault();
		try {
			const me = await fetchMe();
			myEmail = me.email;
			displayName = me.displayName ?? '';
		} catch { /* ignore */ }

		pushSupported = isPushSupported();
		if (pushSupported) {
			const sub = await getPushSubscription();
			pushEnabled = !!sub;
		}

		if (!mustChangePassword) {
			apiTokens = await fetchApiTokens().catch(() => []);
		}
	});

	async function handleCreateToken() {
		tokenError = '';
		tokenBusy = true;
		try {
			const res = await createApiToken(newTokenName.trim() || 'Obsidian連携');
			issuedToken = res.token;
			copied = false;
			newTokenName = '';
			apiTokens = await fetchApiTokens();
		} catch (err) {
			tokenError = err instanceof ApiError ? err.message : 'トークンの発行に失敗しました';
		} finally {
			tokenBusy = false;
		}
	}

	async function handleRevokeToken(id: string) {
		if (!confirm('このトークンを失効させますか？連携中のスクリプトは使えなくなります。')) return;
		try {
			await deleteApiToken(id);
			apiTokens = apiTokens.filter((t) => t.id !== id);
		} catch (err) {
			tokenError = err instanceof ApiError ? err.message : '失効に失敗しました';
		}
	}

	async function copyToken() {
		if (!issuedToken) return;
		try {
			await navigator.clipboard.writeText(issuedToken);
			copied = true;
			setTimeout(() => { copied = false; }, 2000);
		} catch { /* clipboard unavailable */ }
	}

	async function togglePush() {
		pushBusy = true;
		pushError = '';
		try {
			if (pushEnabled) {
				await disablePushNotifications();
				pushEnabled = false;
			} else {
				await enablePushNotifications();
				pushEnabled = true;
			}
		} catch (err) {
			pushError = err instanceof Error ? err.message : '通知設定の変更に失敗しました';
		} finally {
			pushBusy = false;
		}
	}

	async function handleChangePassword() {
		successMsg = '';
		errorMsg = '';

		if (newPassword.length < 8) {
			errorMsg = 'パスワードは8文字以上にしてください';
			return;
		}
		if (newPassword !== confirmPassword) {
			errorMsg = '確認用パスワードが一致しません';
			return;
		}

		saving = true;
		try {
			await changePassword(newPassword);
			successMsg = 'パスワードを正常に変更しました。';
			newPassword = '';
			confirmPassword = '';
			if (mustChangePassword) {
				mustChangePassword = false;
				await goto('/dashboard');
			}
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '変更に失敗しました';
		} finally {
			saving = false;
		}
	}

	async function handleSaveDisplayName() {
		nameSuccessMsg = '';
		nameErrorMsg = '';
		savingName = true;
		try {
			await updateDisplayName(displayName.trim());
			nameSuccessMsg = '表示名を更新しました。';
		} catch (err) {
			nameErrorMsg = err instanceof ApiError ? err.message : '更新に失敗しました';
		} finally {
			savingName = false;
		}
	}

	function handleLogout() {
		clearToken();
		window.location.href = '/';
	}
</script>

<div class="max-w-md mx-auto space-y-6 mt-6">

	<!-- 強制変更バナー -->
	{#if mustChangePassword}
		<div class="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
			<KeyRound size={20} class="text-amber-600 shrink-0 mt-0.5" />
			<div>
				<p class="text-sm font-semibold text-amber-800">パスワードの変更が必要です</p>
				<p class="text-xs text-amber-700 mt-0.5">初期パスワードのままです。新しいパスワードを設定するまで他の画面には進めません。</p>
			</div>
		</div>
	{/if}

	<!-- アカウント情報（通常時のみ） -->
	{#if !mustChangePassword}
		<div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
			<h2 class="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
				<User size={20} class="text-indigo-600" /> アカウント情報
			</h2>
			<p class="text-sm text-gray-500">メールアドレス</p>
			<p class="text-gray-800 font-medium mt-0.5 mb-4">{myEmail ?? '（未設定）'}</p>

			<form onsubmit={(e) => { e.preventDefault(); handleSaveDisplayName(); }} class="space-y-2">
				<label class="block text-sm text-gray-500" for="display-name">ユーザー名（表示名）</label>
				<div class="flex gap-2">
					<input
						id="display-name"
						type="text"
						bind:value={displayName}
						maxlength="50"
						placeholder="未設定"
						class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
					/>
					<button
						type="submit"
						disabled={savingName}
						class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 shrink-0"
					>
						{savingName ? '保存中...' : '保存'}
					</button>
				</div>
				{#if nameSuccessMsg}
					<p class="text-green-600 text-sm">{nameSuccessMsg}</p>
				{/if}
				{#if nameErrorMsg}
					<p class="text-red-500 text-sm">{nameErrorMsg}</p>
				{/if}
			</form>
		</div>
	{/if}

	<!-- パスワード変更（常に表示） -->
	<div class="bg-white p-6 rounded-xl shadow-sm border {mustChangePassword ? 'border-amber-300' : 'border-gray-100'}">
		<h2 class="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
			<ShieldAlert size={20} class="text-indigo-600" /> セキュリティ設定
		</h2>
		<form onsubmit={(e) => { e.preventDefault(); handleChangePassword(); }} class="space-y-4">
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1" for="new-pw">新しいパスワード</label>
				<input
					id="new-pw"
					type="password"
					bind:value={newPassword}
					class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
					required
					minlength="8"
				/>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1" for="confirm-pw">新しいパスワード（確認）</label>
				<input
					id="confirm-pw"
					type="password"
					bind:value={confirmPassword}
					class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
					required
					minlength="8"
				/>
			</div>
			{#if successMsg}
				<p class="text-green-600 text-sm">{successMsg}</p>
			{/if}
			{#if errorMsg}
				<p class="text-red-500 text-sm">{errorMsg}</p>
			{/if}
			<button
				type="submit"
				disabled={saving}
				class="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
			>
				{saving ? '変更中...' : 'パスワードを変更'}
			</button>
		</form>
	</div>

	<!-- 通知・ログアウト（通常時のみ） -->
	{#if !mustChangePassword}
		<div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
			<h2 class="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
				<Bell size={20} class="text-indigo-600" /> 通知設定
			</h2>
			{#if !pushSupported}
				<p class="text-sm text-gray-500">
					このブラウザでは通知を利用できません。iPhoneの場合はホーム画面に追加したアプリから開いてください。
				</p>
			{:else}
				<p class="text-sm text-gray-600 mb-4">
					締め切りが近づいたタスクや、今日締め切りのタスクをプッシュ通知でお知らせします。
				</p>
				{#if pushError}
					<p class="text-red-500 text-sm mb-3">{pushError}</p>
				{/if}
				<button
					onclick={togglePush}
					disabled={pushBusy}
					class="w-full py-2 rounded-lg font-semibold transition disabled:opacity-50 {pushEnabled
						? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
						: 'bg-indigo-600 text-white hover:bg-indigo-700'}"
				>
					{pushBusy ? '処理中...' : pushEnabled ? '通知をオフにする' : '通知をオンにする'}
				</button>
			{/if}
		</div>

		<div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
			<h2 class="text-lg font-bold text-gray-800 flex items-center gap-2 mb-2">
				<Link2 size={20} class="text-indigo-600" /> 外部連携（Obsidianなど）
			</h2>
			<p class="text-sm text-gray-600 mb-4">
				APIトークンを発行すると、タスク・予定をObsidianなどの外部ツールから定期取得できます。
			</p>

			{#if issuedToken}
				<div class="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4">
					<p class="text-xs font-semibold text-amber-800 mb-1.5">
						このトークンは今だけ表示されます。必ずコピーして保管してください。
					</p>
					<div class="flex items-center gap-2">
						<code class="flex-1 min-w-0 truncate text-xs bg-white border border-amber-200 rounded px-2 py-1.5 font-mono">{issuedToken}</code>
						<button
							onclick={copyToken}
							class="shrink-0 p-1.5 text-amber-700 hover:bg-amber-100 rounded transition"
							aria-label="コピー"
						>
							{#if copied}<Check size={16} />{:else}<Copy size={16} />{/if}
						</button>
					</div>
					<button
						onclick={() => (issuedToken = null)}
						class="text-xs text-amber-700 hover:underline mt-2"
					>
						閉じる
					</button>
				</div>
			{/if}

			{#if apiTokens.length > 0}
				<ul class="space-y-2 mb-4">
					{#each apiTokens as t (t.id)}
						<li class="flex items-center justify-between gap-2 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
							<div class="min-w-0">
								<p class="font-medium text-gray-800 truncate">{t.name}</p>
								<p class="text-xs text-gray-400">
									{t.last_used_at ? `最終使用: ${new Date(t.last_used_at).toLocaleDateString('ja-JP')}` : '未使用'}
								</p>
							</div>
							<button
								onclick={() => handleRevokeToken(t.id)}
								class="shrink-0 p-1.5 text-red-500 hover:bg-red-50 rounded transition"
								aria-label="失効"
								title="失効"
							>
								<Trash2 size={15} />
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if tokenError}
				<p class="text-red-500 text-sm mb-2">{tokenError}</p>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); handleCreateToken(); }} class="flex gap-2">
				<input
					type="text"
					bind:value={newTokenName}
					maxlength="100"
					placeholder="トークン名（例: Obsidian）"
					class="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
				/>
				<button
					type="submit"
					disabled={tokenBusy}
					class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 shrink-0"
				>
					{tokenBusy ? '発行中...' : '発行'}
				</button>
			</form>
		</div>

		<div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
			<h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
				<LogOut size={20} class="text-red-500" /> ログアウト
			</h2>
			<button
				onclick={handleLogout}
				class="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 py-2.5 rounded-lg font-semibold hover:bg-red-100 transition border border-red-200"
			>
				<LogOut size={18} /> アプリからログアウト
			</button>
		</div>
	{/if}

</div>
