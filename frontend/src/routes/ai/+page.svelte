<script lang="ts">
	import { Sparkles, Loader, Plus, Edit2, Trash2 } from 'lucide-svelte';
	import { parseAiText, createTask, createEvent, ApiError } from '$lib/api';
	import type { AiItem } from '$lib/types';

	type Mode = 'simple' | 'organize';
	type Candidate = AiItem & { selected: boolean; editing: boolean };

	let inputText = $state('');
	let mode = $state<Mode>('simple');
	let parsing = $state(false);
	let saving = $state(false);
	let errorMsg = $state('');
	let successMsg = $state('');
	let candidates = $state<Candidate[]>([]);
	let usedCount = $state<number | null>(null);
	let dailyLimit = $state<number | null>(null);

	const remaining = $derived(
		dailyLimit !== null && usedCount !== null ? dailyLimit - usedCount : null
	);
	const limitReached = $derived(remaining !== null && remaining <= 0);

	async function parse() {
		if (!inputText.trim()) {
			errorMsg = 'テキストを入力してください';
			return;
		}
		parsing = true;
		errorMsg = '';
		successMsg = '';
		candidates = [];
		try {
			const res = await parseAiText(inputText, mode);
			candidates = res.items.map((item) => ({ ...item, selected: true, editing: false }));
			if (res.used !== null) usedCount = res.used;
			if (res.limit !== null) dailyLimit = res.limit;
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : 'AI解析に失敗しました';
		} finally {
			parsing = false;
		}
	}

	async function registerSelected() {
		const selected = candidates.filter((c) => c.selected);
		if (selected.length === 0) {
			errorMsg = '登録するアイテムを選択してください';
			return;
		}
		saving = true;
		errorMsg = '';
		try {
			for (const item of selected) {
				if (item.type === 'task') {
					await createTask({
						id: crypto.randomUUID(),
						title: item.title,
						deadline: item.deadline ?? new Date().toISOString().slice(0, 16),
						repeat_type: item.repeat_type,
						is_completed: false
					});
				} else {
					await createEvent({
						id: crypto.randomUUID(),
						title: item.title,
						start_dt: item.start_dt ?? new Date().toISOString().slice(0, 16),
						end_dt: item.end_dt ?? new Date().toISOString().slice(0, 16),
						memo: item.memo,
						repeat_type: item.repeat_type
					});
				}
			}
			successMsg = `${selected.length}件を登録しました`;
			candidates = [];
			inputText = '';
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '登録に失敗しました';
		} finally {
			saving = false;
		}
	}

	function toggleSelect(i: number) {
		candidates[i].selected = !candidates[i].selected;
	}

	function toggleEdit(i: number) {
		candidates[i].editing = !candidates[i].editing;
	}

	function removeCandidate(i: number) {
		candidates = candidates.filter((_, idx) => idx !== i);
	}
</script>

