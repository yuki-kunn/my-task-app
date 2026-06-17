<script lang="ts">
	let {
		value = $bindable<string | undefined>(undefined),
		type = 'task'
	}: {
		value?: string;
		type?: 'task' | 'event';
	} = $props();

	// [key, bg, border, label]
	const TASK_COLORS: [string, string, string, string][] = [
		['default', 'bg-white', 'border-gray-300', 'デフォルト'],
		['red',    'bg-red-100',    'border-red-400',    'レッド'],
		['orange', 'bg-orange-100', 'border-orange-400', 'オレンジ'],
		['yellow', 'bg-yellow-100', 'border-yellow-400', 'イエロー'],
		['green',  'bg-green-100',  'border-green-400',  'グリーン'],
		['blue',   'bg-blue-100',   'border-blue-400',   'ブルー'],
		['purple', 'bg-purple-100', 'border-purple-400', 'パープル'],
		['pink',   'bg-pink-100',   'border-pink-400',   'ピンク'],
	];

	const EVENT_COLORS: [string, string, string, string][] = [
		['default', 'bg-violet-50', 'border-violet-300', 'デフォルト'],
		['red',    'bg-red-100',    'border-red-400',    'レッド'],
		['orange', 'bg-orange-100', 'border-orange-400', 'オレンジ'],
		['yellow', 'bg-yellow-100', 'border-yellow-400', 'イエロー'],
		['green',  'bg-green-100',  'border-green-400',  'グリーン'],
		['blue',   'bg-blue-100',   'border-blue-400',   'ブルー'],
		['indigo', 'bg-indigo-100', 'border-indigo-400', 'インディゴ'],
		['pink',   'bg-pink-100',   'border-pink-400',   'ピンク'],
	];

	const colors = $derived(type === 'task' ? TASK_COLORS : EVENT_COLORS);

	function select(key: string) {
		value = key === 'default' ? undefined : key;
	}

	function isSelected(key: string) {
		return key === 'default' ? !value : value === key;
	}
</script>

<div>
	<p class="text-sm font-medium text-gray-700 mb-2">カラー（任意）</p>
	<div class="flex flex-wrap gap-2">
		{#each colors as [key, bg, border, label]}
			<button
				type="button"
				onclick={() => select(key)}
				title={label}
				aria-label={label}
				class="w-8 h-8 rounded-full border-2 transition-transform {bg} {border}
					{isSelected(key) ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}"
			></button>
		{/each}
	</div>
</div>
