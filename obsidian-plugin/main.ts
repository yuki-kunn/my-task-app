import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, normalizePath, requestUrl } from 'obsidian';

interface TasqaNote {
	id: string;
	type: 'task' | 'event';
	title: string;
	deadline?: string;
	is_completed?: boolean;
	start_dt?: string;
	end_dt?: string;
	memo?: string;
	repeat_type: string;
	color: string | null;
	created_at: string;
}

interface TasqaExportResponse {
	exportedAt: string;
	count: number;
	ids: string[];
	notes: TasqaNote[];
}

interface TasqaSyncSettings {
	backendUrl: string;
	apiToken: string;
	syncFolder: string;
	syncIntervalMinutes: number;
	syncOnStart: boolean;
	deleteMissingNotes: boolean;
}

const DEFAULT_SETTINGS: TasqaSyncSettings = {
	backendUrl: '',
	apiToken: '',
	syncFolder: 'Tasqa',
	syncIntervalMinutes: 15,
	syncOnStart: true,
	deleteMissingNotes: true,
};

const REPEAT_LABEL: Record<string, string> = {
	none: 'なし',
	daily: '毎日',
	weekly: '毎週',
	yearly: '毎年',
};

export default class TasqaSyncPlugin extends Plugin {
	settings!: TasqaSyncSettings;
	private syncTimer: number | null = null;
	private statusBarItem!: HTMLElement;
	private syncing = false;

	async onload() {
		await this.loadSettings();

		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar('待機中');

		this.addRibbonIcon('refresh-cw', 'Tasqaと同期', () => {
			this.runSync();
		});

		this.addCommand({
			id: 'tasqa-sync-now',
			name: '今すぐ同期',
			callback: () => this.runSync(),
		});

		this.addSettingTab(new TasqaSyncSettingTab(this.app, this));

		this.scheduleSync();

		if (this.settings.syncOnStart) {
			// Defer until the workspace/vault is fully ready before the first sync.
			this.app.workspace.onLayoutReady(() => {
				if (this.isConfigured()) this.runSync();
			});
		}
	}

	onunload() {
		this.clearSyncTimer();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.scheduleSync();
	}

	isConfigured(): boolean {
		return !!this.settings.backendUrl && !!this.settings.apiToken;
	}

	private clearSyncTimer() {
		if (this.syncTimer !== null) {
			window.clearInterval(this.syncTimer);
			this.syncTimer = null;
		}
	}

	scheduleSync() {
		this.clearSyncTimer();
		if (!this.isConfigured() || this.settings.syncIntervalMinutes <= 0) return;
		const ms = this.settings.syncIntervalMinutes * 60 * 1000;
		this.syncTimer = window.setInterval(() => this.runSync(), ms);
		this.registerInterval(this.syncTimer);
	}

	private updateStatusBar(text: string) {
		this.statusBarItem.setText(`Tasqa: ${text}`);
	}

