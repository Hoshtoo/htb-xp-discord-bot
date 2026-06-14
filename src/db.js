import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS members (
 guild_id TEXT NOT NULL,
 discord_user_id TEXT NOT NULL,
 discord_tag TEXT,
 htb_username TEXT NOT NULL,
 htb_user_id TEXT,
 htb_account_id TEXT,
 experience_url TEXT,
 last_xp INTEGER,
 last_synced_at TEXT,
 PRIMARY KEY (guild_id, discord_user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_guild ON members(guild_id);

CREATE TABLE IF NOT EXISTS xp_snapshots (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guild_id TEXT NOT NULL,
 discord_user_id TEXT NOT NULL,
 total_xp INTEGER NOT NULL,
 captured_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_xp_snapshots_period
 ON xp_snapshots (guild_id, discord_user_id, captured_at);

CREATE TABLE IF NOT EXISTS scheduler_runs (
 job TEXT PRIMARY KEY,
 period_key TEXT NOT NULL,
 ran_at TEXT NOT NULL
);

-- Per-guild own/activity notification settings.
CREATE TABLE IF NOT EXISTS guild_settings (
 guild_id TEXT PRIMARY KEY,
 notify_channel_id TEXT,
 notify_enabled INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT
);

-- Tracks whether a member's activity feed has been seeded (first poll
-- records existing owns silently so we don't spam historical activity).
CREATE TABLE IF NOT EXISTS activity_cursors (
 guild_id TEXT NOT NULL,
 discord_user_id TEXT NOT NULL,
 last_own_date TEXT,
 seeded INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT,
 PRIMARY KEY (guild_id, discord_user_id)
);

-- Dedupe ledger: one row per (guild, member, event). Guarantees an own is
-- announced at most once even across restarts or overlapping polls.
CREATE TABLE IF NOT EXISTS posted_events (
 guild_id TEXT NOT NULL,
 discord_user_id TEXT NOT NULL,
 event_key TEXT NOT NULL,
 own_date TEXT,
 posted_at TEXT NOT NULL,
 PRIMARY KEY (guild_id, discord_user_id, event_key)
);
CREATE INDEX IF NOT EXISTS idx_posted_events_posted_at
 ON posted_events (posted_at);
`;

const SNAPSHOT_RETENTION_DAYS = 90;
const POSTED_EVENT_RETENTION_DAYS = 45;

let db;

function migrateMembersTable(database) {
 const columns = database.prepare('PRAGMA table_info(members)').all();
 if (!columns.some((c) => c.name === 'server_nick')) {
 database.exec('ALTER TABLE members ADD COLUMN server_nick TEXT');
 console.log('Database migration: added members.server_nick column');
 }
 if (!columns.some((c) => c.name === 'notify_opt_out')) {
 database.exec(
 'ALTER TABLE members ADD COLUMN notify_opt_out INTEGER NOT NULL DEFAULT 0'
 );
 console.log('Database migration: added members.notify_opt_out column');
 }
}

export function getDb() {
 if (!db) {
 const path = process.env.DATABASE_PATH || './data/bot.db';
 mkdirSync(dirname(path), { recursive: true });
 db = new Database(path);
 db.exec(SCHEMA);
 migrateMembersTable(db);
 }
 return db;
}

export function upsertMember(row) {
 const stmt = getDb().prepare(`
 INSERT INTO members (
 guild_id, discord_user_id, discord_tag, server_nick, htb_username,
 htb_user_id, htb_account_id, experience_url, last_xp, last_synced_at
 ) VALUES (
 @guild_id, @discord_user_id, @discord_tag, @server_nick, @htb_username,
 @htb_user_id, @htb_account_id, @experience_url, @last_xp, @last_synced_at
 )
 ON CONFLICT (guild_id, discord_user_id) DO UPDATE SET
 discord_tag = excluded.discord_tag,
 server_nick = excluded.server_nick,
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
 const database = getDb();
 database
 .prepare('DELETE FROM xp_snapshots WHERE guild_id = ? AND discord_user_id = ?')
 .run(guildId, discordUserId);
 database
 .prepare('DELETE FROM activity_cursors WHERE guild_id = ? AND discord_user_id = ?')
 .run(guildId, discordUserId);
 database
 .prepare('DELETE FROM posted_events WHERE guild_id = ? AND discord_user_id = ?')
 .run(guildId, discordUserId);
 return database
 .prepare('DELETE FROM members WHERE guild_id = ? AND discord_user_id = ?')
 .run(guildId, discordUserId);
}

export function listGuildMembers(guildId) {
 return getDb()
 .prepare('SELECT * FROM members WHERE guild_id = ? ORDER BY htb_username')
 .all(guildId);
}

export function listAllLinkedMembers() {
 return getDb()
 .prepare(
 `SELECT * FROM members
 WHERE experience_url IS NOT NULL AND experience_url != ''
 ORDER BY guild_id, htb_username`
 )
 .all();
}

export function getSchedulerRun(job) {
 return getDb().prepare('SELECT * FROM scheduler_runs WHERE job = ?').get(job);
}

export function setSchedulerRun(job, periodKey, ranAt) {
 return getDb()
 .prepare(
 `INSERT INTO scheduler_runs (job, period_key, ran_at)
 VALUES (?, ?, ?)
 ON CONFLICT (job) DO UPDATE SET
 period_key = excluded.period_key,
 ran_at = excluded.ran_at`
 )
 .run(job, periodKey, ranAt.toISOString());
}

/** All guild rows for a Discord user (e.g. cross-server /link hints). */
export function listMemberRowsForDiscordUser(discordUserId) {
 return getDb()
 .prepare(
 'SELECT guild_id, htb_username, discord_tag, server_nick FROM members WHERE discord_user_id = ?'
 )
 .all(discordUserId);
}

/** Reuse a verified Experience URL from another guild for the same Discord + HTB user. */
export function findReusableExperienceLink(discordUserId, htbUserId) {
 return getDb()
 .prepare(
 `SELECT experience_url, htb_account_id, last_xp, htb_username
 FROM members
 WHERE discord_user_id = ?
 AND htb_user_id = ?
 AND experience_url IS NOT NULL
 AND experience_url NOT LIKE '%/xp-earned%'
 AND last_xp IS NOT NULL
 ORDER BY last_synced_at DESC
 LIMIT 1`
 )
 .get(discordUserId, htbUserId);
}

export function updateMemberXp(guildId, discordUserId, lastXp, lastSyncedAt) {
 return getDb()
 .prepare(
 'UPDATE members SET last_xp = ?, last_synced_at = ? WHERE guild_id = ? AND discord_user_id = ?'
 )
 .run(lastXp, lastSyncedAt, guildId, discordUserId);
}

export function updateMemberDiscordTag(guildId, discordUserId, discordTag) {
 return getDb()
 .prepare(
 'UPDATE members SET discord_tag = ? WHERE guild_id = ? AND discord_user_id = ?'
 )
 .run(discordTag, guildId, discordUserId);
}

export function updateMemberDisplayNames(
 guildId,
 discordUserId,
 displayName,
 serverNick = null
) {
 return getDb()
 .prepare(
 `UPDATE members SET discord_tag = ?, server_nick = ?
 WHERE guild_id = ? AND discord_user_id = ?`
 )
 .run(displayName, serverNick, guildId, discordUserId);
}

export function getLatestSnapshot(guildId, discordUserId) {
 return getDb()
 .prepare(
 `SELECT total_xp, captured_at FROM xp_snapshots
 WHERE guild_id = ? AND discord_user_id = ?
 ORDER BY captured_at DESC LIMIT 1`
 )
 .get(guildId, discordUserId);
}

export function insertXpSnapshot(guildId, discordUserId, totalXp, capturedAt) {
 return getDb()
 .prepare(
 `INSERT INTO xp_snapshots (guild_id, discord_user_id, total_xp, captured_at)
 VALUES (?, ?, ?, ?)`
 )
 .run(guildId, discordUserId, totalXp, capturedAt);
}

export function getBaselineXp(guildId, discordUserId, periodStartIso) {
 const row = getDb()
 .prepare(
 `SELECT total_xp FROM xp_snapshots
 WHERE guild_id = ? AND discord_user_id = ? AND captured_at <= ?
 ORDER BY captured_at DESC LIMIT 1`
 )
 .get(guildId, discordUserId, periodStartIso);
 return row?.total_xp ?? null;
}

export function getFirstSnapshotInPeriod(guildId, discordUserId, periodStartIso, periodEndIso) {
 const row = getDb()
 .prepare(
 `SELECT total_xp FROM xp_snapshots
 WHERE guild_id = ? AND discord_user_id = ?
 AND captured_at > ? AND captured_at <= ?
 ORDER BY captured_at ASC LIMIT 1`
 )
 .get(guildId, discordUserId, periodStartIso, periodEndIso);
 return row?.total_xp ?? null;
}

export function pruneSnapshots() {
 const cutoff = new Date();
 cutoff.setUTCDate(cutoff.getUTCDate() - SNAPSHOT_RETENTION_DAYS);
 const cutoffIso = cutoff.toISOString();
 return getDb()
 .prepare('DELETE FROM xp_snapshots WHERE captured_at < ?')
 .run(cutoffIso);
}

/* ------------------------------------------------------------------ */
/* Notification settings                                              */
/* ------------------------------------------------------------------ */

export function getGuildSettings(guildId) {
 return getDb()
 .prepare('SELECT * FROM guild_settings WHERE guild_id = ?')
 .get(guildId);
}

export function listNotifyEnabledGuilds() {
 return getDb()
 .prepare(
 `SELECT * FROM guild_settings
 WHERE notify_enabled = 1
 AND notify_channel_id IS NOT NULL
 AND notify_channel_id != ''`
 )
 .all();
}

export function setNotifyChannel(guildId, channelId) {
 const now = new Date().toISOString();
 return getDb()
 .prepare(
 `INSERT INTO guild_settings (guild_id, notify_channel_id, notify_enabled, updated_at)
 VALUES (?, ?, 1, ?)
 ON CONFLICT (guild_id) DO UPDATE SET
 notify_channel_id = excluded.notify_channel_id,
 notify_enabled = 1,
 updated_at = excluded.updated_at`
 )
 .run(guildId, channelId, now);
}

export function setNotifyEnabled(guildId, enabled) {
 const now = new Date().toISOString();
 return getDb()
 .prepare(
 `INSERT INTO guild_settings (guild_id, notify_channel_id, notify_enabled, updated_at)
 VALUES (?, NULL, ?, ?)
 ON CONFLICT (guild_id) DO UPDATE SET
 notify_enabled = excluded.notify_enabled,
 updated_at = excluded.updated_at`
 )
 .run(guildId, enabled ? 1 : 0, now);
}

/* ------------------------------------------------------------------ */
/* Per-member opt out                                                 */
/* ------------------------------------------------------------------ */

export function setMemberNotifyOptOut(guildId, discordUserId, optOut) {
 return getDb()
 .prepare(
 'UPDATE members SET notify_opt_out = ? WHERE guild_id = ? AND discord_user_id = ?'
 )
 .run(optOut ? 1 : 0, guildId, discordUserId);
}

/** Linked members in a guild who have NOT opted out and have an HTB user id. */
export function listNotifiableMembers(guildId) {
 return getDb()
 .prepare(
 `SELECT * FROM members
 WHERE guild_id = ?
 AND notify_opt_out = 0
 AND htb_user_id IS NOT NULL
 AND htb_user_id != ''
 ORDER BY htb_username`
 )
 .all(guildId);
}

/* ------------------------------------------------------------------ */
/* Activity cursors + dedupe ledger                                   */
/* ------------------------------------------------------------------ */

export function getActivityCursor(guildId, discordUserId) {
 return getDb()
 .prepare(
 'SELECT * FROM activity_cursors WHERE guild_id = ? AND discord_user_id = ?'
 )
 .get(guildId, discordUserId);
}

export function upsertActivityCursor(guildId, discordUserId, { lastOwnDate, seeded }) {
 const now = new Date().toISOString();
 return getDb()
 .prepare(
 `INSERT INTO activity_cursors (guild_id, discord_user_id, last_own_date, seeded, updated_at)
 VALUES (?, ?, ?, ?, ?)
 ON CONFLICT (guild_id, discord_user_id) DO UPDATE SET
 last_own_date = COALESCE(excluded.last_own_date, activity_cursors.last_own_date),
 seeded = excluded.seeded,
 updated_at = excluded.updated_at`
 )
 .run(guildId, discordUserId, lastOwnDate ?? null, seeded ? 1 : 0, now);
}

/**
 * Record an event as posted. Returns true if this is the first time we see it
 * (i.e. it should be announced), false if it was already recorded.
 */
export function markEventPosted(guildId, discordUserId, eventKey, ownDate) {
 const now = new Date().toISOString();
 const info = getDb()
 .prepare(
 `INSERT OR IGNORE INTO posted_events (guild_id, discord_user_id, event_key, own_date, posted_at)
 VALUES (?, ?, ?, ?, ?)`
 )
 .run(guildId, discordUserId, eventKey, ownDate ?? null, now);
 return info.changes > 0;
}

export function prunePostedEvents() {
 const cutoff = new Date();
 cutoff.setUTCDate(cutoff.getUTCDate() - POSTED_EVENT_RETENTION_DAYS);
 return getDb()
 .prepare('DELETE FROM posted_events WHERE posted_at < ?')
 .run(cutoff.toISOString());
}
