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
| GET | `/api/admin/users` | ユーザー一覧 (管理者専用) |
| PUT | `/api/admin/users/:id/suspend` | ユーザー停止 |
| DELETE | `/api/admin/users/:id` | ユーザー削除 |

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
