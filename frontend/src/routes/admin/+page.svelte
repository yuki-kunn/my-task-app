<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Users, Trash2, Ban, CheckCircle, ChevronDown, ChevronUp, Calendar, CheckSquare, ArrowLeft } from 'lucide-svelte';
	import { fetchMe, fetchAdminUsers, fetchAdminUserTasks, fetchAdminUserEvents, suspendUser, unsuspendUser, deleteUser, ApiError, type AdminUser } from '$lib/api';
	import { formatDeadline } from '$lib/deadline';

	type UserRow = AdminUser & { expanded?: boolean; tasks?: any[]; events?: any[]; loadingItems?: boolean };

	let users = $state<UserRow[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');
	let confirmDelete = $state<string | null>(null);

	onMount(async () => {
		try {
			const me = await fetchMe();
			if (me.role !== 'admin') { goto('/dashboard'); return; }
			await loadUsers();
		} catch {
			goto('/dashboard');
		}
	});

	async function loadUsers() {
		loading = true;
		errorMsg = '';
		try {
			const data = await fetchAdminUsers();
			users = data.map((u) => ({ ...u, expanded: false }));
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '取得に失敗しました';
		} finally {
			loading = false;
		}
	}

	async function toggleExpand(user: UserRow) {
		user.expanded = !user.expanded;
		if (user.expanded && !user.tasks) {
			user.loadingItems = true;
			try {
				const [tasks, events] = await Promise.all([
					fetchAdminUserTasks(user.id),
					fetchAdminUserEvents(user.id)
				]);
				user.tasks = tasks;
				user.events = events;
			} finally {
				user.loadingItems = false;
			}
		}
	}

	async function handleSuspend(user: UserRow) {
		try {
			if (user.is_suspended) {
				await unsuspendUser(user.id);
				user.is_suspended = false;
			} else {
				await suspendUser(user.id);
				user.is_suspended = true;
			}
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '操作に失敗しました';
		}
	}

	async function handleDelete(userId: string) {
		try {
			await deleteUser(userId);
			users = users.filter((u) => u.id !== userId);
			confirmDelete = null;
		} catch (err) {
			errorMsg = err instanceof ApiError ? err.message : '削除に失敗しました';
			confirmDelete = null;
		}
	}

	function formatDate(dt: string) {
		return new Date(dt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
	}
</script>

<div class="max-w-3xl mx-auto space-y-4 mt-4">
	<div class="flex items-center gap-3 mb-2">
		<a href="/dashboard" class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
			<ArrowLeft size={20} />
		</a>
		<h1 class="text-xl font-bold text-gray-800 flex items-center gap-2">
			<Users size={22} class="text-indigo-600" /> 管理画面
		</h1>
	</div>

	{#if errorMsg}
		<p class="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{errorMsg}</p>
	{/if}

	{#if loading}
		<p class="text-gray-500 text-center py-12">読み込み中...</p>
	{:else}
		<p class="text-sm text-gray-500">ユーザー数: {users.length}</p>

		{#each users as user (user.id)}
			<div class="bg-white rounded-xl shadow-sm border {user.is_suspended ? 'border-red-200' : 'border-gray-100'} overflow-hidden">
				<!-- ユーザー行 -->
				<div class="flex items-center gap-3 p-4">
					<button
						onclick={() => toggleExpand(user)}
						class="flex-1 flex items-center gap-3 text-left min-w-0"
					>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 flex-wrap">
								<span class="font-medium text-gray-800 truncate">{user.email}</span>
								{#if user.role === 'admin'}
									<span class="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">ADMIN</span>
								{/if}
								{#if user.is_suspended}
									<span class="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">停止中</span>
								{/if}
							</div>
							<p class="text-xs text-gray-400 mt-0.5">
								登録: {formatDate(user.created_at)} ·
								タスク {user.task_count} / 予定 {user.event_count}
							</p>
						</div>
						{#if user.expanded}
							<ChevronUp size={16} class="text-gray-400 shrink-0" />
						{:else}
							<ChevronDown size={16} class="text-gray-400 shrink-0" />
						{/if}
					</button>

					<!-- 操作ボタン (admin以外) -->
					{#if user.role !== 'admin'}
						<div class="flex items-center gap-1 shrink-0">
							<button
								onclick={() => handleSuspend(user)}
								class="p-1.5 rounded-lg text-sm transition {user.is_suspended
									? 'text-green-600 hover:bg-green-50'
									: 'text-amber-600 hover:bg-amber-50'}"
								title={user.is_suspended ? '停止解除' : '停止'}
							>
								{#if user.is_suspended}
									<CheckCircle size={17} />
								{:else}
									<Ban size={17} />
								{/if}
							</button>
							<button
								onclick={() => (confirmDelete = user.id)}
								class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
								title="削除"
							>
								<Trash2 size={17} />
							</button>
						</div>
					{/if}
				</div>

				<!-- 展開: タスク・予定一覧 -->
				{#if user.expanded}
					<div class="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
						{#if user.loadingItems}
							<p class="text-xs text-gray-400">読み込み中...</p>
						{:else}
							<!-- タスク -->
							<div>
								<h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
									<CheckSquare size={12} /> タスク ({user.tasks?.length ?? 0})
								</h3>
								{#if !user.tasks?.length}
									<p class="text-xs text-gray-400">タスクなし</p>
								{:else}
									<ul class="space-y-1">
										{#each user.tasks as task}
											<li class="text-sm flex items-center gap-2 text-gray-700">
												<span class="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
												<span class="flex-1 truncate {task.is_completed ? 'line-through text-gray-400' : ''}">{task.title}</span>
												<span class="text-xs text-gray-400 shrink-0">{formatDeadline(task.deadline)}</span>
											</li>
										{/each}
									</ul>
								{/if}
							</div>
							<!-- 予定 -->
							<div>
								<h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
									<Calendar size={12} /> 予定 ({user.events?.length ?? 0})
								</h3>
								{#if !user.events?.length}
									<p class="text-xs text-gray-400">予定なし</p>
								{:else}
									<ul class="space-y-1">
										{#each user.events as event}
											<li class="text-sm flex items-center gap-2 text-gray-700">
												<span class="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0"></span>
												<span class="flex-1 truncate">{event.title}</span>
												<span class="text-xs text-gray-400 shrink-0">{formatDeadline(event.start_dt)}</span>
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	{/if}
</div>

<!-- 削除確認モーダル -->
{#if confirmDelete}
	{@const target = users.find((u) => u.id === confirmDelete)}
	<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
		<div class="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
			<h2 class="text-lg font-bold text-gray-800">ユーザーを削除しますか？</h2>
			<p class="text-sm text-gray-600">
				<span class="font-medium">{target?.email}</span> のすべてのタスク・予定・データが完全に削除されます。この操作は取り消せません。
			</p>
			<div class="flex gap-3">
				<button
					onclick={() => (confirmDelete = null)}
					class="flex-1 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
				>
					キャンセル
				</button>
				<button
					onclick={() => handleDelete(confirmDelete!)}
					class="flex-1 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
				>
					削除する
				</button>
			</div>
		</div>
	</div>
{/if}
