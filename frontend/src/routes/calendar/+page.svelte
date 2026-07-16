<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ChevronLeft, ChevronRight, Plus, Clock, RotateCw, Edit, Trash2, FileText } from 'lucide-svelte';
	import { fetchTasks, fetchEvents, fetchUserColors, deleteTask, deleteEvent, ApiError } from '$lib/api';
	import type { UserColor } from '$lib/api';
	import { formatDeadline } from '$lib/deadline';
	import { TASK_DOT_COLOR, EVENT_DOT_COLOR, TASK_COLOR_CLASSES, EVENT_COLOR_CLASSES } from '$lib/colors';
	import { REPEAT_LABEL } from '$lib/utils';
	import type { Task, Event } from '$lib/types';

	let tasks: Task[] = $state([]);
	let events: Event[] = $state([]);
	let userColors = $state<UserColor[]>([]);
	let currentYear = $state(0);
	let currentMonth = $state(0);
	let selectedDateStr = $state('');
	let loading = $state(true);
	let errorMsg = $state('');

	onMount(async () => {
		const dateParam = page.url.searchParams.get('date');
		const now = new Date();
		const target = dateParam ? new Date(`${dateParam}T00:00:00`) : now;

		currentYear = target.getFullYear();
		currentMonth = target.getMonth();
		selectedDateStr = dateParam ?? toDateStr(now);
		await loadData();
	});

	async function loadData() {
		loading = true;
		errorMsg = '';
		try {
			[[tasks, events], userColors] = await Promise.all([
				Promise.all([fetchTasks(), fetchEvents()]),
				fetchUserColors().catch(() => [])
			]);
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : 'データの取得に失敗しました';
		} finally {
			loading = false;
		}
	}

	function resolveCustomHex(color: string | null | undefined, type: 'task' | 'event'): string | null {
		if (!color?.startsWith('custom:')) return null;
		const id = color.slice(7);
		return userColors.find((c) => c.id === id)?.hex ?? null;
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

	function hasEventOnDay(day: number) {
		const target = dateStrFor(day);
		return events.some((e) => e.start_dt.startsWith(target));
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

	async function removeTask(id: string) {
		if (!confirm('タスクを削除しますか？')) return;
		try {
			await deleteTask(id);
			await loadData();
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '削除に失敗しました';
		}
	}

	async function removeEvent(id: string) {
		if (!confirm('予定を削除しますか？')) return;
		try {
			await deleteEvent(id);
			await loadData();
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '削除に失敗しました';
		}
	}

	function editEvent(event: Event) {
		sessionStorage.setItem('edit_event', JSON.stringify(event));
		sessionStorage.setItem('calendar_return_date', selectedDateStr);
		goto('/task');
	}

	const filteredTasks = $derived(tasks.filter((t) => t.deadline.startsWith(selectedDateStr)));
	const filteredEvents = $derived(events.filter((e) => e.start_dt.startsWith(selectedDateStr)));
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
					<span class="flex gap-0.5 absolute bottom-1">
						{#each tasks.filter(t => t.deadline.startsWith(dateStrFor(day))).slice(0,3) as t}
							{@const ch = resolveCustomHex(t.color, 'task')}
							<span
								class="w-1.5 h-1.5 rounded-full {ch ? '' : (t.color && TASK_DOT_COLOR[t.color] ? TASK_DOT_COLOR[t.color] : 'bg-red-400')}"
								style={ch ? `background-color:${ch}` : ''}
							></span>
						{/each}
						{#each events.filter(e => e.start_dt.startsWith(dateStrFor(day))).slice(0,2) as e}
							{@const ch = resolveCustomHex(e.color, 'event')}
							<span
								class="w-1.5 h-1.5 rounded-full {ch ? '' : (e.color && EVENT_DOT_COLOR[e.color] ? EVENT_DOT_COLOR[e.color] : 'bg-violet-400')}"
								style={ch ? `background-color:${ch}` : ''}
							></span>
						{/each}
					</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
		<div>
			<div class="flex justify-between items-center border-b pb-2 mb-3">
				<h3 class="font-bold text-gray-800">{selectedDateStr}</h3>
				<button
					onclick={handleCreateFromCalendar}
					class="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
					title="この日に追加"
					aria-label="この日に追加"
				>
					<Plus size={20} />
				</button>
			</div>

			{#if errorMsg}
				<p class="text-red-500 text-sm">{errorMsg}</p>
			{:else if loading}
				<p class="text-gray-400 text-sm text-center py-6">読み込み中...</p>
			{:else}
				<div class="space-y-2 max-h-[400px] overflow-y-auto">
					{#each filteredTasks as task}
						{@const tch = resolveCustomHex(task.color, 'task')}
						<div
							class="p-3 rounded-lg border text-sm
								{tch ? '' : (task.color && TASK_COLOR_CLASSES[task.color] ? TASK_COLOR_CLASSES[task.color] : 'bg-gray-50 border-gray-200')}
								{task.is_completed ? 'opacity-60' : ''}"
							style={tch ? `background-color:${tch}22; border-left:3px solid ${tch}` : ''}
						>
							<div class="flex items-start justify-between gap-2">
								<div class="flex items-start gap-1.5 flex-1 min-w-0">
									<span
										class="mt-1 shrink-0 w-2.5 h-2.5 rounded-full {tch ? '' : (task.color && TASK_DOT_COLOR[task.color] ? TASK_DOT_COLOR[task.color] : 'bg-red-400')}"
										style={tch ? `background-color:${tch}` : ''}
									></span>
									<p class="font-semibold text-gray-800 {task.is_completed ? 'line-through' : ''} break-words">
										{task.title}
									</p>
								</div>
								<div class="flex items-center gap-1 shrink-0">
									<button
										onclick={() => editTask(task)}
										class="p-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 rounded transition"
										aria-label="編集"
									>
										<Edit size={16} />
									</button>
									<button
										onclick={() => removeTask(task.id)}
										class="p-1 text-red-500 hover:text-red-600 hover:bg-red-100 rounded transition"
										aria-label="削除"
									>
										<Trash2 size={16} />
									</button>
								</div>
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
					{/each}

					{#each filteredEvents as event}
						{@const ech = resolveCustomHex(event.color, 'event')}
						<div
							class="p-3 rounded-lg border text-sm
								{ech ? '' : (event.color && EVENT_COLOR_CLASSES[event.color] ? EVENT_COLOR_CLASSES[event.color] : 'bg-violet-50 border-violet-100')}"
							style={ech ? `background-color:${ech}22; border-left:3px solid ${ech}` : ''}
						>
							<div class="flex items-start justify-between gap-2">
								<div class="flex items-start gap-1.5 flex-1 min-w-0">
									<span
										class="mt-1 shrink-0 w-2.5 h-2.5 rounded-full {ech ? '' : (event.color && EVENT_DOT_COLOR[event.color] ? EVENT_DOT_COLOR[event.color] : 'bg-violet-400')}"
										style={ech ? `background-color:${ech}` : ''}
									></span>
									<p class="font-semibold text-gray-800 break-words">{event.title}</p>
								</div>
								<div class="flex items-center gap-1 shrink-0">
									<button
										onclick={() => editEvent(event)}
										class="p-1 text-violet-600 hover:text-violet-700 hover:bg-violet-200 rounded transition"
										aria-label="編集"
									>
										<Edit size={16} />
									</button>
									<button
										onclick={() => removeEvent(event.id)}
										class="p-1 text-red-500 hover:text-red-600 hover:bg-red-100 rounded transition"
										aria-label="削除"
									>
										<Trash2 size={16} />
									</button>
								</div>
							</div>
							<div class="flex items-center gap-3 mt-1.5 flex-wrap">
								<span class="flex items-center gap-1 text-xs text-gray-500">
									<Clock size={11} />
									{formatDeadline(event.start_dt)} 〜 {formatDeadline(event.end_dt)}
								</span>
								{#if event.repeat_type !== 'none'}
									<span class="flex items-center gap-0.5 text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
										<RotateCw size={9} />{REPEAT_LABEL[event.repeat_type]}
									</span>
								{/if}
								{#if event.memo}
									<span class="flex items-center gap-0.5 text-[10px] text-gray-400">
										<FileText size={9} />{event.memo}
									</span>
								{/if}
							</div>
						</div>
					{/each}

					{#if filteredTasks.length === 0 && filteredEvents.length === 0}
						<p class="text-gray-400 text-sm text-center py-6">この日のタスク・予定はありません</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
