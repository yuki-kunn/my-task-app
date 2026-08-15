# Tasqa

マルチユーザー対応のタスク・予定管理 Web アプリ。  
AI によるテキスト解析からプッシュ通知まで、日常の予定管理を一元化します。

---

## 機能一覧

| カテゴリ | 機能 |
|---|---|
| タスク管理 | 作成 / 編集 / 削除 / 完了 / ドラッグ＆ドロップ並び替え |
| 予定管理 | 作成 / 編集 / 削除 / 終日イベント対応 |
| 繰り返し | 毎日 / 毎週 / 毎年の自動繰り返し |
| カラー | プリセット 8 色 + ユーザー独自カラー（最大 20 色） |
| AI 解析 | 自然文をタスク・予定に変換（Gemini 2.5 Flash） |
| カレンダー | 月次カレンダービュー、日付別タスク・予定一覧 |
| プッシュ通知 | 締め切り 1 時間前通知 / 毎朝 00:00 JST デイリーサマリー |
| 認証 | メール認証 + パスワードログイン / アカウントロック |
| 管理者 | ユーザー管理（停止 / 復旧 / 削除） / 他ユーザーのタスク・予定参照 |
| PWA | インストール対応（manifest + Service Worker） |
| Obsidian 連携 | 長期 API トークンによる読み取り専用エクスポート API + 専用プラグインで自動同期 |

---

## 技術スタック

### フロントエンド

| 項目 | 採用技術 |
|---|---|
| フレームワーク | SvelteKit 2 / Svelte 5 (runes) |
| スタイリング | Tailwind CSS v4 |
| アイコン | lucide-svelte |
| D&D | svelte-dnd-action |
| デプロイ | Vercel (@sveltejs/adapter-vercel) |

### バックエンド

| 項目 | 採用技術 |
|---|---|
| フレームワーク | Hono 4 on Node.js |
| 認証 | JWT (jose) / bcryptjs |
| DB | MySQL (mysql2/promise) |
| メール | SendGrid |
| AI | Google Gemini API (2.5 Flash → 1.5 Flash fallback) |
| プッシュ通知 | Web Push / VAPID (web-push) |
| スケジューラー | node-cron |
| デプロイ | Railway |

---

## ディレクトリ構成

```
my-task-app/
├── frontend/
│   └── src/
│       ├── lib/
│       │   ├── api.ts              # バックエンド API クライアント
│       │   ├── colors.ts           # プリセットカラー定義
│       │   ├── deadline.ts         # 日時フォーマット / スタイル計算
│       │   ├── types.ts            # 共通型定義 (Task, Event, ...)
│       │   ├── utils.ts            # 共通ユーティリティ
│       │   └── components/
│       │       ├── ColorPicker.svelte   # カラー選択 UI
│       │       ├── ItemCard.svelte      # タスク・予定 共通カードコンポーネント
│       │       ├── TaskCard.svelte      # タスクカード
│       │       └── EventCard.svelte     # 予定カード
│       └── routes/
│           ├── +layout.svelte      # 共通レイアウト / 認証ガード
│           ├── +page.svelte        # ログインページ
│           ├── register/           # 新規登録 (メール認証)
│           ├── dashboard/          # タスク・予定一覧
│           ├── task/               # タスク・予定 作成・編集フォーム
│           ├── calendar/           # カレンダービュー
│           ├── ai/                 # AI テキスト解析
│           ├── settings/           # パスワード変更
│           └── admin/              # 管理者ダッシュボード
└── backend/
    └── src/
        ├── index.ts                # Hono アプリ起動 / ルートマウント / Push エンドポイント
        ├── auth.ts                 # JWT 検証ミドルウェア
        ├── db.ts                   # MySQL 接続 / テーブル初期化・マイグレーション
        ├── push.ts                 # Web Push 送信
        ├── scheduler.ts            # cron ジョブ (締め切り通知 / デイリーサマリー)
        ├── helpers.ts              # 共通ユーティリティ
        └── routes/
            ├── auth.ts             # POST /register, /verify, /login
            ├── tasks.ts            # CRUD + 並び替え
            ├── events.ts           # CRUD + 完了処理
            ├── settings.ts         # GET /me, PUT /password
            ├── colors.ts           # ユーザーカラー CRUD
            ├── ai.ts               # AI 解析 / 使用量管理
            └── admin.ts            # 管理者 API
```

---

## 環境変数

### バックエンド (`.env`)

