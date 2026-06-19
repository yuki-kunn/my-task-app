<script lang="ts">
	import { Edit, Trash2, Clock, RotateCw, FileText } from 'lucide-svelte';
	import { formatDeadline } from '$lib/deadline';
	import { EVENT_COLOR_CLASSES, EVENT_DOT_COLOR } from '$lib/colors';
	import type { Event } from '$lib/types';

	const REPEAT_LABEL: Record<string, string> = {
		daily: '毎日',
		weekly: '毎週',
		yearly: '毎年'
	};

	let {
		event,
		onEdit,
		onDelete
	}: {
		event: Event;
		onEdit: (event: Event) => void;
		onDelete: (id: string) => void;
	} = $props();

	const colorClass = $derived(
		event.color && EVENT_COLOR_CLASSES[event.color] ? EVENT_COLOR_CLASSES[event.color] : ''
	);
	const dotClass = $derived(
		event.color && EVENT_DOT_COLOR[event.color] ? EVENT_DOT_COLOR[event.color] : 'bg-violet-400'
	);
</script>

<div class="flex items-center justify-between p-4 rounded-xl bg-white shadow-sm border border-gray-100 transition {colorClass}">
	<div class="flex-1 min-w-0">
		<p class="font-semibold text-gray-800 truncate flex items-center gap-1.5">
			<span class="shrink-0 w-2.5 h-2.5 rounded-full {dotClass}"></span>
			{event.title}
		</p>
		<div class="flex items-center gap-3 mt-1 flex-wrap">
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
				<span class="flex items-center gap-0.5 text-[10px] text-gray-500">
					<FileText size={9} />{event.memo}
				</span>
			{/if}
		</div>
	</div>

	<div class="flex items-center gap-2 ml-4">
		<button
			onclick={() => onEdit(event)}
			class="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-gray-100 rounded-lg transition-colors"
			title="編集"
			aria-label="編集"
		>
			<Edit size={16} />
		</button>
		<button
			onclick={() => onDelete(event.id)}
			class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors"
			title="削除"
			aria-label="削除"
		>
			<Trash2 size={16} />
		</button>
	</div>
</div>
