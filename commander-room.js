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
    this.membersLoaded = false;
  }

  async fetch(request) {
    // 誰も接続しておらず、最終更新から6時間以上経過していればデータをクリアする
    const lastUpdated = await this.state.storage.get('last_updated') || 0;
    const now = Date.now();
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    
    if (this.sessions.length === 0 && lastUpdated > 0 && (now - lastUpdated) > SIX_HOURS_MS) {
      await this.state.storage.deleteAll();
      this.members.clear();
      this.membersLoaded = false;
    }

    await this.loadMembers();
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
    await this.loadMembers();
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
        await this.state.storage.put('last_updated', now);
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
            rally_minutes: existing.rally_minutes || 0,
            rally_start_time: existing.rally_start_time || null,
            march_start_time: existing.march_start_time || null,
            target_time: existing.target_time,
            departure_time: existing.departure_time
          });
          await this.saveMembers();
        }
        this.broadcastState();
        break;

      case 'add-member':
        if (session.role !== 'commander') return;
        if (!payload || typeof payload.member_id !== 'string' || typeof payload.name !== 'string' ||
            !payload.name.trim() || !Number.isFinite(Number(payload.march_time)) || Number(payload.march_time) <= 0) {
          return;
        }
        this.members.set(payload.member_id, {
          member_id: payload.member_id,
          name: payload.name.trim(),
          march_time: Number(payload.march_time),
          rally_minutes: 0,
          rally_start_time: null,
          march_start_time: null,
          target_time: null,
          departure_time: null,
        });
        await this.saveMembers();
        this.broadcastState();
        break;

      case 'command_ready':
        if (session.role !== 'commander') return;

        if (!Array.isArray(payload?.target_member_ids)) return;
        const rallyMinutesReady = [0, 1, 5, 10].includes(Number(payload.rally_minutes))
          ? Number(payload.rally_minutes)
          : 0;

        let maxMarchTime = 0;
        for (const id of payload.target_member_ids) {
          const member = this.members.get(id);
          if (member && member.march_time > maxMarchTime) {
            maxMarchTime = member.march_time;
          }
        }

        const departureTimeReady = now + 5000;
        const marchStartTimeReady = departureTimeReady + rallyMinutesReady * 60 * 1000;
        const targetTimeReady = marchStartTimeReady + maxMarchTime * 1000;
        for (const id of payload.target_member_ids) {
          const member = this.members.get(id);
          if (member) {
            const memberMarchTime = Number(member.march_time) || 0;
            const memberDepartureTime = departureTimeReady + (maxMarchTime - memberMarchTime) * 1000;
            const memberMarchStartTime = memberDepartureTime + rallyMinutesReady * 60 * 1000;
            member.rally_minutes = rallyMinutesReady;
            member.rally_start_time = memberDepartureTime;
            member.march_start_time = memberMarchStartTime;
            member.target_time = targetTimeReady;
            member.departure_time = memberDepartureTime;
          }
        }
        await this.saveMembers();
        this.broadcastState();
        break;

      case 'command_target':
        if (session.role !== 'commander') return;

        const targetTime = payload.target_time;
        if (!Number.isFinite(targetTime) || !Array.isArray(payload.target_member_ids)) return;
        const rallyMinutesTarget = [0, 1, 5, 10].includes(Number(payload.rally_minutes))
          ? Number(payload.rally_minutes)
          : 0;
        const selectedMembers = payload.target_member_ids
          .map((id) => this.members.get(id))
          .filter(Boolean);
        const longestMarchTime = selectedMembers.reduce(
          (longest, member) => Math.max(longest, Number(member.march_time) || 0),
          0,
        );
        if (targetTime < now + (longestMarchTime + rallyMinutesTarget * 60) * 1000) {
          session.ws.send(JSON.stringify({
            type: 'command-error',
            message: '指定時刻では間に合わないメンバがいます',
          }));
          return;
        }
        for (const id of payload.target_member_ids) {
          const member = this.members.get(id);
          if (member) {
            const marchStartTime = targetTime - member.march_time * 1000;
            member.rally_minutes = rallyMinutesTarget;
            member.rally_start_time = marchStartTime - rallyMinutesTarget * 60 * 1000;
            member.march_start_time = marchStartTime;
            member.target_time = targetTime;
            member.departure_time = marchStartTime;
          }
        }
        await this.saveMembers();
        this.broadcastState();
        break;

      case 'reset-members':
        if (session.role !== 'commander' || !Array.isArray(payload?.target_member_ids)) return;
        for (const id of payload.target_member_ids) {
          const member = this.members.get(id);
          if (!member) continue;
          member.target_time = null;
          member.departure_time = null;
          member.rally_start_time = null;
          member.march_start_time = null;
          member.rally_minutes = 0;
          for (const memberSession of this.sessions) {
            if (memberSession.role === 'member' && memberSession.member_id === id && memberSession.ws.readyState === 1) {
              memberSession.ws.send(JSON.stringify({
                type: 'member-reset',
                payload: { departure_time: null, target_time: null },
              }));
            }
          }
        }
        await this.saveMembers();
        this.broadcastState();
        break;

      case 'remove-members':
        if (session.role !== 'commander' || !Array.isArray(payload?.target_member_ids)) return;
        for (const id of payload.target_member_ids) {
          this.members.delete(id);
          // 削除されたメンバに対してもリセット（未接続状態へ戻す）通知を送る
          for (const memberSession of this.sessions) {
            if (memberSession.role === 'member' && memberSession.member_id === id && memberSession.ws.readyState === 1) {
              memberSession.ws.send(JSON.stringify({
                type: 'member-reset',
                payload: { departure_time: null, target_time: null },
              }));
            }
          }
        }
        await this.saveMembers();
        this.broadcastState();
        break;
        
      case 'close-room':
        if (session.role !== 'commander') return;
        await this.closeRoom();
        break;
    }
  }

  async closeRoom() {
    await this.state.storage.deleteAll();
    for (const session of this.sessions) {
      try {
        session.ws.send(JSON.stringify({ type: 'room-closed' }));
        session.ws.close(1000, 'Room closed by commander');
      } catch {
        // 既に切断された接続は破棄する
      }
    }
    this.sessions = [];
    this.members.clear();
  }

  async loadMembers() {
    if (this.membersLoaded) return;
    const storedMembers = await this.state.storage.get('commanderMembers');
    if (Array.isArray(storedMembers)) {
      this.members = new Map(storedMembers.map((member) => [member.member_id, member]));
    }
    this.membersLoaded = true;
  }

  async saveMembers() {
    await this.state.storage.put('commanderMembers', Array.from(this.members.values()));
    await this.state.storage.put('last_updated', Date.now());
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