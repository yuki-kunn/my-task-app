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
	class="flex items-center justify-between p-4 rounded-xl bg-white shadow-sm border border-gray-100 transition cursor-grab active:cursor-grabbing
		{colorClass}"
>
	<div class="flex items-center gap-3 flex-1 min-w-0">
		<input
			type="checkbox"
			checked={task.is_completed}
			onchange={() => onToggle(task)}
			class="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
			aria-label="完了にする"
		/>
		<div class="truncate flex-1">
			<p class="font-semibold text-gray-800 truncate {task.is_completed ? 'line-through text-gray-400' : ''} flex items-center gap-1.5">
				{#if dotClass}
					<span class="shrink-0 w-2.5 h-2.5 rounded-full {dotClass}"></span>
				{/if}
				{task.title}
			</p>
			<p class="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
				<Memo size={12} />
				{formatDeadline(task.deadline)}
				{#if task.repeat_type !== 'none'}
					<span class="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] ml-1 flex items-center gap-0.5">
						<RotateCw size={10} />{REPEAT_LABEL[task.repeat_type]}
					</span>
				{/if}
			</p>
		</div>
	</div>

	<div class="flex items-center gap-2 ml-4">
		<button
			onclick={() => onEdit(task)}
			class="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors"
			title="編集"
			aria-label="編集"
		>
			<Edit size={16} />
		</button>
		<button
			onclick={() => onDelete(task.id)}
			class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors"
			title="削除"
			aria-label="削除"
		>
			<Trash2 size={16} />
		</button>
	</div>
</div>
