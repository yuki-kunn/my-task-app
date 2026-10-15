# Tasqa MCP サーバー 仕様書 (v0.1 ドラフト)

作成日: 2026-10-15 / ステータス: 仕様会議の結果、実装前レビュー待ち

## 1. 目的とスコープ

Claude などの MCP クライアントから、自分の Tasqa のタスク・予定を読み書きできるようにする。

**対象 (MVP)**
- Claude Code / Claude Desktop など、静的 Bearer トークンを設定できるクライアント
- 読み取り・作成・更新・完了・削除

**対象外 (MVP)**
- OAuth 2.1 (claude.ai の Web/モバイル用。Sprint 4 で再検討)
- MCP の resources / prompts / subscriptions
- Tasqa 側での Gemini 解析 (`/api/ai/parse` は呼ばない。抽出は Claude 側が行う)
- Notion 連携 (Notion AI からは、この MCP サーバーを呼ぶ形で後日対応)

## 2. プロトコル

準拠先: MCP 2026-07-28 (ステートレス Streamable HTTP)。

| 項目 | 仕様 |
|---|---|
| エンドポイント | `POST /mcp` の1本のみ |
| GET / DELETE | `405 Method Not Allowed` |
| セッション | なし。`Mcp-Session-Id` は無視し、発行もしない |
| 応答形式 | 常に `application/json` (SSE は使わない。ツールは短時間で終わるため) |
| 必須ヘッダ | `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name` (`tools/call` 時)。本文と不一致なら `400` + JSON-RPC `-32020` |
| 未対応バージョン | `400` + `UnsupportedProtocolVersionError` (対応版一覧を返す) |
| 未実装メソッド | `404` + JSON-RPC `-32601` |
| Origin 検証 | `Origin` ヘッダがあり、許可リスト (`CORS_ORIGIN`) に無ければ `403`。無い場合 (CLI クライアント) は通す |
| 旧版クライアント | `initialize` ハンドシェイクを受けた場合のみ、旧版 (2025-11-25) 互換の応答を返す |

**実装メソッド**: `tools/list`, `tools/call`, `ping`, (旧版互換用) `initialize`, `notifications/initialized` (202)。

**実装方式**: 公式 SDK は使わず、Hono 上に JSON-RPC ディスパッチャを手書きする。
理由: ステートレスで必要なメソッドが少ない。仕様が出たばかりで SDK の対応状況が未確認。依存を増やさない。
SDK 側が安定していると確認できれば差し替える (ツール定義を分離しておくので移行は容易)。

## 3. 認証・認可

- `Authorization: Bearer tasqa_...` (既存のトークン基盤を使う)
- **スコープを新設して分離する**: `mcp_read` / `mcp_write`
  - 既存の `apiTokenMiddleware` は **スコープを検査していない** (どのスコープのトークンでも通る)。
    そのままでは Obsidian 用の読み取りトークンが `/mcp` に使え、逆も成り立つ。
    → ミドルウェアに必須スコープを引数で渡し、検査する。**これは MCP 追加の前提作業。**
  - `obsidian_export` のトークンは `/mcp` では 401。`mcp_*` のトークンは `/api/obsidian` では 401。
  - `mcp_write` は `mcp_read` を包含する。
- `POST /api/tokens` を拡張: `scope` を受け取り、許可リスト内の値のみ保存 (現状は固定値)。
- 設定画面のトークン発行 UI にスコープ選択を追加。
- `tools/list` は、トークンのスコープに応じて返すツールを変える (read のみなら書き込みツールを返さない)。
- 停止ユーザーは 403 (既存どおり)。

## 4. ツール一覧 (MVP)

命名は snake_case、128 文字以内、使用可能文字は英数字と `_ - .` のみ。