	async runSync() {
		if (this.syncing) return;
		if (!this.isConfigured()) {
			new Notice('Tasqa Sync: バックエンドURLとAPIトークンを設定してください');
			return;
		}

		this.syncing = true;
		this.updateStatusBar('同期中...');
		try {
			const data = await this.fetchExport();
			const { created, updated, deleted } = await this.applyExport(data);
			this.updateStatusBar(`同期完了 (${new Date().toLocaleTimeString('ja-JP')})`);
			if (created + updated + deleted > 0) {
				new Notice(`Tasqa Sync: 新規${created} / 更新${updated} / 削除${deleted}`);
			}
		} catch (err) {
			console.error('Tasqa Sync failed:', err);
			this.updateStatusBar('同期失敗');
			new Notice(`Tasqa Sync 失敗: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			this.syncing = false;
		}
	}

	private async fetchExport(): Promise<TasqaExportResponse> {
		const base = this.settings.backendUrl.replace(/\/+$/, '');
		const res = await requestUrl({
			url: `${base}/api/obsidian/export`,
			method: 'GET',
			headers: { Authorization: `Bearer ${this.settings.apiToken}` },
			throw: false,
		});

		if (res.status === 401 || res.status === 403) {
			throw new Error('認証エラー。APIトークンを確認してください');
		}
		if (res.status < 200 || res.status >= 300) {
			throw new Error(`APIエラー (HTTP ${res.status})`);
		}
		return res.json as TasqaExportResponse;
	}

	private async ensureFolder(path: string) {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFolder) return;
		if (existing) throw new Error(`同期先 "${path}" は既にファイルとして存在します`);
		await this.app.vault.createFolder(path).catch((err) => {
			// createFolder throws if it already exists in a race; ignore that case.
			if (!String(err?.message ?? err).includes('already exists')) throw err;
		});
	}

	private noteFileName(note: TasqaNote): string {
		const safeTitle = note.title.replace(/[\\/:*?"<>|#^[\]]/g, ' ').trim().slice(0, 80) || '(無題)';
		return `${safeTitle} (${note.id.slice(0, 8)}).md`;
	}

	private buildFrontmatter(note: TasqaNote): string {
		const lines: string[] = ['---', `tasqa_id: ${note.id}`, `tasqa_type: ${note.type}`];
		lines.push(`repeat: ${REPEAT_LABEL[note.repeat_type] ?? note.repeat_type}`);
		if (note.color) lines.push(`color: "${note.color}"`);
		if (note.type === 'task') {
			lines.push(`deadline: ${note.deadline ?? ''}`);
			lines.push(`completed: ${!!note.is_completed}`);
		} else {
			lines.push(`start: ${note.start_dt ?? ''}`);
			lines.push(`end: ${note.end_dt ?? ''}`);
		}
		lines.push(`created: ${note.created_at}`);
		lines.push(`tasqa_synced_at: ${new Date().toISOString()}`);
		lines.push('---');
		return lines.join('\n');
	}

	private buildBody(note: TasqaNote): string {
		const parts: string[] = [`# ${note.title}`, ''];
		if (note.type === 'task') {
			const box = note.is_completed ? '[x]' : '[ ]';
			const due = note.deadline ? formatJst(note.deadline) : '未設定';
			parts.push(`- ${box} ${note.title} 📅 ${due}`);
		} else {
			const start = note.start_dt ? formatJst(note.start_dt) : '未設定';
			const end = note.end_dt ? formatJst(note.end_dt) : '未設定';
			parts.push(`**開始:** ${start}`);
			parts.push(`**終了:** ${end}`);
			if (note.memo) {
				parts.push('', '## メモ', note.memo);
			}
		}
		return parts.join('\n');
	}

	private async applyExport(data: TasqaExportResponse): Promise<{ created: number; updated: number; deleted: number }> {
		const folder = normalizePath(this.settings.syncFolder || 'Tasqa');
		await this.ensureFolder(folder);

		let created = 0;
		let updated = 0;
		let deleted = 0;

		// id -> existing file, discovered via the tasqa_id frontmatter (not the
		// filename) so a manual rename in Obsidian doesn't break future syncs.
		const existingByTasqaId = new Map<string, TFile>();
		const folderFile = this.app.vault.getAbstractFileByPath(folder);
		if (folderFile instanceof TFolder) {
			for (const file of folderFile.children) {
				if (!(file instanceof TFile) || file.extension !== 'md') continue;
				const cache = this.app.metadataCache.getFileCache(file);
				const id = cache?.frontmatter?.tasqa_id;
				if (typeof id === 'string') existingByTasqaId.set(id, file);
			}
		}

		for (const note of data.notes) {
			const content = `${this.buildFrontmatter(note)}\n\n${this.buildBody(note)}\n`;
			const existing = existingByTasqaId.get(note.id);
			if (existing) {
				const prev = await this.app.vault.read(existing);
				if (prev !== content) {
					await this.app.vault.modify(existing, content);
					updated++;
				}
				existingByTasqaId.delete(note.id);
			} else {
				const path = normalizePath(`${folder}/${this.noteFileName(note)}`);
				await this.app.vault.create(path, content);
				created++;
			}
		}

		// Anything left in the map exists in the vault but was NOT in this export,
		// meaning Tasqa completed/deleted it (Tasqa deletes rows outright).
		if (this.settings.deleteMissingNotes) {
			for (const file of existingByTasqaId.values()) {
				await this.app.vault.trash(file, true);
				deleted++;
			}
		}

		return { created, updated, deleted };
	}
}

function formatJst(iso: string): string {
	try {
		return new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
	} catch {
		return iso;
	}
}

class TasqaSyncSettingTab extends PluginSettingTab {
	plugin: TasqaSyncPlugin;

	constructor(app: App, plugin: TasqaSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Tasqa Sync 設定' });
		containerEl.createEl('p', {
			text: 'TasqaのAPIトークンは、Tasqaの設定画面「外部連携（Obsidianなど）」から発行できます。',
		});

		new Setting(containerEl)
			.setName('バックエンドURL')
			.setDesc('例: https://your-backend.up.railway.app （末尾のスラッシュ不要）')
			.addText((text) =>
				text
					.setPlaceholder('https://your-backend.up.railway.app')
					.setValue(this.plugin.settings.backendUrl)
					.onChange(async (value) => {
						this.plugin.settings.backendUrl = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('APIトークン')
			.setDesc('Tasqa設定画面で発行した tasqa_ から始まるトークン')
			.addText((text) => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('tasqa_xxxxxxxxxxxxxxxx')
					.setValue(this.plugin.settings.apiToken)
					.onChange(async (value) => {
						this.plugin.settings.apiToken = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('同期先フォルダ')
			.setDesc('Vault内の相対パス')
			.addText((text) =>
				text
					.setPlaceholder('Tasqa')
					.setValue(this.plugin.settings.syncFolder)
					.onChange(async (value) => {
						this.plugin.settings.syncFolder = value.trim() || 'Tasqa';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('自動同期間隔（分）')
			.setDesc('0を指定すると自動同期を無効化（コマンド/リボンからの手動同期のみ）')
			.addText((text) =>
				text
					.setPlaceholder('15')
					.setValue(String(this.plugin.settings.syncIntervalMinutes))
					.onChange(async (value) => {
						const n = Number(value);
						this.plugin.settings.syncIntervalMinutes = Number.isFinite(n) && n >= 0 ? n : 15;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('起動時に同期')
			.setDesc('Obsidian起動直後に一度同期を実行する')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.syncOnStart).onChange(async (value) => {
					this.plugin.settings.syncOnStart = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('削除同期を有効化')
			.setDesc('Tasqa側で完了・削除されたアイテムに対応するノートを自動的にゴミ箱へ移動する')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.deleteMissingNotes).onChange(async (value) => {
					this.plugin.settings.deleteMissingNotes = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('今すぐ同期')
			.setDesc('設定を確認したら、一度手動で同期して動作確認してください')
			.addButton((button) =>
				button.setButtonText('同期実行').setCta().onClick(() => this.plugin.runSync())
			);
	}
}
