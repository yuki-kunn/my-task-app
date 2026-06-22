<script lang="ts">
	import { getDeadlineStyle } from '$lib/deadline';
	import { TASK_COLOR_CLASSES, TASK_DOT_COLOR } from '$lib/colors';
	import type { Task } from '$lib/types';
	import type { UserColor } from '$lib/api';
	import ItemCard from './ItemCard.svelte';

	let {
		task,
		userColors = [],
		onToggle,
		onEdit,
		onDelete
	}: {
		task: Task;
		userColors?: UserColor[];
		onToggle: (task: Task) => void;
		onEdit: (task: Task) => void;
		onDelete: (id: string) => void;
	} = $props();

	const customHex = $derived(() => {
		if (!task.color?.startsWith('custom:')) return null;
		const id = task.color.slice(7);
		return userColors.find((c) => c.id === id)?.hex ?? null;
	});

	const colorClass = $derived(
		customHex() ? '' : (task.color && TASK_COLOR_CLASSES[task.color] ? TASK_COLOR_CLASSES[task.color] : '')
	);
	const cardStyle = $derived(
		customHex() ? `background-color: ${customHex()}22; border-left: 3px solid ${customHex()}` : ''
	);
	const dotClass = $derived(
		customHex() ? '' : (task.color && TASK_DOT_COLOR[task.color] ? TASK_DOT_COLOR[task.color] : '')
	);
	const dotStyle = $derived(
		customHex() ? `background-color: ${customHex()}` : ''
	);
</script>

<ItemCard
	type="task"
	title={task.title}
	{dotClass}
	{dotStyle}
	{colorClass}
	{cardStyle}
	repeatType={task.repeat_type}
	isCompleted={task.is_completed}
	deadline={task.deadline}
	deadlineStyle={getDeadlineStyle(task.deadline, task.is_completed)}
	onToggle={() => onToggle(task)}
	onEdit={() => onEdit(task)}
	onDelete={() => onDelete(task.id)}
/>