```env
# DB (Railway 自動注入 or 手動設定)
MYSQL_URL=mysql://user:pass@host:3306/dbname

# 手動設定する場合
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=user
DB_PASSWORD=password
DB_NAME=todo_db

# JWT
JWT_SECRET=your-secret-here

# SendGrid
SENDGRID_API_KEY=SG.xxxx
SENDGRID_FROM=no-reply@example.com

# Google Gemini
GEMINI_API_KEY=AIzaxxxx

# Web Push (VAPID)
VAPID_PUBLIC_KEY=xxxx
VAPID_PRIVATE_KEY=xxxx
VAPID_SUBJECT=mailto:admin@example.com

# CORS (カンマ区切りで複数指定可)
CORS_ORIGIN=https://your-frontend.vercel.app

# AI レート制限 (デフォルト: 5回/日/ユーザー)
AI_DAILY_LIMIT=5

PORT=3000
```

### フロントエンド (`.env`)

```env
VITE_API_URL=https://your-backend.railway.app/api
```

---

## ローカル開発

```bash
# バックエンド
cd backend
npm install
npm run dev          # http://localhost:3000

# フロントエンド (別ターミナル)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

### VAPID キー生成

```bash
cd backend
node -e "const wp = require('web-push'); const k = wp.generateVAPIDKeys(); console.log(k);"
```

---

## デプロイ

| 対象 | サービス | 備考 |
|---|---|---|
| フロントエンド | Vercel | `frontend/` を root に指定。Build command: `npm run build` |
| バックエンド | Railway | `backend/` を root に指定。Start command: `npm run start` |
| DB | Railway (MySQL plugin) | `MYSQL_URL` が自動で注入される |

---

## API 概要

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/api/auth/register` | メール認証コード送信 |
| POST | `/api/auth/verify` | コード検証・アカウント作成 |
| POST | `/api/auth/login` | ログイン → JWT 発行 |
| GET | `/api/settings/me` | 自分のプロフィール取得 |
| PUT | `/api/settings/password` | パスワード変更 |
| GET/POST | `/api/tasks` | タスク一覧取得 / 作成 |
| PUT | `/api/tasks/reorder` | 並び替え |
| PUT/DELETE | `/api/tasks/:id` | 更新 / 削除 |
| GET/POST | `/api/events` | 予定一覧取得 / 作成 |
| PUT/DELETE | `/api/events/:id` | 更新 / 削除 |
| POST | `/api/events/:id/complete` | 予定完了 (繰り返し次回生成) |
| GET/POST/DELETE | `/api/colors` | ユーザーカラー管理 |
| GET | `/api/ai/usage` | AI 使用量取得 |
| POST | `/api/ai/parse` | テキスト → タスク・予定変換 |
| GET | `/api/push/vapid-public-key` | VAPID 公開鍵取得 |
| POST | `/api/push/subscribe` | プッシュ購読登録 |
| POST | `/api/push/unsubscribe` | プッシュ購読解除 |
| GET/POST/DELETE | `/api/tokens` | 個人用 API トークン管理（JWT 認証） |
| GET | `/api/obsidian/export` | タスク・予定のエクスポート（API トークン認証） |
| GET | `/api/admin/users` | ユーザー一覧 (管理者専用) |
| PUT | `/api/admin/users/:id/suspend` | ユーザー停止 |
| DELETE | `/api/admin/users/:id` | ユーザー削除 |

---

## Obsidian 連携

タスク・予定を Obsidian の Vault に定期同期するための読み取り専用エクスポート API です。Tasqa は JSON を返すだけで、Markdown ノート化と Vault への書き込みは Obsidian 側のスクリプトが行います（Tasqa は Vault の場所を一切知らない設計）。

### 1. API トークンを発行

設定画面の「外部連携（Obsidianなど）」からトークンを発行します。**表示は発行直後の一度きり**なので、必ず控えてください（`tasqa_` から始まる文字列）。DB には SHA-256 ハッシュのみ保存され、平文は保持されません。不要になったらいつでも失効できます。

### 2. エンドポイント

```
GET /api/obsidian/export
Authorization: Bearer tasqa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

レスポンス例:

```json
{
  "exportedAt": "2026-07-30T03:00:00.000Z",
  "count": 2,
  "ids": ["11111111-...", "22222222-..."],
  "notes": [
    {
      "id": "11111111-...",
      "type": "task",
      "title": "資料を提出する",
      "deadline": "2026-08-01T10:00:00.000Z",
      "is_completed": false,
      "repeat_type": "none",
      "color": "#6366f1",
      "created_at": "2026-07-20T09:00:00.000Z"
    },
    {
      "id": "22222222-...",
      "type": "event",
      "title": "定例会議",
      "start_dt": "2026-08-02T01:00:00.000Z",
      "end_dt": "2026-08-02T02:00:00.000Z",
      "memo": "会議室A",
      "repeat_type": "weekly",
      "color": "orange",
      "created_at": "2026-07-15T09:00:00.000Z"
    }
  ]
}
```

- `color` はプリセットキー（例 `orange`）またはユーザーカラーの実 hex（例 `#6366f1`）に解決済みで返ります。`custom:<uuid>` の形では返しません。
- `ids` は**現時点で Tasqa に存在する全アイテムの ID**です。Tasqa は完了・削除時にレコードを即削除する仕様のため、Obsidian 側で前回同期時に作ったノートのうち `ids` に無いものは「削除された」と判断してください（Vault 側の削除/アーカイブは任意のロジックで実装）。

