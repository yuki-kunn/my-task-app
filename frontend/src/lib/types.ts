export type RepeatType = 'none' | 'daily' | 'weekly' | 'yearly';

export interface Task {
	id: string;
	title: string;
	deadline: string;
	repeat_type: RepeatType;
	is_completed: boolean;
	sort_order: number;
}

export interface Event {
	id: string;
	title: string;
	start_dt: string;
	end_dt: string;
	memo?: string;
	repeat_type: RepeatType;
}

export type AiItemType = 'task' | 'event';

export interface AiItem {
	type: AiItemType;
	title: string;
	deadline?: string;
	start_dt?: string;
	end_dt?: string;
	memo?: string;
	repeat_type: RepeatType;
}
