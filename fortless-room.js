export async function handleFortlessRoom(request, env, roomId) {
  if (!/^[a-f0-9]{64}$/.test(roomId)) {
    return new Response("Invalid room ID", { status: 400 });
  }
  const id = env.FORTLESS_ROOMS.idFromName(roomId);
  return env.FORTLESS_ROOMS.get(id).fetch(request);
}

export class FortlessRoom {
  constructor(state) {
    this.state = state;
    this.sessions = new Set();
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.sessions.add(server);
    server.addEventListener("message", (event) => this.handleMessage(server, event));
    server.addEventListener("close", () => this.sessions.delete(server));
    server.addEventListener("error", () => this.sessions.delete(server));

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleMessage(webSocket, event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.type === "ping") return;

    if (message.type === "get-state") {
      const state = await this.getAllocatorState();
      this.sendState(webSocket, state);
      return;
    }

    if (message.type !== "update-state" || !message.payload?.state) return;

    const nextState = message.payload.state;
    if (!isAllocatorState(nextState)) return;

    await this.state.storage.put("allocatorState", nextState);
    this.broadcastState(nextState);
  }

  async getAllocatorState() {
    return (await this.state.storage.get("allocatorState")) || {
      status: "setup",
      alliances: [],
    };
  }

  sendState(webSocket, allocatorState) {
    webSocket.send(JSON.stringify({ type: "state", ...allocatorState }));
  }

  broadcastState(allocatorState) {
    for (const webSocket of this.sessions) {
      if (webSocket.readyState !== 1) {
        this.sessions.delete(webSocket);
        continue;
      }
      try {
        this.sendState(webSocket, allocatorState);
      } catch {
        this.sessions.delete(webSocket);
      }
    }
  }
}

function isAllocatorState(value) {
  return (
    value &&
    ["setup", "input", "complete"].includes(value.status) &&
    Array.isArray(value.alliances)
  );
}