<div class="max-w-2xl mx-auto space-y-6">
	<div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
		<div class="flex items-center justify-between mb-4">
			<div class="flex items-center gap-2">
				<Sparkles size={22} class="text-indigo-500" />
				<h2 class="text-xl font-bold text-gray-800">AI登録</h2>
			</div>
			<!-- 残回数バッジ -->
			{#if dailyLimit !== null && usedCount !== null}
				<span class="text-xs px-2.5 py-1 rounded-full font-medium
					{limitReached
						? 'bg-red-100 text-red-600'
						: remaining !== null && remaining <= 3
							? 'bg-amber-100 text-amber-700'
							: 'bg-indigo-50 text-indigo-500'}">
					本日 {usedCount}/{dailyLimit} 回使用
				</span>
			{/if}
		</div>

		{#if limitReached}
			<div class="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
				<span class="text-red-500 shrink-0 mt-0.5">⚠</span>
				<p class="text-sm text-red-700">本日のAI利用上限（{dailyLimit}回）に達しました。明日0時（JST）にリセットされます。</p>
			</div>
		{/if}

		<div class="flex gap-2 mb-4">
			<button
				onclick={() => { mode = 'simple'; }}
				class="flex-1 py-1.5 rounded-lg text-sm font-semibold transition
					{mode === 'simple' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
			>
				シンプル（1件）
			</button>
			<button
				onclick={() => { mode = 'organize'; }}
				class="flex-1 py-1.5 rounded-lg text-sm font-semibold transition
					{mode === 'organize' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
			>
				まとめて（複数件）
			</button>
		</div>

		<textarea
			bind:value={inputText}
			rows={4}
			class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none text-sm"
			placeholder={mode === 'simple'
				? '例: 明日15時に歯医者の予約'
				: '例: 月曜に資料作成、水曜に会議（14〜15時）、金曜までにメール返信'}
		></textarea>

		{#if errorMsg}
			<p class="text-red-500 text-sm mt-2">{errorMsg}</p>
		{/if}
		{#if successMsg}
			<p class="text-green-600 text-sm mt-2 font-semibold">{successMsg}</p>
		{/if}

		<button
			onclick={parse}
			disabled={parsing || limitReached}
			class="mt-3 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
		>
			{#if parsing}
				<Loader size={18} class="animate-spin" /> 解析中...
			{:else}
				<Sparkles size={18} /> AIで解析
			{/if}
		</button>

		{#if dailyLimit !== null && !limitReached}
			<p class="text-center text-xs text-gray-400 mt-2">
				本日残り {remaining} 回使用できます（上限 {dailyLimit} 回/日）
			</p>
		{/if}
	</div>

	{#if candidates.length > 0}
		<div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-3">
			<div class="flex justify-between items-center mb-2">
				<h3 class="font-bold text-gray-700">解析結果 ({candidates.length}件)</h3>
				<button
					onclick={registerSelected}
					disabled={saving}
					class="flex items-center gap-1 bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
				>
					{#if saving}
						<Loader size={14} class="animate-spin" /> 登録中...
					{:else}
						<Plus size={14} /> 選択を登録
					{/if}
				</button>
			</div>

			{#each candidates as candidate, i}
				<div class="border rounded-lg p-3 {candidate.selected ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-gray-50 opacity-60'}">
					<div class="flex items-start gap-3">
						<input
							type="checkbox"
							checked={candidate.selected}
							onchange={() => toggleSelect(i)}
							class="mt-1 w-4 h-4 text-indigo-600 rounded cursor-pointer"
						/>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 mb-1">
								<span class="text-[10px] font-bold px-1.5 py-0.5 rounded
									{candidate.type === 'task' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'}">
									{candidate.type === 'task' ? 'タスク' : '予定'}
								</span>
							</div>

							{#if candidate.editing}
								<input
									type="text"
									bind:value={candidate.title}
									class="w-full px-2 py-1 border rounded text-sm mb-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
								/>
								{#if candidate.type === 'task'}
									<input
										type="datetime-local"
										bind:value={candidate.deadline}
										class="w-full px-2 py-1 border rounded text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
									/>
								{:else}
									<div class="grid grid-cols-2 gap-2">
										<input
											type="datetime-local"
											bind:value={candidate.start_dt}
											class="px-2 py-1 border rounded text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
										/>
										<input
											type="datetime-local"
											bind:value={candidate.end_dt}
											class="px-2 py-1 border rounded text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
										/>
									</div>
								{/if}
								<input
									type="text"
									bind:value={candidate.memo}
									placeholder="メモ（任意）"
									class="w-full px-2 py-1 border rounded text-sm mt-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
								/>
							{:else}
								<p class="font-semibold text-gray-800 text-sm">{candidate.title}</p>
								<p class="text-xs text-gray-500 mt-0.5">
									{#if candidate.type === 'task'}
										締め切り: {candidate.deadline ?? '未設定'}
									{:else}
										{candidate.start_dt ?? '未設定'} 〜 {candidate.end_dt ?? '未設定'}
									{/if}
									{#if candidate.memo}
										・{candidate.memo}
									{/if}
								</p>
							{/if}
						</div>

						<div class="flex gap-1 shrink-0">
							<button
								onclick={() => toggleEdit(i)}
								class="p-1 text-gray-400 hover:text-indigo-600 rounded"
								aria-label="編集"
							>
								<Edit2 size={14} />
							</button>
							<button
								onclick={() => removeCandidate(i)}
								class="p-1 text-gray-400 hover:text-red-500 rounded"
								aria-label="削除"
							>
								<Trash2 size={14} />
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
