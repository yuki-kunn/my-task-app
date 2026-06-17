<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createTask, updateTask, createEvent, updateEvent, ApiError } from '$lib/api';
	import type { RepeatType, Task, Event } from '$lib/types';

	type Mode = 'task' | 'event';

	let mode = $state<Mode>('task');
	let id = $state('');
	let title = $state('');
	let deadline = $state('');
	let start_dt = $state('');
	let end_dt = $state('');
	let all_day = $state(false);
	let all_day_date = $state('');
	let memo = $state('');
	let repeat_type = $state<RepeatType>('none');
	let isEdit = $state(false);
	let errorMsg = $state('');
	let saving = $state(false);
	let returnTo = $state('/dashboard');

	onMount(() => {
		const editTask = sessionStorage.getItem('edit_task');
		const editEvent = sessionStorage.getItem('edit_event');
		const queryDate = sessionStorage.getItem('calendar_target_date');
		const calendarReturnDate = sessionStorage.getItem('calendar_return_date');

		if (calendarReturnDate) {
			returnTo = `/calendar?date=${calendarReturnDate}`;
		}

		const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

		if (editTask) {
			const task: Task = JSON.parse(editTask);
			mode = 'task';
			id = task.id;
			title = task.title;
			deadline = new Date(task.deadline).toISOString().slice(0, 16);
			repeat_type = task.repeat_type;
			isEdit = true;
			sessionStorage.removeItem('edit_task');
		} else if (editEvent) {
			const event: Event = JSON.parse(editEvent);
			mode = 'event';
			id = event.id;
			title = event.title;
			const s = new Date(event.start_dt).toISOString().slice(0, 16);
			const e = new Date(event.end_dt).toISOString().slice(0, 16);
			// 終日判定: 開始が00:00で終了が23:59なら終日
			if (s.endsWith('T00:00') && e.endsWith('T23:59')) {
				all_day = true;
				all_day_date = s.slice(0, 10);
			} else {
				start_dt = s;
				end_dt = e;
			}
			memo = event.memo ?? '';
			repeat_type = event.repeat_type;
			isEdit = true;
			sessionStorage.removeItem('edit_event');
		} else {
			id = crypto.randomUUID();
			if (queryDate) {
				deadline = `${queryDate}T12:00`;
				start_dt = `${queryDate}T10:00`;
				end_dt = `${queryDate}T11:00`;
				all_day_date = queryDate;
				sessionStorage.removeItem('calendar_target_date');
			} else {
				const jstPlusOneHour = new Date(Date.now() + JST_OFFSET_MS + 60 * 60 * 1000);
				const base = jstPlusOneHour.toISOString().slice(0, 16);
				deadline = base;
				start_dt = base;
				all_day_date = base.slice(0, 10);
				const jstPlusTwoHours = new Date(Date.now() + JST_OFFSET_MS + 2 * 60 * 60 * 1000);
				end_dt = jstPlusTwoHours.toISOString().slice(0, 16);
			}
		}
	});

	async function save() {
		if (!title.trim()) {
			errorMsg = 'タイトルを入力してください';
			return;
		}
		if (mode === 'task' && !deadline) {
			errorMsg = '締め切り日時を入力してください';
			return;
		}
		if (mode === 'event' && all_day && !all_day_date) {
			errorMsg = '日付を入力してください';
			return;
		}
		if (mode === 'event' && !all_day && (!start_dt || !end_dt)) {
			errorMsg = '開始・終了日時を入力してください';
			return;
		}

		saving = true;
		errorMsg = '';
		try {
			if (mode === 'task') {
				if (isEdit) {
					await updateTask({ id, title, deadline, repeat_type, is_completed: false, sort_order: 0 });
				} else {
					await createTask({ id, title, deadline, repeat_type, is_completed: false });
				}
			} else {
				const s = all_day ? `${all_day_date}T00:00` : start_dt;
				const e = all_day ? `${all_day_date}T23:59` : end_dt;
				if (isEdit) {
					await updateEvent({ id, title, start_dt: s, end_dt: e, memo, repeat_type });
				} else {
					await createEvent({ id, title, start_dt: s, end_dt: e, memo, repeat_type });
				}
			}
			sessionStorage.removeItem('calendar_return_date');
			await goto(returnTo);
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '保存に失敗しました';
		} finally {
			saving = false;
		}
	}
