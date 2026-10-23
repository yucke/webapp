const API = "https://discord.com/api/v10";

export class DiscordApiError extends Error {
  constructor(status, code, body) {
    super(`Discord API ${status}`);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function call(method, path, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bot ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new DiscordApiError(res.status, data.code, data);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

export const getGuildRoles = (token, guildId) => call("GET", `/guilds/${guildId}/roles`, token);

export const setNickname = (token, guildId, userId, nick) =>
  call("PATCH", `/guilds/${guildId}/members/${userId}`, token, { nick });

export const addRole = (token, guildId, userId, roleId) =>
  call("PUT", `/guilds/${guildId}/members/${userId}/roles/${roleId}`, token);

// トークン不要（interaction token で認証）
export const editOriginalResponse = (appId, interactionToken, content) =>
  call("PATCH", `/webhooks/${appId}/${interactionToken}/messages/@original`, null, {
    content,
    allowed_mentions: { parse: [] },
  });

export async function verifySignature(request, body, publicKeyHex) {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  if (!signature || !timestamp || !/^[0-9a-f]+$/i.test(signature)) return false;
  const hex = (s) => new Uint8Array(s.match(/../g).map((b) => parseInt(b, 16)));
  try {
    const key = await crypto.subtle.importKey("raw", hex(publicKeyHex), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, hex(signature), new TextEncoder().encode(timestamp + body));
  } catch {
    return false;
  }
}
