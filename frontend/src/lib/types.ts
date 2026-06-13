export type RepeatType = 'none' | 'daily' | 'weekly' | 'yearly';

export interface Task {
	id: string;
	title: string;
	deadline: string;
	repeat_type: RepeatType;
	is_completed: boolean;
	sort_order: number;
}
