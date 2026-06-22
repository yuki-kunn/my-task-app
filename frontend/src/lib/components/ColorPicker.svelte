<script lang="ts">
	import { Trash2, Plus } from 'lucide-svelte';
	import type { UserColor } from '$lib/api';

	let {
		value = $bindable<string | undefined>(undefined),
		type = 'task',
		userColors = [],
		onAddColor,
		onDeleteColor
	}: {
		value?: string;
		type?: 'task' | 'event';
		userColors?: UserColor[];
		onAddColor?: (hex: string, name: string) => Promise<void>;
		onDeleteColor?: (id: string) => Promise<void>;
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

	function isCustomSelected(id: string) {
		return value === `custom:${id}`;
	}

	function selectCustom(id: string) {
		value = `custom:${id}`;
	}

	let showAdd = $state(false);
	let newHex = $state('#6366f1');
	let newName = $state('');
	let adding = $state(false);

	async function handleAdd() {
		if (!onAddColor) return;
		adding = true;
		try {
			await onAddColor(newHex, newName.trim());
			newName = '';
			showAdd = false;
		} finally {
			adding = false;
		}
	}

	async function handleDelete(id: string, e: MouseEvent) {
		e.stopPropagation();
		if (!onDeleteColor) return;
		if (value === `custom:${id}`) value = undefined;
		await onDeleteColor(id);
	}
</script>

<div>
	<p class="text-sm font-medium text-gray-700 mb-2">カラー（任意）</p>

	<!-- Preset colors -->
	<div class="flex flex-wrap gap-2 mb-3">
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

	<!-- User custom colors -->
	{#if userColors.length > 0 || onAddColor}
		<div class="border-t border-gray-100 pt-2">
			<p class="text-xs text-gray-500 mb-2">マイカラー</p>
			<div class="flex flex-wrap gap-2 items-center">
				{#each userColors as uc}
					<div class="relative group">
						<button
							type="button"
							onclick={() => selectCustom(uc.id)}
							title={uc.name || uc.hex}
							aria-label={uc.name || uc.hex}
							style="background-color: {uc.hex}; border-color: {uc.hex};"
							class="w-8 h-8 rounded-full border-2 transition-transform
								{isCustomSelected(uc.id) ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}"
						></button>
						{#if onDeleteColor}
							<button
								type="button"
								onclick={(e) => handleDelete(uc.id, e)}
								class="absolute -top-1 -right-1 hidden group-hover:flex w-4 h-4 bg-red-500 text-white rounded-full items-center justify-center"
								aria-label="削除"
							>
								<Trash2 size={8} />
							</button>
						{/if}
					</div>
				{/each}

				{#if onAddColor}
					<button
						type="button"
						onclick={() => (showAdd = !showAdd)}
						class="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition"
						aria-label="カラーを追加"
						title="カラーを追加"
					>
						<Plus size={14} />
					</button>
				{/if}
			</div>

			{#if showAdd}
				<div class="mt-2 flex items-center gap-2 flex-wrap">
					<input
						type="color"
						bind:value={newHex}
						class="w-9 h-9 rounded cursor-pointer border border-gray-200 p-0.5"
					/>
					<input
						type="text"
						bind:value={newName}
						placeholder="名前（任意）"
						maxlength="50"
						class="flex-1 min-w-0 px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
					/>
					<button
						type="button"
						onclick={handleAdd}
						disabled={adding}
						class="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
					>
						追加
					</button>
					<button
						type="button"
						onclick={() => (showAdd = false)}
						class="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
					>
						閉じる
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
