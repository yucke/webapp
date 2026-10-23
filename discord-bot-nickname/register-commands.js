// 使い方: DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... [GUILD_ID=...] node register-commands.js
// GUILD_ID 指定時はそのサーバーのみ、未指定時は全サーバー共通（反映に時間がかかる場合あり）
const { DISCORD_APP_ID, DISCORD_BOT_TOKEN, GUILD_ID } = process.env;

const url = GUILD_ID
  ? `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${GUILD_ID}/commands`
  : `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands`;

const commands = [
  { name: "nickname", description: "ニックネームを登録・変更します", type: 1, dm_permission: false },
  {
    name: "config",
    description: "付与ロールなどサーバー設定を行います（管理者のみ）",
    type: 1,
    dm_permission: false,
    default_member_permissions: "8",
  },
  {
    name: "nickname-panel",
    description: "ニックネーム登録の案内メッセージをこのチャンネルに投稿します（管理者のみ）",
    type: 1,
    dm_permission: false,
    default_member_permissions: "8",
  },
];

const res = await fetch(url, {
  method: "PUT",
  headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(commands),
});
console.log(res.status, await res.text());
