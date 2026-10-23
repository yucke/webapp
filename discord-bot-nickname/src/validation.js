const MAX_NICK = 32;
const MAX_NAME = 23;
const RANKS = ["R1", "R2", "R3", "R4", "R5"];

// 成功: { ok: true, nickname } / 失敗: { ok: false, error }
export function buildNickname({ tag, name, rank }, config) {
  if (!/^[a-zA-Z0-9]{3}$/.test(tag)) {
    return { ok: false, error: "同盟タグは半角英数字3文字で入力してください。" };
  }
  if (config.tagMode === "WHITELIST" && !config.allowedTags.includes(tag)) {
    return { ok: false, error: `同盟タグ「${tag}」は登録できません。` };
  }
  const trimmed = name.trim();
  if (trimmed.length < 1 || [...trimmed].length > MAX_NAME) {
    return { ok: false, error: "名前は1〜23文字で入力してください。" };
  }
  const upperRank = rank.trim().toUpperCase();
  if (!RANKS.includes(upperRank)) {
    return { ok: false, error: "階級は R1〜R5 のいずれかを指定してください。" };
  }
  const nickname = `[${tag}]${trimmed}（${upperRank}）`;
  if ([...nickname].length > MAX_NICK) {
    return { ok: false, error: "ニックネームが32文字を超えます。名前を短くしてください。" };
  }
  return { ok: true, nickname };
}
