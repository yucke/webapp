const ROOM_ID_PATTERN = /^[a-f0-9]{64}$/;
const EXPIRY_GRACE_MS = 5 * 60 * 1000;

// index.html を埋め込む
const INDEX_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ホワサバ便利ツール保管庫</title>
    <style>
        /* ==========================================
           全体の設定（極寒の世界観をイメージしたカラー）
           ========================================== */
        :root {
            --bg-color: #0d1b2a;       /* 背景色：深いディープブルー */
            --panel-bg: #1b263b;       /* カード背景：やや明るいネイビー */
            --accent-color: #415a77;   /* 枠線など：くすんだブルー */
            --text-color: #e0e1dd;     /* 基本文字：薄いグレー */
            --ice-blue: #00b4d8;       /* アクセント：鮮やかなアイスブルー */
            --ice-glow: #90e0ef;       /* 発光エフェクト用 */
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            line-height: 1.6;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        /* ==========================================
           ヘッダーエリア
           ========================================== */
        header {
            text-align: center;
            padding: 50px 0 30px;
            margin-bottom: 40px;
        }

        header h1 {
            font-size: 2.3rem;
            color: #ffffff;
            text-shadow: 0 0 12px var(--ice-glow);
            margin-bottom: 12px;
            letter-spacing: 0.05em;
        }

        header p {
            color: var(--ice-glow);
            font-size: 1.05rem;
            opacity: 0.9;
        }

        /* ==========================================
           ツール一覧（自動レイアウト・グリッドレスポンス）
           ========================================== */
        .tools-grid {
            display: grid;
            /* 画面幅に合わせて、最小幅300pxのカードが自動で1列〜3列に並び替わります */
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 25px;
        }

        /* ツールカード（これをコピペして増やせます） */
        .tool-card {
            background-color: var(--panel-bg);
            border: 1px solid var(--accent-color);
            border-radius: 10px;
            padding: 25px;
            display: flex;
            flex-direction: column;
            justify-content: space-between; /* ボタンを下部に固定 */
            transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }

        /* マウスを乗せたときのアニメーション */
        .tool-card:hover {
            transform: translateY(-4px);
            border-color: var(--ice-blue);
            box-shadow: 0 8px 20px rgba(144, 224, 239, 0.15);
        }

        .tool-card-content h2 {
            font-size: 1.35rem;
            color: #ffffff;
            margin-bottom: 12px;
            line-height: 1.4;
        }

        .tool-card-content p {
            font-size: 0.95rem;
            color: #b0c4de;
            margin-bottom: 25px;
        }

        /* ツールを開くボタン */
        .btn {
            display: block;
            text-align: center;
            background-color: var(--ice-blue);
            color: var(--bg-color);
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 0.95rem;
            transition: background-color 0.2s, color 0.2s;
        }

        .btn:hover {
            background-color: var(--ice-glow);
        }

        /* ==========================================
           フッター
           ========================================== */
        footer {
            text-align: center;
            padding: 60px 0 20px;
            margin-top: 60px;
            font-size: 0.85rem;
            color: var(--accent-color);
            border-top: 1px solid rgba(65, 90, 119, 0.3);
        }
    </style>
</head>
<body>

<div class="container">
    
    <!-- ヘッダー -->
    <header>
        <h1>ホワサバ便利ツール保管庫</h1>
        <p>ホワイトアウトサバイバル（Whiteout Survival）の攻略・効率化自作ツール集</p>
    </header>

    <!-- メインコンテンツ：ツール一覧 -->
    <main class="tools-grid">
        
        <!-- 💡 ツールを増やしたい時は、ここから -->
        <div class="tool-card">
            <div class="tool-card-content">
                <h2>王城着弾時刻 計算機</h2>
                <p>指定した座標から城への集結着弾時刻を計算します。島の行軍アップ装飾はMAX、行軍ステ保有前提での計算です。時刻をタップすればクリップボードにコピーできます。</p>
            </div>
            <a href="WOS_sunfire_timer.html" class="btn" target="_blank" rel="noopener noreferrer">ツールを開く</a>
        </div>
        <!-- ここまでをコピーして下に貼り付けるだけです 💡 -->

        <div class="tool-card">
            <div class="tool-card-content">
                <h2>イベント早見表合成エディタ</h2>
                <p>季節イベントなど、複数のイベントが重なるときに、1つの早見表に合成するエディタです。チャットで崩れずきれいに表示できます。</p>
            </div>
            <a href="WOS_task_maker.html" class="btn" target="_blank" rel="noopener noreferrer">ツールを開く</a>
        </div>

        <div class="tool-card">
            <div class="tool-card-content">
                <h2>残り時間→日時変換タスクメモ</h2>
                <p>ステ獲る方にはスケジュール表示されるのに守る方には表示されなくてわかりにくいよ｡ﾟ(ﾟ´ω\`ﾟ)ﾟ｡<br>
                    そんな幹部の方に贈る！支配中ステーションの保護切れやエントリー締め切りなどの残り時間カウントダウン表示を具体的な日時に変換します。</p>
            </div>
            <a href="WOS_ToDo.html" class="btn" target="_blank" rel="noopener noreferrer">ツールを開く</a>
        </div>
        <div class="tool-card">
            <div class="tool-card-content">
                <h2>ジョイ弓残し計算機</h2>
                <p>ジョイで援軍送るとき、弓だけ残すには盾槍何人送ればよい？と直前に慌てるあなたに贈る！手持ちの兵士数を兵種の優先度に従って計算します。</p>
            </div>
            <a href="WOS_troop_ratio_calc.html" class="btn" target="_blank" rel="noopener noreferrer">ツールを開く</a>
        </div>
        <div class="tool-card">
            <div class="tool-card-content">
                <h2>ギフコ入力補助ブックマークレット</h2>
                <p>ギフココピって交換ページに行って、キャラクターIDコピるためにゲーム戻って…ってめんどくさいよね？交換ページでまとめて一気に入力できます。</p>
            </div>
            <a href="WOS_giftcode_bookmarklet.html" class="btn" target="_blank" rel="noopener noreferrer">ツールを開く</a>
        </div>
        <div class="tool-card">
            <div class="tool-card-content">
                <h2>集結着弾時刻管理</h2>
                <p>同時進行の集結多すぎぃ！なタイムキーパー様に送る、事前に登録した集結主の行軍時間をもとに、発起時刻→着弾時刻、目標着弾時刻→発起時刻の変換ができます。</p>
            </div>
            <a href="WOS_rally_tracker.html" class="btn" target="_blank" rel="noopener noreferrer">ツールを開く</a>
        </div>


    </main>

    <!-- フッター -->
    <footer>
        <p>本サイトは3560サーバのぷにゅが趣味で開発している非公式サイトです。</p>
    </footer>

</div>

</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. WebSocket接続のみをDurable Objectsへ転送（Upgradeヘッダー確認を追加）
    if (
      pathname === "/rally-room" &&
      url.searchParams.has("room") &&
      request.headers.get("Upgrade")?.toLowerCase() === "websocket"
    ) {
      const roomId = url.searchParams.get("room");
      return handleRallyRoom(request, env, roomId);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // 2. ルートアクセス時は埋め込みの index.html を返す
    if (pathname === "/" || pathname === "") {
      return new Response(INDEX_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // 3. getAssetFromKV を廃止し、[assets] 機能 (env.ASSETS.fetch) で静的ファイルを配信
    try {
      let response = await env.ASSETS.fetch(request);
      
      // 拡張子なし（例: /WOS_sunfire_timer）でのアクセスを .html に補完して再取得
      if (response.status === 404 && !pathname.includes(".")) {
        const htmlRequest = new Request(new URL(`${pathname}.html`, request.url), request);
        response = await env.ASSETS.fetch(htmlRequest);
      }

      // ファイルが見つかった場合はそのまま返す
      if (response.status !== 404) {
        return response;
      }
    } catch (error) {
      console.error("Asset fetch error:", error);
    }

    // 4. ファイルが存在しない場合（404）は index.html をフォールバック表示
    return new Response(INDEX_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 404,
    });
  },
};


async function handleRallyRoom(request, env, roomId) {
  if (!ROOM_ID_PATTERN.test(roomId)) {
    return new Response("Invalid room ID", { status: 400 });
  }

  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const id = env.RALLY_ROOMS.idFromName(roomId);
  return env.RALLY_ROOMS.get(id).fetch(request);
}

export class RallyRoom {
  constructor(state) {
    this.state = state;
    this.sockets = new Set();
    this.ownerSocket = null;
    this.isClosing = false;
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const existingState = await this.state.storage.get("roomState");
    const isNew = !existingState;
    if (isNew) {
      await this.state.storage.put("roomState", { leaders: [], rallies: [] });
    }
    server.accept();
    this.sockets.add(server);
    if (isNew) this.ownerSocket = server;
    server.addEventListener("message", (event) => this.handleMessage(server, event));
    server.addEventListener("close", () => this.handleClose(server));

    await this.cleanupExpiredRallies();
    this.sendState(server, await this.getRoomState(), isNew, isNew ? "owner" : "viewer");
    return new Response(null, { status: 101, webSocket: client });
  }

  async handleMessage(webSocket, event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return this.sendError(webSocket, "Invalid message");
    }
    if (message.type === "ping") {
      return; 
    }
    if (webSocket !== this.ownerSocket) {
      return this.sendError(webSocket, "This room is view-only");
    }

    const state = await this.getRoomState();
    switch (message.type) {
      case "upsert-leader":
        if (!isLeader(message.leader)) return this.sendError(webSocket, "Invalid leader");
        state.leaders = state.leaders.filter((leader) => leader.id !== message.leader.id);
        state.leaders.push(message.leader);
        break;
      case "delete-leader":
        if (!isId(message.id)) return this.sendError(webSocket, "Invalid leader ID");
        state.leaders = state.leaders.filter((leader) => leader.id !== message.id);
        break;
      case "upsert-rally":
        if (!isRally(message.rally)) return this.sendError(webSocket, "Invalid rally");
        state.rallies = state.rallies.filter((rally) => rally.id !== message.rally.id);
        state.rallies.push(message.rally);
        break;
      case "delete-rally":
        if (!isId(message.id)) return this.sendError(webSocket, "Invalid rally ID");
        state.rallies = state.rallies.filter((rally) => rally.id !== message.id);
        break;
      default:
        return this.sendError(webSocket, "Unknown message type");
    }

    await this.saveRoomState(state);
    this.broadcastState(state);
  }

  async alarm() {
    await this.cleanupExpiredRallies();
  }

  async handleClose(webSocket) {
    this.sockets.delete(webSocket);
    if (webSocket !== this.ownerSocket || this.isClosing) return;

    this.isClosing = true;
    try {
      await this.state.storage.deleteAll();
      for (const socket of this.sockets) {
        try {
          socket.send(JSON.stringify({ type: "room-closed" }));
          socket.close(1000, "Room owner disconnected");
        } catch {
          this.sockets.delete(socket);
        }
      }
      this.ownerSocket = null;
    } finally {
      this.isClosing = false;
    }
  }

  async getRoomState() {
    return (await this.state.storage.get("roomState")) || { leaders: [], rallies: [] };
  }

  async saveRoomState(roomState) {
    roomState.rallies.sort((a, b) => a.arrivalTimeMs - b.arrivalTimeMs);
    await this.state.storage.put("roomState", roomState);
    const nextExpiry = roomState.rallies.reduce(
      (earliest, rally) => Math.min(earliest, rally.arrivalTimeMs + EXPIRY_GRACE_MS),
      Infinity,
    );
    if (Number.isFinite(nextExpiry)) {
      await this.state.storage.setAlarm(nextExpiry);
    } else {
      await this.state.storage.deleteAlarm();
    }
  }

  async cleanupExpiredRallies() {
    const roomState = await this.getRoomState();
    const now = Date.now();
    const activeRallies = roomState.rallies.filter(
      (rally) => rally.arrivalTimeMs + EXPIRY_GRACE_MS > now,
    );
    if (activeRallies.length !== roomState.rallies.length) {
      roomState.rallies = activeRallies;
      await this.saveRoomState(roomState);
      this.broadcastState(roomState);
    }
  }

  sendState(webSocket, roomState, isNew = false, role = "viewer") {
    webSocket.send(JSON.stringify({ type: "state", ...roomState, isNew, role }));
  }

  broadcastState(roomState) {
    for (const socket of this.sockets) {
      try {
        socket.send(
          JSON.stringify({
            type: "state",
            ...roomState,
            isNew: false,
            role: socket === this.ownerSocket ? "owner" : "viewer",
          }),
        );
      } catch {
        this.sockets.delete(socket);
        socket.close(1011, "Failed to send state");
      }
    }
  }

  sendError(webSocket, message) {
    webSocket.send(JSON.stringify({ type: "error", message }));
  }
}

function isId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function isLeader(leader) {
  return (
    leader &&
    isId(leader.id) &&
    typeof leader.name === "string" &&
    leader.name.length > 0 &&
    leader.name.length <= 100 &&
    Number.isInteger(leader.marchSec) &&
    leader.marchSec > 0 &&
    leader.marchSec <= 24 * 60 * 60 &&
    ["launch", "arrival"].includes(leader.calcMode)
  );
}

function isRally(rally) {
  return (
    rally &&
    isId(rally.id) &&
    isId(rally.leaderId) &&
    typeof rally.leaderName === "string" &&
    rally.leaderName.length > 0 &&
    rally.leaderName.length <= 100 &&
    Number.isInteger(rally.rallyMin) &&
    [1, 5, 10].includes(rally.rallyMin) &&
    Number.isInteger(rally.marchSec) &&
    rally.marchSec > 0 &&
    rally.marchSec <= 24 * 60 * 60 &&
    Number.isFinite(rally.launchTimeMs) &&
    Number.isFinite(rally.arrivalTimeMs) &&
    ["launch", "arrival"].includes(rally.calcMode)
  );
}
