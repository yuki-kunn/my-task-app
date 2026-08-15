# Tasqa Sync — Obsidian プラグイン

Tasqa のタスク・予定を、Obsidian の Vault に読み取り専用で定期同期するコミュニティプラグインです。

- Obsidian 起動中、指定間隔（デフォルト15分）で自動同期
- リボンアイコン／コマンドパレットから手動同期も可能
- Tasqa 側で完了・削除されたアイテムは、対応する Vault 内ノートを自動でゴミ箱へ移動（オプションでOFF可）
- ノートの対応付けは frontmatter の `tasqa_id` で行うため、Vault 内でファイル名を変更しても同期が壊れない

## インストール（開発ビルドを手動配置）

まだコミュニティプラグイン一覧には未申請のため、手動でビルド・配置します。

```bash
cd obsidian-plugin
npm install
npm run build
```

`main.js` と `manifest.json` が生成されるので、これらを Vault の以下のフォルダにコピーします。

```
<あなたのVault>/.obsidian/plugins/tasqa-sync/
├── main.js
└── manifest.json
```

Obsidian を再起動（またはコマンドパレットで「Reload app without saving」）し、設定 → コミュニティプラグイン → 「Tasqa Sync」を有効化してください。

## 設定

設定タブ（設定 → コミュニティプラグイン → Tasqa Sync の歯車アイコン）から以下を入力します。

| 項目 | 説明 |
|---|---|
| バックエンドURL | 例: `https://your-backend.up.railway.app` |
| APIトークン | Tasqa の設定画面「外部連携（Obsidianなど）」で発行した `tasqa_...` トークン |
| 同期先フォルダ | Vault内の保存先（デフォルト `Tasqa`） |
| 自動同期間隔 | 分単位。`0` で自動同期を無効化（手動同期のみ） |
| 起動時に同期 | Obsidian起動直後に一度実行するか |
| 削除同期を有効化 | Tasqa側で消えたアイテムのノートをゴミ箱へ移動するか |

設定後、「今すぐ同期」ボタンかリボンの ↻ アイコンで動作確認してください。

## 開発

```bash
npm run dev   # esbuild watch モード（main.js を再ビルドし続ける）
```

`npm run dev` 実行中に Vault の `.obsidian/plugins/tasqa-sync/` へ `main.js`/`manifest.json` をシンボリックリンクしておくと、保存のたびに Obsidian 側で「Reload app without saving」するだけで変更を確認できます。
