// Left border accent color for task/event cards (used alongside deadline style)
export const TASK_COLOR_CLASSES: Record<string, string> = {
	red:    'border-l-4 border-l-red-400',
	orange: 'border-l-4 border-l-orange-400',
	yellow: 'border-l-4 border-l-yellow-400',
	green:  'border-l-4 border-l-green-400',
	blue:   'border-l-4 border-l-blue-400',
	purple: 'border-l-4 border-l-purple-400',
	pink:   'border-l-4 border-l-pink-400',
};

export const EVENT_COLOR_CLASSES: Record<string, string> = {
	red:    'border-l-4 border-l-red-400',
	orange: 'border-l-4 border-l-orange-400',
	yellow: 'border-l-4 border-l-yellow-400',
	green:  'border-l-4 border-l-green-400',
	blue:   'border-l-4 border-l-blue-400',
	indigo: 'border-l-4 border-l-indigo-400',
	pink:   'border-l-4 border-l-pink-400',
};

// Dot colors for calendar indicators
export const TASK_DOT_COLOR: Record<string, string> = {
	red:    'bg-red-400',
	orange: 'bg-orange-400',
	yellow: 'bg-yellow-400',
	green:  'bg-green-400',
	blue:   'bg-blue-400',
	purple: 'bg-purple-400',
	pink:   'bg-pink-400',
};

export const EVENT_DOT_COLOR: Record<string, string> = {
	red:    'bg-red-400',
	orange: 'bg-orange-400',
	yellow: 'bg-yellow-400',
	green:  'bg-green-400',
	blue:   'bg-blue-400',
	indigo: 'bg-indigo-400',
	pink:   'bg-pink-400',
};

/** Returns the border-accent CSS class for a card, based on color and type. */
export function getColorClass(color: string | null | undefined, type: 'task' | 'event'): string {
	if (!color) return '';
	const map = type === 'task' ? TASK_COLOR_CLASSES : EVENT_COLOR_CLASSES;
	return map[color] ?? '';
}

/** Returns the dot CSS class for a calendar indicator, based on color and type. */
export function getDotClass(color: string | null | undefined, type: 'task' | 'event'): string {
	if (!color) return '';
	const map = type === 'task' ? TASK_DOT_COLOR : EVENT_DOT_COLOR;
	return map[color] ?? '';
}
