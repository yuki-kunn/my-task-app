<script lang="ts">
	import { Trash2, Edit, Calendar as Memo, RotateCw } from 'lucide-svelte';
	import { getDeadlineStyle } from '$lib/deadline';
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
</script>

<div
	style={getDeadlineStyle(task.deadline, task.is_completed)}
	class="flex items-center justify-between p-4 rounded-xl shadow-sm border border-gray-100 bg-white transition-all cursor-grab active:cursor-grabbing"
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
			<p class="font-semibold text-gray-800 truncate {task.is_completed ? 'line-through' : ''}">
				{task.title}
			</p>
			<p class="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
				<Memo size={12} />
				{new Date(task.deadline).toLocaleString('ja-JP', {
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				})}
				{#if task.repeat_type !== 'none'}
					<span
						class="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] ml-1 flex items-center gap-0.5"
					>
						<RotateCw size={10} />{REPEAT_LABEL[task.repeat_type]}
					</span>
				{/if}
			</p>
		</div>
	</div>

	<div class="flex items-center gap-2 ml-4">
		<button
			onclick={() => onEdit(task)}
			class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg"
			title="編集"
			aria-label="編集"
		>
			<Edit size={16} />
		</button>
		<button
			onclick={() => onDelete(task.id)}
			class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg"
			title="削除"
			aria-label="削除"
		>
			<Trash2 size={16} />
		</button>
	</div>
</div>
