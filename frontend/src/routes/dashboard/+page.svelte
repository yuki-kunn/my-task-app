<script lang="ts">
	import { onMount } from 'svelte';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { Plus } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { fetchTasks, updateTask, deleteTask, reorderTasks, fetchEvents, deleteEvent, ApiError } from '$lib/api';
	import type { Task, Event } from '$lib/types';
	import TaskCard from '$lib/components/TaskCard.svelte';
	import EventCard from '$lib/components/EventCard.svelte';

	type Tab = 'task' | 'event';

	let tab = $state<Tab>('task');
	let tasks: Task[] = $state([]);
	let events: Event[] = $state([]);
	let loading = $state(true);
	let errorMsg = $state('');
	const flipDurationMs = 200;

	onMount(loadAll);

	async function loadAll() {
		loading = true;
		errorMsg = '';
		try {
			[tasks, events] = await Promise.all([fetchTasks(), fetchEvents()]);
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : 'データの取得に失敗しました';
		} finally {
			loading = false;
		}
	}

	function handleDndConsider(e: CustomEvent<{ items: Task[] }>) {
		tasks = e.detail.items;
	}

	async function handleDndFinalize(e: CustomEvent<{ items: Task[] }>) {
		tasks = e.detail.items;
		const orders = tasks.map((task, index) => ({ id: task.id, sort_order: index }));
		try {
			await reorderTasks(orders);
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '並び替えの保存に失敗しました';
		}
	}

	async function toggleComplete(task: Task) {
		const updated = { ...task, is_completed: !task.is_completed };
		try {
			await updateTask(updated);
			await loadAll();
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '更新に失敗しました';
		}
	}

	async function removeTask(id: string) {
		if (!confirm('タスクを削除しますか？')) return;
		try {
			await deleteTask(id);
			await loadAll();
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '削除に失敗しました';
		}
	}

	async function removeEvent(id: string) {
		if (!confirm('予定を削除しますか？')) return;
		try {
			await deleteEvent(id);
			await loadAll();
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '削除に失敗しました';
		}
	}

	function editTask(task: Task) {
		sessionStorage.setItem('edit_task', JSON.stringify(task));
		goto('/task');
	}

	function editEvent(event: Event) {
		sessionStorage.setItem('edit_event', JSON.stringify(event));
		goto('/task');
	}

	function createNew() {
		sessionStorage.removeItem('edit_task');
		sessionStorage.removeItem('edit_event');
		goto('/task');
	}
</script>

<div class="space-y-5">
	<div class="flex justify-between items-center">
		<div class="flex gap-0.5 bg-white/70 backdrop-blur-sm p-1 rounded-xl border border-indigo-100/60 shadow-sm">
			<button
				onclick={() => { tab = 'task'; }}
				class="px-5 py-1.5 rounded-lg text-[12px] tracking-wider transition-all duration-200
					{tab === 'task'
						? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-200'
						: 'text-gray-400 hover:text-gray-600'}"
				style="font-family:'Noto Serif JP',serif;"
			>
				タスク
			</button>
			<button
				onclick={() => { tab = 'event'; }}
				class="px-5 py-1.5 rounded-lg text-[12px] tracking-wider transition-all duration-200
					{tab === 'event'
						? 'bg-gradient-to-r from-violet-600 to-violet-700 text-white shadow-md shadow-violet-200'
						: 'text-gray-400 hover:text-gray-600'}"
				style="font-family:'Noto Serif JP',serif;"
			>
				予定
			</button>
		</div>
		<button
			onclick={createNew}
			class="btn-royal flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] tracking-wider"
		>
			<Plus size={16} /> 追加
		</button>
	</div>

	{#if errorMsg}
		<p class="text-red-500 text-sm">{errorMsg}</p>
	{/if}

	{#if loading}
		<p class="text-gray-400 text-center py-10">読み込み中...</p>
	{:else if tab === 'task'}
		{#if tasks.length === 0}
			<p class="text-gray-400 text-center py-10">タスクはありません。右上の「追加」から作成しましょう。</p>
		{:else}
			<section
				use:dndzone={{ items: tasks, flipDurationMs }}
				onconsider={handleDndConsider}
				onfinalize={handleDndFinalize}
				class="space-y-3 min-h-[200px]"
			>
				{#each tasks as task (task.id)}
					<div animate:flip={{ duration: flipDurationMs }}>
						<TaskCard {task} onToggle={toggleComplete} onEdit={editTask} onDelete={removeTask} />
					</div>
				{/each}
			</section>
		{/if}
	{:else}
		{#if events.length === 0}
			<p class="text-gray-400 text-center py-10">予定はありません。右上の「追加」から作成しましょう。</p>
		{:else}
			<div class="space-y-3">
				{#each events as event (event.id)}
					<EventCard {event} onEdit={editEvent} onDelete={removeEvent} />
				{/each}
			</div>
		{/if}
	{/if}
</div>
