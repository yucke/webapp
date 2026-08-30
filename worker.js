const ROOM_ID_PATTERN = /^[a-f0-9]{64}$/;
const EXPIRY_GRACE_MS = 5 * 60 * 1000;

export default {
  async fetch(request, env) {
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const roomId = url.searchParams.get("room") || "";
    if (!ROOM_ID_PATTERN.test(roomId)) {
      return new Response("Invalid room ID", { status: 400 });
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const id = env.RALLY_ROOMS.idFromName(roomId);
    return env.RALLY_ROOMS.get(id).fetch(request);
  },
};

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

  if (webSocket !== this.ownerSocket) {
    return this.sendError(webSocket, "This room is view-only");
  }

  async handleMessage(webSocket, event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return this.sendError(webSocket, "Invalid message");
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
    this.isClosing = false;
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
    const message = JSON.stringify({ type: "state", ...roomState });
    for (const socket of this.sockets) {
      try {
        socket.send(message);
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
