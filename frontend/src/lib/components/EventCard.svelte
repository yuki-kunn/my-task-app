<script lang="ts">
	import { EVENT_COLOR_CLASSES, EVENT_DOT_COLOR } from '$lib/colors';
	import type { Event } from '$lib/types';
	import ItemCard from './ItemCard.svelte';

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

<ItemCard
	type="event"
	title={event.title}
	{dotClass}
	{colorClass}
	repeatType={event.repeat_type}
	startDt={event.start_dt}
	endDt={event.end_dt}
	memo={event.memo ?? ''}
	onEdit={() => onEdit(event)}
	onDelete={() => onDelete(event.id)}
/>
