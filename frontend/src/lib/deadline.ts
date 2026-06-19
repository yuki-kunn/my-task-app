// Deadlines are stored as JST wall-clock values serialized as if they were UTC
// (see backend/src/index.ts), so "now" must be expressed the same way for comparisons.
export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Returns inline CSS for a task card: white when far away, escalating to red as the deadline nears or passes. */
export function getDeadlineStyle(deadlineStr: string, isCompleted: boolean): string {
	if (isCompleted) return 'background-color: #f3f4f6; color: #9ca3af;';

	const now = Date.now() + JST_OFFSET_MS;
	const deadline = new Date(deadlineStr).getTime();
	const diffHours = (deadline - now) / (1000 * 60 * 60);

	if (diffHours <= 0) return 'background-color: #fee2e2; border-left: 6px solid #ef4444;';
	if (diffHours > 72) return 'background-color: #ffffff;';

	const ratio = diffHours / 72;
	const gAndB = Math.floor(200 + ratio * 55);
	return `background-color: rgb(255, ${gAndB}, ${gAndB}); border-left: 4px solid rgb(239, ${Math.floor(ratio * 68)}, ${Math.floor(ratio * 68)});`;
}

const MONTH_NAMES = [
	'1月', '2月', '3月', '4月', '5月', '6月',
	'7月', '8月', '9月', '10月', '11月', '12月'
];

/** Formats a stored deadline (JST wall-clock serialized as UTC) for display, without re-applying a timezone shift. */
export function formatDeadline(deadlineStr: string): string {
	const d = new Date(deadlineStr);
	const month = MONTH_NAMES[d.getUTCMonth()];
	const day = d.getUTCDate();
	const hours = String(d.getUTCHours()).padStart(2, '0');
	const minutes = String(d.getUTCMinutes()).padStart(2, '0');
	return `${month}${day}日 ${hours}:${minutes}`;
}