</script>

<div class="max-w-lg mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6 overflow-hidden">
	<h2 class="text-xl font-bold text-gray-800 mb-4">
		{isEdit ? (mode === 'task' ? 'タスクを編集' : '予定を編集') : '新規作成'}
	</h2>

	{#if !isEdit}
		<div class="flex gap-2 mb-6">
			<button
				type="button"
				onclick={() => { mode = 'task'; }}
				class="flex-1 py-2 rounded-lg font-semibold text-sm transition
					{mode === 'task' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
			>
				タスク
			</button>
			<button
				type="button"
				onclick={() => { mode = 'event'; }}
				class="flex-1 py-2 rounded-lg font-semibold text-sm transition
					{mode === 'event' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
			>
				予定
			</button>
		</div>
	{/if}

	<form onsubmit={(e) => { e.preventDefault(); save(); }} class="space-y-4">
		<div>
			<label class="block text-sm font-medium text-gray-700 mb-1" for="title">
				{mode === 'task' ? 'タスク名' : '予定のタイトル'}
			</label>
			<input
				id="title"
				type="text"
				bind:value={title}
				class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
				required
				placeholder={mode === 'task' ? '例: 牛乳を買う' : '例: 打ち合わせ'}
			/>
		</div>

		{#if mode === 'task'}
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1" for="dl">締め切り日時</label>
				<input
					id="dl"
					type="datetime-local"
					bind:value={deadline}
					class="w-full box-border px-2 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
					required
				/>
			</div>
		{:else}
			<label class="flex items-center gap-2 cursor-pointer select-none w-fit">
				<input
					type="checkbox"
					bind:checked={all_day}
					class="w-4 h-4 text-violet-600 rounded cursor-pointer"
				/>
				<span class="text-sm font-medium text-gray-700">終日</span>
			</label>

			{#if all_day}
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1" for="all_day_date">日付</label>
					<input
						id="all_day_date"
						type="date"
						bind:value={all_day_date}
						class="w-full box-border px-2 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
						required
					/>
				</div>
			{:else}
				<div class="space-y-3">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1" for="start_dt">開始日時</label>
						<input
							id="start_dt"
							type="datetime-local"
							bind:value={start_dt}
							class="w-full box-border px-2 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
							required
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1" for="end_dt">終了日時</label>
						<input
							id="end_dt"
							type="datetime-local"
							bind:value={end_dt}
							class="w-full box-border px-2 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
							required
						/>
					</div>
				</div>
			{/if}
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1" for="memo">メモ（任意）</label>
				<textarea
					id="memo"
					bind:value={memo}
					rows={3}
					class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
					placeholder="場所・内容など"
				></textarea>
			</div>
		{/if}

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
			{#if repeat_type !== 'none' && mode === 'task'}
				<p class="text-xs text-gray-500 mt-1">完了にすると、次回のタスクが自動作成されます。</p>
			{/if}
			{#if repeat_type !== 'none' && mode === 'event'}
				<p class="text-xs text-gray-500 mt-1">終了日時が過ぎると、次回の予定が自動生成されます。</p>
			{/if}
		</div>

		{#if errorMsg}
			<p class="text-red-500 text-sm">{errorMsg}</p>
		{/if}

		<div class="flex gap-3 pt-4">
			<button
				type="button"
				onclick={() => { sessionStorage.removeItem('calendar_return_date'); goto(returnTo); }}
				class="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-200 transition"
			>
				キャンセル
			</button>
			<button
				type="submit"
				disabled={saving}
				class="flex-1 py-2 rounded-lg font-semibold transition disabled:opacity-50
					{mode === 'task' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-violet-600 text-white hover:bg-violet-700'}"
			>
				{saving ? '保存中...' : '保存'}
			</button>
		</div>
	</form>
</div>
