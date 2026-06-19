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

<div class="card-royal flex items-center justify-between px-4 py-3.5 {colorClass}"
	style="border-left: 3px solid rgba(139,92,246,0.35);">
	<div class="flex-1 min-w-0">
		<p class="font-medium text-[13.5px] text-gray-800 truncate flex items-center gap-1.5"
			style="font-family:'Noto Serif JP',serif; letter-spacing:0.01em;">
			<span class="shrink-0 w-2 h-2 rounded-full {dotClass}"></span>
			{event.title}
		</p>
		<div class="flex items-center gap-3 mt-1 flex-wrap">
			<span class="flex items-center gap-1 text-[11px] text-gray-400" style="letter-spacing:0.02em;">
				<Clock size={11} />
				{formatDeadline(event.start_dt)} 〜 {formatDeadline(event.end_dt)}
			</span>
			{#if event.repeat_type !== 'none'}
				<span class="flex items-center gap-0.5 text-[9px] bg-violet-50 text-violet-500 border border-violet-100 px-1.5 py-0.5 rounded tracking-wide">
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

	<div class="flex items-center gap-1 ml-3 shrink-0">
		<button
			onclick={() => onEdit(event)}
			class="p-1.5 text-gray-300 hover:text-violet-500 hover:bg-violet-50 rounded-lg transition-colors"
			title="編集"
			aria-label="編集"
		>
			<Edit size={14} />
		</button>
		<button
			onclick={() => onDelete(event.id)}
			class="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
			title="削除"
			aria-label="削除"
		>
			<Trash2 size={14} />
		</button>
	</div>
</div>
