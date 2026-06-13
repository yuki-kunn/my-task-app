<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createTask, updateTask, ApiError } from '$lib/api';
	import type { RepeatType, Task } from '$lib/types';

	let id = $state('');
	let title = $state('');
	let deadline = $state('');
	let repeat_type = $state<RepeatType>('none');
	let isEdit = $state(false);
	let errorMsg = $state('');
	let saving = $state(false);

	onMount(() => {
		const editData = sessionStorage.getItem('edit_task');
		const queryDate = sessionStorage.getItem('calendar_target_date');

		if (editData) {
			const task: Task = JSON.parse(editData);
			id = task.id;
			title = task.title;
			deadline = new Date(task.deadline).toISOString().slice(0, 16);
			repeat_type = task.repeat_type;
			isEdit = true;
			sessionStorage.removeItem('edit_task');
		} else {
			id = crypto.randomUUID();
			if (queryDate) {
				deadline = `${queryDate}T12:00`;
				sessionStorage.removeItem('calendar_target_date');
			} else {
				const now = new Date();
				now.setHours(now.getHours() + 1);
				deadline = now.toISOString().slice(0, 16);
			}
		}
	});

	async function saveTask() {
		if (!title.trim() || !deadline) {
			errorMsg = 'タスク名と締め切りを入力してください';
			return;
		}
		saving = true;
		errorMsg = '';
		try {
			if (isEdit) {
				await updateTask({ id, title, deadline, repeat_type, is_completed: false, sort_order: 0 });
			} else {
				await createTask({ id, title, deadline, repeat_type, is_completed: false });
			}
			await goto('/dashboard');
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '保存に失敗しました';
		} finally {
			saving = false;
		}
	}
</script>

<div class="max-w-lg mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
	<h2 class="text-xl font-bold text-gray-800 mb-6">{isEdit ? 'タスクを編集' : '新しくタスクを作成'}</h2>
	<form onsubmit={(e) => { e.preventDefault(); saveTask(); }} class="space-y-4">
		<div>
			<label class="block text-sm font-medium text-gray-700 mb-1" for="title">タスク名</label>
			<input
				id="title"
				type="text"
				bind:value={title}
				class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
				required
				placeholder="例: 牛乳を買う"
			/>
		</div>

		<div>
			<label class="block text-sm font-medium text-gray-700 mb-1" for="dl">締め切り日時</label>
			<input
				id="dl"
				type="datetime-local"
				bind:value={deadline}
				class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
				required
			/>
		</div>

		<div>
			<label class="block text-sm font-medium text-gray-700 mb-1" for="repeat">繰り返し設定</label>
			<select
				id="repeat"
				bind:value={repeat_type}
				class="w-full px-4 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
			>
				<option value="none">なし</option>
				<option value="daily">毎日</option>
				<option value="weekly">毎週 (この曜日)</option>
				<option value="yearly">毎年 (この月日)</option>
			</select>
			{#if repeat_type !== 'none'}
				<p class="text-xs text-gray-500 mt-1">完了にすると、この締め切りを基準に次回のタスクが自動作成されます。</p>
			{/if}
		</div>

		{#if errorMsg}
			<p class="text-red-500 text-sm">{errorMsg}</p>
		{/if}

		<div class="flex gap-3 pt-4">
			<button
				type="button"
				onclick={() => goto('/dashboard')}
				class="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-200 transition"
			>
				キャンセル
			</button>
			<button
				type="submit"
				disabled={saving}
				class="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
			>
				{saving ? '保存中...' : '保存'}
			</button>
		</div>
	</form>
</div>
