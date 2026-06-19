<script lang="ts">
	import { getDeadlineStyle } from '$lib/deadline';
	import { TASK_COLOR_CLASSES, TASK_DOT_COLOR } from '$lib/colors';
	import type { Task } from '$lib/types';
	import ItemCard from './ItemCard.svelte';

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

<ItemCard
	type="task"
	title={task.title}
	{dotClass}
	{colorClass}
	repeatType={task.repeat_type}
	isCompleted={task.is_completed}
	deadline={task.deadline}
	deadlineStyle={getDeadlineStyle(task.deadline, task.is_completed)}
	onToggle={() => onToggle(task)}
	onEdit={() => onEdit(task)}
	onDelete={() => onDelete(task.id)}
/>
