import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS members (
  guild_id        TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  discord_tag     TEXT,
  htb_username    TEXT NOT NULL,
  htb_user_id     TEXT,
  htb_account_id  TEXT,
  experience_url  TEXT,
  last_xp         INTEGER,
  last_synced_at  TEXT,
  PRIMARY KEY (guild_id, discord_user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_guild ON members(guild_id);
`;

let db;

export function getDb() {
  if (!db) {
    const path = process.env.DATABASE_PATH || './data/bot.db';
    mkdirSync(dirname(path), { recursive: true });
    db = new Database(path);
    db.exec(SCHEMA);
  }
  return db;
}

export function upsertMember(row) {
  const stmt = getDb().prepare(`
    INSERT INTO members (
      guild_id, discord_user_id, discord_tag, htb_username,
      htb_user_id, htb_account_id, experience_url, last_xp, last_synced_at
    ) VALUES (
      @guild_id, @discord_user_id, @discord_tag, @htb_username,
      @htb_user_id, @htb_account_id, @experience_url, @last_xp, @last_synced_at
    )
    ON CONFLICT (guild_id, discord_user_id) DO UPDATE SET
      discord_tag = excluded.discord_tag,
      htb_username = excluded.htb_username,
      htb_user_id = excluded.htb_user_id,
      htb_account_id = excluded.htb_account_id,
      experience_url = excluded.experience_url,
      last_xp = excluded.last_xp,
      last_synced_at = excluded.last_synced_at
  `);
  return stmt.run(row);
}

export function getMember(guildId, discordUserId) {
  return getDb()
    .prepare('SELECT * FROM members WHERE guild_id = ? AND discord_user_id = ?')
    .get(guildId, discordUserId);
}

export function deleteMember(guildId, discordUserId) {
  return getDb()
    .prepare('DELETE FROM members WHERE guild_id = ? AND discord_user_id = ?')
    .run(guildId, discordUserId);
}

export function listGuildMembers(guildId) {
  return getDb()
    .prepare('SELECT * FROM members WHERE guild_id = ? ORDER BY htb_username')
    .all(guildId);
}

export function updateMemberXp(guildId, discordUserId, lastXp, lastSyncedAt) {
  return getDb()
    .prepare(
      'UPDATE members SET last_xp = ?, last_synced_at = ? WHERE guild_id = ? AND discord_user_id = ?'
    )
    .run(lastXp, lastSyncedAt, guildId, discordUserId);
}
