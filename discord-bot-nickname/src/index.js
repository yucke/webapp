import { createConfigRepository } from "./config-repository.js";
import { buildNickname } from "./validation.js";
import {
  DiscordApiError,
  addRole,
  editOriginalResponse,
  getGuildRoles,
  setNickname,
  verifySignature,
} from "./discord.js";

const EPHEMERAL = 64;
const MODAL_ID = "nickname_modal";
const ROLE_SELECT_ID = "config_role";
const PANEL_BUTTON_ID = "open_nickname_modal";
const ADMINISTRATOR = 8n;

const isAdmin = (interaction) => (BigInt(interaction.member?.permissions ?? 0) & ADMINISTRATOR) !== 0n;

const ephemeral = (content) => ({ type: 4, data: { content, flags: EPHEMERAL } });

// type: 4=新規メッセージ / 7=元メッセージ更新
async function configScreen(interaction, env, type, notice = "") {
  if (!interaction.guild_id) return ephemeral("サーバー内で実行してください。");
  if (!isAdmin(interaction)) return ephemeral("このコマンドは管理者のみ実行できます。");
  const repo = createConfigRepository(env);
  if (!repo.setRole) return ephemeral("データベースが未設定のため、設定画面は利用できません。");
  const current = (await repo.getGuildConfig(interaction.guild_id))?.roleId;
  const status = current ? `現在の付与ロール: <@&${current}>` : "付与ロールは未設定です。";
  return {
    type,
    data: {
      content: `${notice}${status}\n登録完了時に付与するロールを選択してください。`,
      flags: EPHEMERAL,
      allowed_mentions: { parse: [] },
      components: [
        { type: 1, components: [{ type: 6, custom_id: ROLE_SELECT_ID, placeholder: "ロールを選択", min_values: 1, max_values: 1 }] },
      ],
    },
  };
}

async function saveRole(interaction, env) {
  if (!isAdmin(interaction)) return ephemeral("このコマンドは管理者のみ実行できます。");
  const roleId = interaction.data.values[0];
  const role = interaction.data.resolved?.roles?.[roleId];
  if (!role || roleId === interaction.guild_id || role.managed) {
    return configScreen(interaction, env, 7, "このロールは選択できません。別のロールを選んでください。\n");
  }
  await createConfigRepository(env).setRole(interaction.guild_id, roleId, interaction.member.user.id);
  return configScreen(interaction, env, 7, "保存しました。\n");
}

const json = (data) =>
  new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });

function textInput(id, label, placeholder, min, max) {
  return {
    type: 1,
    components: [{ type: 4, custom_id: id, label, style: 1, min_length: min, max_length: max, placeholder, required: true }],
  };
}

const rankSelect = {
  type: 18,
  label: "階級",
  component: {
    type: 3,
    custom_id: "rank",
    placeholder: "階級を選択",
    options: ["R5", "R4", "R3", "R2", "R1"].map((r) => ({ label: r, value: r })),
  },
};

const modal = () => ({
  type: 9,
  data: {
    custom_id: MODAL_ID,
    title: "ニックネーム登録",
    components: [
      textInput("tag", "同盟（半角英数字3文字）", "SPL", 3, 3),
      textInput("name", "名前（1〜23文字）", "サンプルさん", 1, 23),
      rankSelect,
    ],
  },
});

function fieldValues(interaction) {
  const values = {};
  for (const row of interaction.data.components) {
    const items = row.component ? [row.component] : row.components;
    for (const c of items) values[c.custom_id] = c.value ?? c.values?.[0] ?? "";
  }
  return { tag: values.tag ?? "", name: values.name ?? "", rank: values.rank ?? "" };
}

function describeDiscordError(e) {
  if (e instanceof DiscordApiError) {
    if (e.code === 50013 || e.status === 403) {
      return "権限エラー: サーバー所有者やBotより上位のロールを持つユーザーは変更できません。Botのロール位置と権限も確認してください。";
    }
    return `Discord APIエラー (${e.status})。時間をおいて再実行してください。`;
  }
  return "予期しないエラーが発生しました。時間をおいて再実行してください。";
}

async function processRegistration(interaction, env) {
  const guildId = interaction.guild_id;
  const userId = interaction.member.user.id;
  const token = env.DISCORD_BOT_TOKEN;
  let message;
  try {
    const config = await createConfigRepository(env).getGuildConfig(guildId);
    if (!config) {
      message = "このサーバーは初期設定が行われていません。管理者に連絡してください。";
    } else {
      const result = buildNickname(fieldValues(interaction), config);
      if (!result.ok) {
        message = result.error;
      } else {
        const roles = await getGuildRoles(token, guildId);
        if (!roles.some((r) => r.id === config.roleId)) {
          message = "設定されたロールがサーバーに存在しません。管理者に連絡してください。";
        } else {
          await setNickname(token, guildId, userId, result.nickname);
          if (!interaction.member.roles.includes(config.roleId)) {
            await addRole(token, guildId, userId, config.roleId);
          }
          message = `登録しました: ${result.nickname}`;
        }
      }
    }
  } catch (e) {
    console.error(e);
    message = describeDiscordError(e);
  }
  await editOriginalResponse(interaction.application_id, interaction.token, message);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    const body = await request.text();
    if (!(await verifySignature(request, body, env.DISCORD_PUBLIC_KEY))) {
      return new Response("Invalid signature", { status: 401 });
    }
    const interaction = JSON.parse(body);

    if (interaction.type === 1) return json({ type: 1 });

    if (interaction.type === 2 && interaction.data.name === "nickname") {
      if (!interaction.guild_id) {
        return json({ type: 4, data: { content: "サーバー内で実行してください。", flags: EPHEMERAL } });
      }
      return json(modal());
    }

    if (interaction.type === 5 && interaction.data.custom_id === MODAL_ID) {
      ctx.waitUntil(processRegistration(interaction, env));
      return json({ type: 5, data: { flags: EPHEMERAL } });
    }

    if (interaction.type === 2 && interaction.data.name === "config") {
      return json(await configScreen(interaction, env, 4));
    }

    if (interaction.type === 3 && interaction.data.custom_id === ROLE_SELECT_ID) {
      return json(await saveRole(interaction, env));
    }

    if (interaction.type === 2 && interaction.data.name === "nickname-panel") {
      if (!interaction.guild_id) return json(ephemeral("サーバー内で実行してください。"));
      if (!isAdmin(interaction)) return json(ephemeral("このコマンドは管理者のみ実行できます。"));
      return json({
        type: 4,
        data: {
          content: "**ニックネーム登録**\n下のボタンを押して、同盟・名前・階級を登録してください。",
          components: [
            { type: 1, components: [{ type: 2, style: 1, label: "名前を設定する", custom_id: PANEL_BUTTON_ID }] },
          ],
        },
      });
    }

    if (interaction.type === 3 && interaction.data.custom_id === PANEL_BUTTON_ID) {
      return json(modal());
    }

    return new Response("Bad Request", { status: 400 });
  },
};
