CREATE TABLE guild_config (
  guild_id TEXT PRIMARY KEY,
  role_id TEXT,
  tag_mode TEXT NOT NULL DEFAULT 'ANY',
  updated_by TEXT,
  updated_at TEXT
);

CREATE TABLE guild_allowed_tags (
  guild_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (guild_id, tag)
);
