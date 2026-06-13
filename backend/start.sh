#!/bin/sh

# エラーが発生したらスクリプトを即座に終了させる安全設定
set -e

echo "🚀 Railwayデプロイプロセスの初期化を開始します..."

# Railwayが提供する環境変数 MYSQLHOST が存在する場合、DBの起動を待つ
if [ -n "$MYSQLHOST" ]; then
  echo "⏳ MySQL ($MYSQLHOST) の起動を待機中..."
  
  # netcat(nc) コマンドが使える場合は、ポートが空くまでループで監視
  if command -v nc >/dev/null 2>&1; then
    while ! nc -z "$MYSQLHOST" "${MYSQLPORT:-3306}"; do
      sleep 1
    done
  else
    # ncが無い場合のセーフティとして5秒シエスタ（スリープ）
    echo "Netcat未検出のため、安全のため5秒間待機します..."
    sleep 5
  fi
  echo "✅ MySQLへの経路が確立されました！"
fi

echo "🟢 Honoプロダクションサーバーを起動します..."
npm run start