### 3. 専用プラグイン（推奨・自動化済み）

[`obsidian-plugin/`](./obsidian-plugin) に、この API を使って Vault と自動同期する Obsidian プラグイン「Tasqa Sync」を同梱しています。設定画面にバックエンドURLとAPIトークンを入力するだけで、Obsidian 起動中は指定間隔（デフォルト15分）ごとに自動で同期し、Tasqa 側で完了・削除されたアイテムのノートも自動でゴミ箱へ移動します。セットアップ手順は [obsidian-plugin/README.md](./obsidian-plugin/README.md) を参照してください。

### 4. 自前でスクリプトを書く場合（参考実装）

専用プラグインを使わず、Templater や外部スクリプト実行環境（例: [obsidian-shellcommands](https://github.com/Taitava/obsidian-shellcommands)、または Node.js の定期実行）で独自に同期処理を組みたい場合の参考コードです。[obsidian-tasks-plugin](https://github.com/obsidianmd/obsidian-tasks) 等と併用する場合は、生成する Markdown 側のタスク記法をそちらの形式に合わせてください。

```js
// 疑似コード：Vault 内 "Tasqa/" フォルダに1件=1ノートで同期する例
const res = await fetch('https://<your-backend>.up.railway.app/api/obsidian/export', {
  headers: { Authorization: 'Bearer tasqa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' }
});
const { ids, notes } = await res.json();

for (const note of notes) {
  const path = `Tasqa/${note.id}.md`;
  const frontmatter = [
    '---',
    `tasqa_id: ${note.id}`,
    `type: ${note.type}`,
    `repeat: ${note.repeat_type}`,
    note.color ? `color: "${note.color}"` : null,
    note.type === 'task' ? `deadline: ${note.deadline}` : null,
    note.type === 'task' ? `completed: ${note.is_completed}` : null,
    note.type === 'event' ? `start: ${note.start_dt}` : null,
    note.type === 'event' ? `end: ${note.end_dt}` : null,
    '---',
  ].filter(Boolean).join('\n');
  const body = `# ${note.title}\n\n${note.memo ?? ''}`;
  await app.vault.adapter.write(path, `${frontmatter}\n\n${body}`);
}

// 削除同期: ids に無いノートを削除
const existingFiles = app.vault.getFiles().filter(f => f.path.startsWith('Tasqa/'));
for (const file of existingFiles) {
  const id = file.basename;
  if (!ids.includes(id)) {
    await app.vault.delete(file);
  }
}
```

これを Templater の起動時スクリプトや `setInterval`、または OS の cron / タスクスケジューラで定期実行すれば片方向（Tasqa → Obsidian）の自動同期になります。Obsidian → Tasqa への書き戻しは現状サポートしていません（読み取り専用 API）。

---

## 権限・ロール

| ロール | 説明 |
|---|---|
| `user` | 一般ユーザー。自分のタスク・予定のみ操作可能 |
| `admin` | 全ユーザーの管理が可能。AI レート制限なし |

- 初回登録者が管理者になるか、`/api/auth/verify` の `asAdmin: true` フラグで昇格
- ログイン失敗 5 回でアカウントを 15 分間ロック

---

## AI 機能

- **モード**: `simple`（自然文 → 単一タスク）/ `organize`（長文 → 複数タスク・予定に分解）
- **入力制限**: simple 200 文字 / organize 500 文字
- **レート制限**: ユーザーごとに 1 日 5 回（`AI_DAILY_LIMIT` で変更可）。管理者は無制限
- **フォールバック**: Gemini 2.5 Flash が 503 の場合、Gemini 1.5 Flash に自動切替

---

## ユーザーカスタムカラー

タスク・予定ごとに色を自由に設定できます。

- プリセット 8 色（タスク：白・赤・オレンジ・黄・緑・青・紫・ピンク）
- ユーザーごとに最大 20 色のオリジナルカラーを登録可能
- カラーは `user_colors` テーブルで管理され、他ユーザーには表示されない
- DB 保存形式: `custom:<uuid>`。表示は inline style で描画
