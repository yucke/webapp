export async function handleCommanderRoom(request, env, roomId) {
  if (!roomId || roomId.length > 64) {
    return new Response("Invalid room ID", { status: 400 });
  }
  const id = env.COMMANDER_ROOMS.idFromName(roomId);
  return env.COMMANDER_ROOMS.get(id).fetch(request);
}

export class CommanderRoom {
  constructor(state, env) {
    this.state = state;
    this.members = new Map();
    this.sessions = [];
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    const session = { ws: server, role: 'unknown', member_id: null };
    this.sessions.push(session);

    server.addEventListener("message", (event) => this.handleMessage(session, event));
    server.addEventListener("close", () => {
      this.sessions = this.sessions.filter(s => s !== session);
    });
    server.addEventListener("error", () => {
      this.sessions = this.sessions.filter(s => s !== session);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleMessage(session, event) {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    const { type, payload } = data;
    const now = Date.now();

    switch (type) {
      case 'get-state':
        {
          const allocatorState = await this.state.storage.get('allocatorState');
          if (allocatorState) {
            session.ws.send(JSON.stringify({ type: 'state', ...allocatorState }));
          }
        }
        break;

      case 'update-state':
        if (!payload?.state || typeof payload.state.status !== 'string' || !Array.isArray(payload.state.alliances)) {
          return;
        }
        const allocatorState = {
          status: payload.state.status,
          alliances: payload.state.alliances
        };
        await this.state.storage.put('allocatorState', allocatorState);
        for (const currentSession of this.sessions) {
          if (currentSession.ws.readyState === 1) {
            currentSession.ws.send(JSON.stringify({ type: 'state', ...allocatorState }));
          }
        }
        break;

      case 'ping':
        session.ws.send(JSON.stringify({
          type: 'pong',
          payload: {
            client_time: payload.client_time,
            server_time: now
          }
        }));
        break;

      case 'join':
        session.role = payload.role;
        if (payload.role === 'member') {
          session.member_id = payload.member_id;
          const existing = this.members.get(payload.member_id) || {
            target_time: null,
            departure_time: null
          };

          this.members.set(payload.member_id, {
            member_id: payload.member_id,
            name: payload.name,
            march_time: payload.march_time,
            target_time: existing.target_time,
            departure_time: existing.departure_time
          });
        }
        this.broadcastState();
        break;

      case 'command_ready':
        if (session.role !== 'commander') return;

        let maxMarchTime = 0;
        for (const id of payload.target_member_ids) {
          const member = this.members.get(id);
          if (member && member.march_time > maxMarchTime) {
            maxMarchTime = member.march_time;
          }
        }

        const targetTimeReady = now + 5000 + (maxMarchTime * 1000);
        for (const id of payload.target_member_ids) {
          const member = this.members.get(id);
          if (member) {
            member.target_time = targetTimeReady;
            member.departure_time = targetTimeReady - (member.march_time * 1000);
          }
        }
        this.broadcastState();
        break;

      case 'command_target':
        if (session.role !== 'commander') return;

        const targetTime = payload.target_time;
        for (const id of payload.target_member_ids) {
          const member = this.members.get(id);
          if (member) {
            member.target_time = targetTime;
            member.departure_time = targetTime - (member.march_time * 1000);
          }
        }
        this.broadcastState();
        break;
    }
  }

  broadcastState() {
    const allMembers = Array.from(this.members.values());
    for (const session of this.sessions) {
      if (session.ws.readyState !== 1) continue;

      if (session.role === 'commander') {
        session.ws.send(JSON.stringify({
          type: 'state_update',
          payload: { members: allMembers }
        }));
      } else if (session.role === 'member' && session.member_id) {
        const myData = this.members.get(session.member_id);
        if (myData) {
          session.ws.send(JSON.stringify({
            type: 'state_update',
            payload: myData
          }));
        }
      }
    }
  }
}


