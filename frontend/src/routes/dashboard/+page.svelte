<script lang="ts">
	import { onMount } from 'svelte';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { Plus } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { fetchTasks, updateTask, deleteTask, reorderTasks, ApiError } from '$lib/api';
	import type { Task } from '$lib/types';
	import TaskCard from '$lib/components/TaskCard.svelte';

	let tasks: Task[] = $state([]);
	let loading = $state(true);
	let errorMsg = $state('');
	const flipDurationMs = 200;

	onMount(loadTasks);

	async function loadTasks() {
		loading = true;
		errorMsg = '';
		try {
			tasks = await fetchTasks();
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : 'タスクの取得に失敗しました';
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
			await loadTasks();
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '更新に失敗しました';
		}
	}

	async function removeTask(id: string) {
		if (!confirm('タスクを削除しますか？')) return;
		try {
			await deleteTask(id);
			await loadTasks();
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '削除に失敗しました';
		}
	}

	function editTask(task: Task) {
		sessionStorage.setItem('edit_task', JSON.stringify(task));
		goto('/task');
	}

	function createNew() {
		sessionStorage.removeItem('edit_task');
		goto('/task');
	}
</script>

<div class="space-y-6">
	<div class="flex justify-between items-center">
		<h2 class="text-2xl font-bold text-gray-800">タスク一覧</h2>
		<button
			onclick={createNew}
			class="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow"
		>
			<Plus size={18} /> タスク追加
		</button>
	</div>

	{#if errorMsg}
		<p class="text-red-500 text-sm">{errorMsg}</p>
	{/if}

	{#if loading}
		<p class="text-gray-400 text-center py-10">読み込み中...</p>
	{:else if tasks.length === 0}
		<p class="text-gray-400 text-center py-10">タスクはありません。右上の「タスク追加」から作成しましょう。</p>
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
</div>