| ツール | スコープ | 注釈 | 概要 |
|---|---|---|---|
| `list_agenda` | read | readOnly | 期間内のタスクと予定を時系列で返す |
| `get_item` | read | readOnly | ID で1件取得 |
| `create_task` | write | | タスク作成 |
| `update_task` | write | idempotent | タスク更新 (部分更新) |
| `complete_task` | write | destructive (行を削除する) | 完了。繰り返しなら次回分を生成 (REST と同じ挙動) |
| `create_event` | write | | 予定作成 |
| `update_event` | write | idempotent | 予定更新 (部分更新) |
| `complete_event` | write | destructive (行を削除する) | 繰り返し予定の次回分生成 + 今回分削除 (REST と同じ) |
| `delete_item` | write | destructive | タスクまたは予定を削除 |

**共通ルール**
- 日時は ISO 8601。**オフセット付きを推奨**。オフセットが無い場合は **JST (+09:00) とみなす**。
  - **DB は「JST の壁時計の値を UTC として保存」している** (`frontend/src/lib/deadline.ts` 参照)。
    そのため MCP 層は UTC 変換をせず、入力を JST の壁時計に直してそのまま保存し、出力は保存値に `+09:00` を付ける。
    `time.ts` に実装し、単体テストあり。既存の `parseDeadline` は使わない。
  - 日付のみの値は 00:00 (`to` は 23:59:59) とする。存在しない日付 (2/30 など) は拒否する。
- ID はサーバー側で UUID を生成する (REST はクライアント指定だが、MCP では不要)。
- `repeat_type`: `none` / `daily` / `weekly` / `yearly` (既存どおり。実値は `repeat.ts` に合わせる)。
- `color`: プリセット色名またはカスタム色 ID。不正値は `isError` で返す。
- `list_agenda`: `from` / `to` 省略時は「今日から14日間」。最大 100 件。超過時は `truncated: true`。
- 入力検証エラーは `isError: true` のツール実行エラーで返す (モデルが自己修正できるように、直し方を文面に含める)。
- 返却テキストの `memo` は 500 文字までに切る (後述のプロンプトインジェクション対策)。
- 返却は `content` (テキスト要約) と `structuredContent` (JSON) の両方。

## 5. 安全設計

| 脅威 | 対策 |
|---|---|
| トークン漏洩 | ハッシュ保存 (既存)。write は別トークンにし、読み取り専用で使う選択肢を用意 |
| 誤削除・誤更新 | `destructiveHint` を付与。削除結果に削除した項目の内容を返す。人間の承認はクライアント側に委ねる (仕様どおり) |
| プロンプトインジェクション (予定のメモなどに悪意ある指示が混入) | 返却内容は「データ」と明示するヘッダ文を付ける。メモは切り詰める。破壊的操作は write スコープに限定 |
| 暴走ループ | トークン単位で 60 回/分、書き込みは 20 回/分。超過は JSON-RPC エラー + `Retry-After` (プロセス内メモリで可。Railway は単一インスタンス前提) |
| 他ユーザーへのアクセス | すべての SQL に `user_id = ?` を付ける (既存ルートと同じ) |
| 監査 | `tool 名 / トークン ID / 成否 / 対象 ID` を構造化ログに出す。タイトルやメモの中身はログに出さない |

## 6. データ・コード構成

```
backend/src/
├── apiTokens.ts            # スコープ検査を追加 (requireScope)
├── routes/apiTokens.ts     # scope 受け取り・許可リスト検証
├── mcp/
│   ├── index.ts            # POST /mcp ハンドラ。ヘッダ検証・ディスパッチ
│   ├── protocol.ts         # JSON-RPC 型・エラーコード・バージョン処理
│   ├── time.ts             # オフセット無し=JST の解釈、出力整形
│   ├── rateLimit.ts        # トークン単位のスライディングウィンドウ
│   └── tools/
│       ├── index.ts        # ツール登録・スコープによる絞り込み
│       ├── agenda.ts       # list_agenda, get_item
│       ├── tasks.ts        # create/update/complete_task
│       ├── events.ts       # create/update/complete_event
│       └── delete.ts       # delete_item
```

- DB スキーマ変更は無し (`api_tokens.scope` は VARCHAR(30) でそのまま使える)。
- 既存の REST ルートは**変更しない** (テストが無く、回帰リスクを避ける)。
  完了処理の SQL は `mcp/tools` 側に持つ。繰り返し計算は既存の `repeat.ts` を共用する。
  → 重複は技術的負債として記録し、テスト整備後に共通化する。

