<script lang="ts">
	import { Trash2, Edit, Calendar as Memo, RotateCw } from 'lucide-svelte';
	import { getDeadlineStyle, formatDeadline } from '$lib/deadline';
	import { TASK_COLOR_CLASSES, TASK_DOT_COLOR } from '$lib/colors';
	import type { Task } from '$lib/types';

	const REPEAT_LABEL: Record<string, string> = {
		daily: '毎日',
		weekly: '毎週',
		yearly: '毎年'
	};

	let {
		task,
		onToggle,
		onEdit,
		onDelete
	}: {
		task: Task;
		onToggle: (task: Task) => void;
		onEdit: (task: Task) => void;
		onDelete: (id: string) => void;
	} = $props();

	const colorClass = $derived(
		task.color && TASK_COLOR_CLASSES[task.color] ? TASK_COLOR_CLASSES[task.color] : ''
	);
	const dotClass = $derived(
		task.color && TASK_DOT_COLOR[task.color] ? TASK_DOT_COLOR[task.color] : ''
	);
</script>

<div
	style={getDeadlineStyle(task.deadline, task.is_completed)}
	class="card-royal flex items-center justify-between px-4 py-3.5 cursor-grab active:cursor-grabbing
		{colorClass} {task.is_completed ? 'opacity-60' : ''}"
>
	<div class="flex items-center gap-3 flex-1 min-w-0">
		<input
			type="checkbox"
			checked={task.is_completed}
			onchange={() => onToggle(task)}
			class="w-4.5 h-4.5 rounded text-indigo-600 focus:ring-indigo-400 cursor-pointer shrink-0"
			aria-label="完了にする"
		/>
		<div class="truncate flex-1 min-w-0">
			<p class="font-medium text-[13.5px] text-gray-800 truncate
				{task.is_completed ? 'line-through text-gray-400' : ''}
				flex items-center gap-1.5"
				style="font-family:'Noto Serif JP',serif; letter-spacing:0.01em;">
				{#if dotClass}
					<span class="shrink-0 w-2 h-2 rounded-full {dotClass}"></span>
				{/if}
				{task.title}
			</p>
			<p class="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5" style="letter-spacing:0.02em;">
				<Memo size={11} />
				{formatDeadline(task.deadline)}
				{#if task.repeat_type !== 'none'}
					<span class="bg-indigo-50 text-indigo-500 border border-indigo-100 px-1.5 py-0.5 rounded text-[9px] ml-1 flex items-center gap-0.5 tracking-wide">
						<RotateCw size={9} />{REPEAT_LABEL[task.repeat_type]}
					</span>
				{/if}
			</p>
		</div>
	</div>

	<div class="flex items-center gap-1 ml-3 shrink-0">
		<button
			onclick={() => onEdit(task)}
			class="p-1.5 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
			title="編集"
			aria-label="編集"
		>
			<Edit size={14} />
		</button>
		<button
			onclick={() => onDelete(task.id)}
			class="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
			title="削除"
			aria-label="削除"
		>
			<Trash2 size={14} />
		</button>
	</div>
</div>
