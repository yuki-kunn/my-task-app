<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ChevronLeft, ChevronRight, Plus, Clock, RotateCw, Edit } from 'lucide-svelte';
	import { fetchTasks, ApiError } from '$lib/api';
	import { formatDeadline } from '$lib/deadline';
	import type { Task } from '$lib/types';

	let tasks: Task[] = $state([]);
	let currentYear = $state(0);
	let currentMonth = $state(0);
	let selectedDateStr = $state('');
	let loading = $state(true);
	let errorMsg = $state('');

	onMount(async () => {
		// カレンダーから編集画面に遷移して戻ってきた際、?date= で選択日付を復元する
		const dateParam = page.url.searchParams.get('date');
		const now = new Date();
		const target = dateParam ? new Date(`${dateParam}T00:00:00`) : now;

		currentYear = target.getFullYear();
		currentMonth = target.getMonth();
		selectedDateStr = dateParam ?? toDateStr(now);
		await loadTasks();
	});

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

	function toDateStr(date: Date) {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function changeMonth(delta: number) {
		const date = new Date(currentYear, currentMonth + delta, 1);
		currentYear = date.getFullYear();
		currentMonth = date.getMonth();
	}

	// Leading blanks so the 1st lines up under its weekday (0 = Sunday).
	const leadingBlanks = $derived(new Date(currentYear, currentMonth, 1).getDay());
	const daysInMonth = $derived(
		Array.from({ length: new Date(currentYear, currentMonth + 1, 0).getDate() }, (_, i) => i + 1)
	);

	function dateStrFor(day: number) {
		const m = String(currentMonth + 1).padStart(2, '0');
		const d = String(day).padStart(2, '0');
		return `${currentYear}-${m}-${d}`;
	}

	function hasTaskOnDay(day: number) {
		const target = dateStrFor(day);
		return tasks.some((t) => t.deadline.startsWith(target));
	}

	function handleCreateFromCalendar() {
		sessionStorage.setItem('calendar_target_date', selectedDateStr);
		sessionStorage.setItem('calendar_return_date', selectedDateStr);
		goto('/task');
	}

	function editTask(task: Task) {
		sessionStorage.setItem('edit_task', JSON.stringify(task));
		sessionStorage.setItem('calendar_return_date', selectedDateStr);
		goto('/task');
	}

	const REPEAT_LABEL: Record<string, string> = {
		daily: '毎日',
		weekly: '毎週',
		yearly: '毎年'
	};

	const filteredTasks = $derived(tasks.filter((t) => t.deadline.startsWith(selectedDateStr)));
</script>

<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
	<div class="md:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
		<div class="flex justify-between items-center mb-4">
			<button onclick={() => changeMonth(-1)} class="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" aria-label="前の月">
				<ChevronLeft size={20} />
			</button>
			<h3 class="font-bold text-lg text-gray-700">{currentYear}年 {currentMonth + 1}月</h3>
			<button onclick={() => changeMonth(1)} class="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" aria-label="次の月">
				<ChevronRight size={20} />
			</button>
		</div>

		<div class="grid grid-cols-7 gap-2 text-center font-semibold text-xs text-gray-500 mb-2">
			<div>日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div>土</div>
		</div>

		<div class="grid grid-cols-7 gap-2">
			{#each Array(leadingBlanks) as _}
				<div></div>
			{/each}
			{#each daysInMonth as day}
				<button
					onclick={() => (selectedDateStr = dateStrFor(day))}
					class="aspect-square flex flex-col items-center justify-center rounded-lg text-sm border font-medium transition relative
						{selectedDateStr === dateStrFor(day) ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50 bg-gray-50 text-gray-700'}"
				>
					{day}
					{#if hasTaskOnDay(day)}
						<span class="w-1.5 h-1.5 rounded-full bg-red-400 absolute bottom-1"></span>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
		<div>
			<div class="flex justify-between items-center border-b pb-2 mb-3">
				<h3 class="font-bold text-gray-800">{selectedDateStr} のタスク</h3>
				<button
					onclick={handleCreateFromCalendar}
					class="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
					title="この日にタスクを作成"
					aria-label="この日にタスクを作成"
				>
					<Plus size={20} />
				</button>
			</div>

			{#if errorMsg}
				<p class="text-red-500 text-sm">{errorMsg}</p>
			{:else if loading}
				<p class="text-gray-400 text-sm text-center py-6">読み込み中...</p>
			{:else}
				<div class="space-y-2 max-h-[360px] overflow-y-auto">
					{#each filteredTasks as task}
						<div class="p-3 bg-gray-50 rounded-lg border text-sm group relative
							{task.is_completed ? 'opacity-60' : ''}">
							<div class="flex items-start justify-between gap-2">
								<p class="font-semibold text-gray-800 {task.is_completed ? 'line-through' : ''}">
									{task.title}
								</p>
								<button
									onclick={() => editTask(task)}
									class="shrink-0 p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
									aria-label="編集"
								>
									<Edit size={14} />
								</button>
							</div>
							<div class="flex items-center gap-3 mt-1.5 flex-wrap">
								<span class="flex items-center gap-1 text-xs text-gray-500">
									<Clock size={11} />
									{formatDeadline(task.deadline)}
								</span>
								{#if task.repeat_type !== 'none'}
									<span class="flex items-center gap-0.5 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
										<RotateCw size={9} />{REPEAT_LABEL[task.repeat_type]}
									</span>
								{/if}
								{#if task.is_completed}
									<span class="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">完了</span>
								{/if}
							</div>
						</div>
					{:else}
						<p class="text-gray-400 text-sm text-center py-6">この日のタスクはありません</p>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
