export async function handleFortlessRoom(request, env, roomId) {
  if (!/^[a-f0-9]{64}$/.test(roomId)) {
    return new Response("Invalid room ID", { status: 400 });
  }
  const id = env.FORTLESS_ROOMS.idFromName(roomId);
  return env.FORTLESS_ROOMS.get(id).fetch(request);
}

export { RallyRoom as FortlessRoom } from "./rally-room.js";
