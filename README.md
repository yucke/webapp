# webapp

## 集結タイマーの共有ルーム

`WOS_rally_tracker.html` の共有機能は Cloudflare Worker と Durable Object を使います。

1. Cloudflare にログインした状態で、このリポジトリのルートから `npx wrangler deploy` を実行します。
2. 生成された `https://<worker>.workers.dev` を、タイマーの「Worker URL」に入力します。
3. チームで同じ部屋番号を入力して接続します。

必要であれば Worker にカスタムドメインまたは `/rally-room` への Route を設定してください。Route を設定した場合は、同じサイトで開いたタイマーに既定の Worker URL が自動入力されます。

リーダーと進行中の集結は部屋内で共有されます。着弾から5分間は記録を残し、端末ごとの時刻誤差による早すぎる削除を避けます。