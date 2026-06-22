<script lang="ts">
	import { Trash2, Edit, Calendar as Memo, RotateCw, Clock, FileText } from 'lucide-svelte';
	import { getDeadlineStyle, formatDeadline } from '$lib/deadline';
	import { REPEAT_LABEL } from '$lib/utils';

	type ItemCardProps = {
		type: 'task' | 'event';
		title: string;
		dotClass: string;
		dotStyle?: string;
		repeatType: string;
		// task-specific
		isCompleted?: boolean;
		deadline?: string;
		deadlineStyle?: string;
		colorClass?: string;
		cardStyle?: string;
		onToggle?: () => void;
		// event-specific
		startDt?: string;
		endDt?: string;
		memo?: string;
		// common
		onEdit: () => void;
		onDelete: () => void;
	};

	let {
		type,
		title,
		dotClass,
		dotStyle = '',
		repeatType,
		isCompleted = false,
		deadline = '',
		deadlineStyle = '',
		colorClass = '',
		cardStyle = '',
		onToggle,
		startDt = '',
		endDt = '',
		memo = '',
		onEdit,
		onDelete
	}: ItemCardProps = $props();

	const computedDeadlineStyle = $derived(
		type === 'task' && deadline ? getDeadlineStyle(deadline, isCompleted) : deadlineStyle
	);
	const mergedStyle = $derived(
		[computedDeadlineStyle, cardStyle].filter(Boolean).join('; ')
	);
</script>

<div
	style={mergedStyle}
	class="flex items-center justify-between p-4 rounded-xl bg-white shadow-sm border border-gray-100 transition
		{type === 'task' ? 'cursor-grab active:cursor-grabbing' : ''}
		{colorClass}"
>
	<div class="flex items-center gap-3 flex-1 min-w-0">
		{#if type === 'task' && onToggle}
			<input
				type="checkbox"
				checked={isCompleted}
				onchange={onToggle}
				class="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
				aria-label="完了にする"
			/>
		{/if}
		<div class="truncate flex-1">
			<p class="font-semibold text-gray-800 truncate {isCompleted && type === 'task' ? 'line-through text-gray-400' : ''} flex items-center gap-1.5">
				{#if dotClass || dotStyle}
					<span class="shrink-0 w-2.5 h-2.5 rounded-full {dotClass}" style={dotStyle}></span>
				{/if}
				{title}
			</p>

			{#if type === 'task'}
				<p class="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
					<Memo size={12} />
					{formatDeadline(deadline)}
					{#if repeatType !== 'none'}
						<span class="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] ml-1 flex items-center gap-0.5">
							<RotateCw size={10} />{REPEAT_LABEL[repeatType]}
						</span>
					{/if}
				</p>
			{:else}
				<div class="flex items-center gap-3 mt-1 flex-wrap">
					<span class="flex items-center gap-1 text-xs text-gray-500">
						<Clock size={11} />
						{formatDeadline(startDt)} 〜 {formatDeadline(endDt)}
					</span>
					{#if repeatType !== 'none'}
						<span class="flex items-center gap-0.5 text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
							<RotateCw size={9} />{REPEAT_LABEL[repeatType]}
						</span>
					{/if}
					{#if memo}
						<span class="flex items-center gap-0.5 text-[10px] text-gray-500">
							<FileText size={9} />{memo}
						</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="flex items-center gap-2 ml-4">
		<button
			onclick={onEdit}
			class="p-1.5 text-gray-400 hover:text-{type === 'task' ? 'indigo' : 'violet'}-600 hover:bg-gray-100 rounded-lg transition-colors"
			title="編集"
			aria-label="編集"
		>
			<Edit size={16} />
		</button>
		<button
			onclick={onDelete}
			class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors"
			title="削除"
			aria-label="削除"
		>
			<Trash2 size={16} />
		</button>
	</div>
</div>
