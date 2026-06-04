import { upsertMember, updateMemberXp } from '../db.js';
import { captureForMember } from './capture.js';
import { HtbResolveError, resolveHtbUser } from './resolve.js';
import { fetchExperiencePublic } from './experience.js';

/**
 * Resolve HTB user, capture profile APIs, and upsert guild member row.
 * Playwright capture runs only here (via /link).
 */
export async function linkMember({
  guildId,
  discordUser,
  htbUsername,
  token,
}) {
  const resolved = await resolveHtbUser(htbUsername, token);

  if (!resolved.accountId) {
    throw new HtbResolveError(
      'HTB profile has no account_id — the profile may be private or not visible to your token.',
      'NO_ACCOUNT_ID'
    );
  }

  const parsed = await captureForMember(guildId, discordUser.id, resolved.id, {
    token,
    accountIdFallback: resolved.accountId,
  });

  if (!parsed?.experienceUrl) {
    throw new Error('Could not determine Experience API URL from profile capture.');
  }

  const now = new Date().toISOString();
  const discordTag = discordUser.displayName ?? discordUser.username;

  upsertMember({
    guild_id: guildId,
    discord_user_id: discordUser.id,
    discord_tag: discordTag,
    htb_username: resolved.name,
    htb_user_id: resolved.id,
    htb_account_id: parsed.accountId ?? resolved.accountId,
    experience_url: parsed.experienceUrl,
    last_xp: parsed.totalExperiencePoints,
    last_synced_at: now,
  });

  return {
    htbUsername: resolved.name,
    htbUserId: resolved.id,
    experienceUrl: parsed.experienceUrl,
    totalExperiencePoints: parsed.totalExperiencePoints,
  };
}

/**
 * Refresh XP from the stored Experience v1 URL (no auth, no browser).
 */
export async function syncMemberXp(memberRow) {
  if (!memberRow.experience_url) {
    throw new Error('No Experience API URL stored — run `/link` first.');
  }

  const xp = await fetchExperiencePublic(memberRow.experience_url);
  const now = new Date().toISOString();

  updateMemberXp(
    memberRow.guild_id,
    memberRow.discord_user_id,
    xp.totalExperiencePoints,
    now
  );

  return {
    htbUsername: memberRow.htb_username,
    totalExperiencePoints: xp.totalExperiencePoints,
    level: xp.level,
    levelTitle: xp.levelTitle,
  };
}