## 7. テスト方針

このリポジトリには自動テストが無い。MCP 層は新規コードなので、ここから導入する。

- 単体: `time.ts`、ヘッダ検証、スコープ判定 (Node 標準の `node:test`。追加依存なし)
- 結合: ローカル MySQL (`docker-compose.yml`) に対して、`curl` で JSON-RPC を叩くスモークスクリプト
- 手動: 実際に Claude Code から接続して、一通りの操作を行う (過去のフィードバックに従い、PR 前にローカルで動作確認する)
- CI: backend ジョブに `node --test` を追加

## 8. 未確定事項 (ユーザー判断が必要)

**決定済み (2026-10-15)**
1. 利用クライアントはモバイル (Claude アプリ) 前提。無料アカウントでもカスタムコネクタは使える (ただし1個まで)。
   コネクタはアカウントに紐づき、追加は Web/デスクトップから行う (モバイルからの追加はベータ)。
   接続は Anthropic のクラウドから行われるため、サーバーは公開 URL が必要 (Railway で満たす)。
   認証は「固定の認証情報をヘッダで送る方式」と OAuth の両方が選択肢にあるが、
   個人アカウントで固定ヘッダが使えるかは未確認。**Sprint 1 で実機確認し、使えなければ Sprint 4 (OAuth) を前倒しする。**
2. `delete_item` は MVP に含める。ただし Sprint 3 で、下記の安全策付きで入れる。
3. MCP 用トークンは read / write を別々に発行する。

**delete_item の安全策**
- 引数に `id` と `expected_title` を必須にし、タイトルが一致しない場合は削除しない (ID の取り違え防止)。
- 削除した項目の全内容を返す (誤削除時に作り直せる)。
- Tasqa は削除が物理削除で復元できない。完了 (`complete_*`) も行を削除するため、`complete_*` にも `destructiveHint` を付ける。

## 9. 検証できていない前提

- ~~`server/discover` の有無~~ → **確認済み**: 存在し、サーバーに実装が必須。`supportedVersions` / `capabilities` / `_meta.io.modelcontextprotocol/serverInfo` を返す。
  `UnsupportedProtocolVersionError` は `-32022`、`data: { supported, requested }`。Sprint 1 で実装済み。
- 現行の Claude クライアントがどの版で接続してくるか (新版かつ旧版 `initialize` か)。
  → 旧版互換を入れているのはこのため。実機で確認して不要なら外す。
- ロールのやり取りは、すべて資料調査に基づく。実クライアントでの動作は未検証。

## 10. スプリント計画

| Sprint | ゴール | 主なタスク | 完了条件 |
|---|---|---|---|
| 0 (下準備) | 前提の不具合を直す | Gemini フォールバック (`ai.ts:80`) を修正。プロトコル未確認事項の確認 | CI 緑。確認結果を本書に反映 |
| 1 (実装済み・PR待ち) | 読み取りだけ動く | トークンのスコープ検査と発行 UI。`POST /mcp` の骨格 (ヘッダ検証・`tools/list`・`ping`・`initialize`)。`list_agenda` / `get_item`。`time.ts` と単体テスト | Claude Code から接続して予定が読める。旧スコープのトークンが `/mcp` で 401 |
| 2 | 書き込みが動く | `create/update/complete` の task と event。レート制限。監査ログ | 繰り返しタスク完了で次回分が REST と同じ結果になる |
| 3 | 安全に出せる | `delete_item`。メモ切り詰め・注意書き。README と接続手順。CI にテスト追加。セキュリティレビュー | `/security-review` と `/code-review` の指摘対応済み。本番デプロイ |
| 4 (任意) | claude.ai 対応 | OAuth 2.1 認可サーバー機能、同意画面、メタデータ配信 | claude.ai のカスタムコネクタから接続できる |

各スプリントは 1 PR。マージ方式は既存どおりリベースマージ。
