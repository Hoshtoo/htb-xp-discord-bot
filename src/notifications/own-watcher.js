import {
 listNotifyEnabledGuilds,
 listNotifiableMembers,
 getActivityCursor,
 upsertActivityCursor,
 markEventPosted,
 prunePostedEvents,
} from '../db.js';
import { fetchUserActivity } from '../htb/activity.js';
import { resolveThumbnail } from '../htb/thumbnails.js';
import { buildOwnEmbed } from '../discord/own-embed.js';
import { buildEmbedImage } from '../discord/embed-image.js';
import { ensureGuild } from '../discord/ensure-guild.js';

const POLL_INTERVAL_MS = Number(process.env.NOTIFY_POLL_INTERVAL_MS) || 90_000;
const MEMBER_CONCURRENCY = 4;
// Safety cap so a member who owned a huge batch can't flood the channel.
const MAX_POST_PER_MEMBER = 8;

let intervalId = null;
let running = false;

/** Run async tasks with a small concurrency limit. */
async function runPool(items, limit, worker) {
 let index = 0;
 async function next() {
 while (index < items.length) {
 const i = index++;
 await worker(items[i]);
 }
 }
 await Promise.all(
 Array.from({ length: Math.min(limit, items.length) }, () => next())
 );
}

function memberDisplayName(member) {
 return member.server_nick || member.discord_tag || member.htb_username;
}

async function resolveMemberAvatar(guild, discordUserId) {
 if (!guild) return null;
 try {
 const gm =
 guild.members.cache.get(discordUserId) ??
 (await guild.members.fetch(discordUserId).catch(() => null));
 return gm ? gm.displayAvatarURL({ size: 128 }) : null;
 } catch {
 return null;
 }
}

/**
 * Seed a member on first sight: claim all current events as "posted" so we
 * never announce historical owns.
 * @param {string} guildId
 * @param {object} member
 * @param {import('../htb/activity.js').ActivityEvent[]} events
 */
function seedMember(guildId, member, events) {
 for (const event of events) {
 markEventPosted(guildId, member.discord_user_id, event.eventKey, event.ownDate);
 }
 const latest = events[0]?.ownDate ?? null;
 upsertActivityCursor(guildId, member.discord_user_id, {
 lastOwnDate: latest,
 seeded: true,
 });
}

/**
 * @param {import('discord.js').TextBasedChannel} channel
 * @param {object} guild
 * @param {object} member
 * @param {string} token
 */
async function processMember(channel, guild, member, token) {
 let events;
 try {
 events = await fetchUserActivity(member.htb_user_id, token);
 } catch (err) {
 console.warn(
 `[notify] activity fetch failed for ${member.htb_username} (guild ${member.guild_id}): ${err.message}`
 );
 return;
 }

 if (events.length === 0) return;

 const cursor = getActivityCursor(member.guild_id, member.discord_user_id);
 if (!cursor || !cursor.seeded) {
 seedMember(member.guild_id, member, events);
 return;
 }

 // Atomically claim every not-yet-seen event so overlapping polls / restarts
 // can never double-post. Claimed events that we drop (flood cap) simply won't
 // be re-announced.
 const claimed = events.filter((event) =>
 markEventPosted(member.guild_id, member.discord_user_id, event.eventKey, event.ownDate)
 );

 if (claimed.length === 0) return;

 // Newest-first from the API; keep only the most recent N, then post oldest→newest.
 const toPost = claimed.slice(0, MAX_POST_PER_MEMBER).reverse();

 const displayName = memberDisplayName(member);
 const memberAvatarUrl = await resolveMemberAvatar(guild, member.discord_user_id);

 for (const event of toPost) {
 try {
 const rawThumb = await resolveThumbnail(event, token);
 const { url: thumbnailUrl, files } = await buildEmbedImage(rawThumb);
 const embed = buildOwnEmbed({
 event,
 displayName,
 htbUsername: member.htb_username,
 thumbnailUrl,
 memberAvatarUrl,
 });
 await channel.send({ embeds: [embed], files });
 } catch (err) {
 console.warn(
 `[notify] failed to post ${event.type} own for ${member.htb_username}: ${err.message}`
 );
 }
 }

 const latest = claimed[0]?.ownDate ?? cursor.last_own_date ?? null;
 upsertActivityCursor(member.guild_id, member.discord_user_id, {
 lastOwnDate: latest,
 seeded: true,
 });
}

async function processGuild(client, settings, token) {
 const channelId = settings.notify_channel_id;
 let channel;
 try {
 channel = await client.channels.fetch(channelId);
 } catch {
 channel = null;
 }
 if (!channel || typeof channel.send !== 'function') {
 console.warn(
 `[notify] channel ${channelId} for guild ${settings.guild_id} is missing or not sendable; skipping`
 );
 return;
 }

 const guild = await ensureGuild(client, settings.guild_id);
 const members = listNotifiableMembers(settings.guild_id);
 if (members.length === 0) return;

 await runPool(members, MEMBER_CONCURRENCY, (member) =>
 processMember(channel, guild, member, token)
 );
}

async function poll(client, token) {
 if (running) return;
 running = true;
 try {
 const guilds = listNotifyEnabledGuilds();
 for (const settings of guilds) {
 await processGuild(client, settings, token).catch((err) =>
 console.error(`[notify] guild ${settings.guild_id} poll failed:`, err.message)
 );
 }
 prunePostedEvents();
 } finally {
 running = false;
 }
}

/**
 * Start the own-notification watcher. Polls every NOTIFY_POLL_INTERVAL_MS
 * (default 90s) across all guilds that have enabled notifications.
 *
 * @param {import('discord.js').Client} client
 * @param {string} token HTB app token
 */
export function startOwnWatcher(client, token) {
 if (intervalId != null) return;
 if (!token) {
 console.warn('[notify] HTB_TOKEN not set — own notifications disabled.');
 return;
 }

 console.log(
 `[notify] Own-notification watcher enabled (polling every ${Math.round(
 POLL_INTERVAL_MS / 1000
 )}s)`
 );

 poll(client, token).catch((err) =>
 console.error('[notify] initial poll failed:', err.message)
 );

 intervalId = setInterval(() => {
 poll(client, token).catch((err) =>
 console.error('[notify] poll failed:', err.message)
 );
 }, POLL_INTERVAL_MS);

 if (typeof intervalId.unref === 'function') intervalId.unref();
}
