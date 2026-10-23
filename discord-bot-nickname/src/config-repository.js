// 設定取得のインターフェース: getGuildConfig(guildId) => { roleId, tagMode, allowedTags } | null

export class EnvConfigRepository {
  constructor(env) {
    this.env = env;
  }

  async getGuildConfig(guildId) {
    if (!this.env.GUILD_ID || guildId !== this.env.GUILD_ID || !this.env.VERIFIED_ROLE_ID) return null;
    return { roleId: this.env.VERIFIED_ROLE_ID, tagMode: "ANY", allowedTags: [] };
  }
}

// フェーズ2用。テーブル:
// guild_config(guild_id TEXT PRIMARY KEY, role_id TEXT, tag_mode TEXT DEFAULT 'ANY', updated_by TEXT, updated_at TEXT)
// guild_allowed_tags(guild_id TEXT, tag TEXT, PRIMARY KEY(guild_id, tag))
export class D1ConfigRepository {
  constructor(db) {
    this.db = db;
  }

  async getGuildConfig(guildId) {
    const row = await this.db
      .prepare("SELECT role_id, tag_mode FROM guild_config WHERE guild_id = ?")
      .bind(guildId)
      .first();
    if (!row || !row.role_id) return null;
    const { results } = await this.db
      .prepare("SELECT tag FROM guild_allowed_tags WHERE guild_id = ?")
      .bind(guildId)
      .all();
    return { roleId: row.role_id, tagMode: row.tag_mode, allowedTags: results.map((r) => r.tag) };
  }

  async setRole(guildId, roleId, userId) {
    await this.db
      .prepare(
        `INSERT INTO guild_config (guild_id, role_id, updated_by, updated_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(guild_id) DO UPDATE SET role_id = ?2, updated_by = ?3, updated_at = ?4`,
      )
      .bind(guildId, roleId, userId, new Date().toISOString())
      .run();
  }
}

// 差し替え箇所はここだけ
export function createConfigRepository(env) {
  return env.DB ? new D1ConfigRepository(env.DB) : new EnvConfigRepository(env);
}
