<script lang="ts">
	import { LogOut, ShieldAlert } from 'lucide-svelte';
	import { changePassword, clearToken, ApiError } from '$lib/api';

	let newPassword = $state('');
	let confirmPassword = $state('');
	let successMsg = $state('');
	let errorMsg = $state('');
	let saving = $state(false);

	async function handleChangePassword() {
		successMsg = '';
		errorMsg = '';

		if (newPassword.length < 4) {
			errorMsg = 'パスワードは4文字以上にしてください';
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
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '変更に失敗しました';
		} finally {
			saving = false;
		}
	}

	function handleLogout() {
		clearToken();
		window.location.href = '/';
	}
</script>

<div class="max-w-md mx-auto space-y-6 mt-6">
	<div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
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
					minlength="4"
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
					minlength="4"
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

	<div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
		<h2 class="text-lg font-bold text-gray-800 mb-4">アカウント</h2>
		<button
			onclick={handleLogout}
			class="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 py-2.5 rounded-lg font-semibold hover:bg-red-100 transition border border-red-200"
		>
			<LogOut size={18} /> アプリからログアウト
		</button>
	</div>
</div>
