import {
 upsertMember,
 setNotifyChannel,
 insertXpSnapshot,
 upsertActivityCursor,
 markEventPosted,
 getGuildSettings,
 listNotifiableMembers,
 listGuildMembers,
 setMemberNotifyOptOut,
} from '../db.js';
import { getPeriodBounds } from '../htb/periods.js';
import {
 SHOWCASE_GUILD_ID,
 SHOWCASE_CHANNEL_ID,
 SAMPLE_MEMBERS,
 SAMPLE_PERIOD_GAINS,
 SAMPLE_NOTIFICATION_EVENTS,
 SAMPLE_NOTIFICATION_OWNERS,
} from './fixtures.js';

/**
 * Insert sample members, XP history, notification settings, and dedupe state.
 * @param {{ now?: Date }} [options]
 */
export function seedShowcaseDatabase(options = {}) {
 const now = options.now ?? new Date();
 const nowIso = now.toISOString();
 const guildId = SHOWCASE_GUILD_ID;
 const weekBounds = getPeriodBounds('weekly', now);
 const monthBounds = getPeriodBounds('monthly', now);

 for (const member of SAMPLE_MEMBERS) {
  const gains = SAMPLE_PERIOD_GAINS[member.discord_user_id] ?? { weekly: 0, monthly: 0 };
  const weekBaseline = member.last_xp - gains.weekly;
  const monthBaseline = member.last_xp - gains.monthly;

  upsertMember({
   guild_id: guildId,
   discord_user_id: member.discord_user_id,
   discord_tag: member.discord_tag,
   server_nick: member.server_nick,
   htb_username: member.htb_username,
   htb_user_id: member.htb_user_id,
   htb_account_id: `acct-${member.htb_user_id}`,
   experience_url: `https://labs.hackthebox.com/api/v4/user/profile/experience/${member.htb_user_id}`,
   last_xp: member.last_xp,
   last_synced_at: nowIso,
  });

  if (member.notify_opt_out) {
   setMemberNotifyOptOut(guildId, member.discord_user_id, true);
  }

  // Period baselines so weekly/monthly leaderboards have realistic deltas.
  insertXpSnapshot(guildId, member.discord_user_id, weekBaseline, weekBounds.start.toISOString());
  insertXpSnapshot(guildId, member.discord_user_id, monthBaseline, monthBounds.start.toISOString());
  insertXpSnapshot(guildId, member.discord_user_id, member.last_xp, nowIso);

  // Older history for all-time context.
  const older = new Date(now);
  older.setUTCDate(older.getUTCDate() - 45);
  insertXpSnapshot(
   guildId,
   member.discord_user_id,
   Math.max(0, member.last_xp - gains.monthly - 5_000),
   older.toISOString()
  );
 }

 setNotifyChannel(guildId, SHOWCASE_CHANNEL_ID);

 // Mark every member as seeded; record demo events in the dedupe ledger.
 for (const member of SAMPLE_MEMBERS) {
  upsertActivityCursor(guildId, member.discord_user_id, {
   lastOwnDate: nowIso,
   seeded: true,
  });
 }

 for (const { memberIndex, eventIndex } of SAMPLE_NOTIFICATION_OWNERS) {
  const member = SAMPLE_MEMBERS[memberIndex];
  const event = SAMPLE_NOTIFICATION_EVENTS[eventIndex];
  markEventPosted(guildId, member.discord_user_id, event.eventKey, event.ownDate);
 }

 return {
  guildId,
  channelId: SHOWCASE_CHANNEL_ID,
  memberCount: SAMPLE_MEMBERS.length,
  notifiableCount: listNotifiableMembers(guildId).length,
  settings: getGuildSettings(guildId),
  members: listGuildMembers(guildId),
 };
}
