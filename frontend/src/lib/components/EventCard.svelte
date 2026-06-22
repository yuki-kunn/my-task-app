<script lang="ts">
	import { EVENT_COLOR_CLASSES, EVENT_DOT_COLOR } from '$lib/colors';
	import type { Event } from '$lib/types';
	import type { UserColor } from '$lib/api';
	import ItemCard from './ItemCard.svelte';

	let {
		event,
		userColors = [],
		onEdit,
		onDelete
	}: {
		event: Event;
		userColors?: UserColor[];
		onEdit: (event: Event) => void;
		onDelete: (id: string) => void;
	} = $props();

	const customHex = $derived(() => {
		if (!event.color?.startsWith('custom:')) return null;
		const id = event.color.slice(7);
		return userColors.find((c) => c.id === id)?.hex ?? null;
	});

	const colorClass = $derived(
		customHex() ? '' : (event.color && EVENT_COLOR_CLASSES[event.color] ? EVENT_COLOR_CLASSES[event.color] : '')
	);
	const cardStyle = $derived(
		customHex() ? `background-color: ${customHex()}22; border-left: 3px solid ${customHex()}` : ''
	);
	const dotClass = $derived(
		customHex() ? '' : (event.color && EVENT_DOT_COLOR[event.color] ? EVENT_DOT_COLOR[event.color] : 'bg-violet-400')
	);
	const dotStyle = $derived(
		customHex() ? `background-color: ${customHex()}` : ''
	);
</script>

<ItemCard
	type="event"
	title={event.title}
	{dotClass}
	{dotStyle}
	{colorClass}
	{cardStyle}
	repeatType={event.repeat_type}
	startDt={event.start_dt}
	endDt={event.end_dt}
	memo={event.memo ?? ''}
	onEdit={() => onEdit(event)}
	onDelete={() => onDelete(event.id)}
/>
