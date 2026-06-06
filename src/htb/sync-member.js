import {
  findReusableExperienceLink,
  upsertMember,
  updateMemberXp,
} from '../db.js';
import { captureForMember } from './capture.js';
import { fetchExperiencePublic } from './experience.js';
import { recordMemberXp } from './record-xp.js';
import { HtbResolveError, resolveHtbUser, buildExperienceUrl } from './resolve.js';

/**
 * Resolve a working Experience v1 URL + XP for /link.
 * Prefers a verified URL from another guild (same Discord + HTB user), then Playwright capture.
 */
async function resolveExperienceForLink({
  guildId,
  discordUserId,
  htbUserId,
  accountId,
  token,
}) {
  const reusable = findReusableExperienceLink(discordUserId, htbUserId);
  if (reusable?.experience_url) {
    try {
      const xp = await fetchExperiencePublic(reusable.experience_url);
      return {
        experienceUrl: reusable.experience_url,
        accountId: reusable.htb_account_id,
        totalExperiencePoints: xp.totalExperiencePoints,
        reusedFromOtherGuild: true,
      };
    } catch {
      /* fall through to browser capture */
    }
  }

  const parsed = await captureForMember(guildId, discordUserId, htbUserId, {
    token,
    accountIdFallback: accountId,
  });

  const candidates = [];
  if (parsed?.experienceUrl) {
    candidates.push({
      experienceUrl: parsed.experienceUrl,
      accountId: parsed.accountId ?? accountId,
      totalExperiencePoints: parsed.totalExperiencePoints,
    });
  }
  if (accountId) {
    candidates.push({
      experienceUrl: buildExperienceUrl(accountId),
      accountId,
      totalExperiencePoints: null,
    });
  }

  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate.experienceUrl || seen.has(candidate.experienceUrl)) continue;
    seen.add(candidate.experienceUrl);

    try {
      const xp = await fetchExperiencePublic(candidate.experienceUrl);
      return {
        experienceUrl: candidate.experienceUrl,
        accountId: candidate.accountId,
        totalExperiencePoints:
          candidate.totalExperiencePoints ?? xp.totalExperiencePoints,
        reusedFromOtherGuild: false,
      };
    } catch {
      /* try next candidate */
    }
  }

  throw new Error(
    'Could not verify HTB Experience API for this account. Open your HTB profile in a browser to confirm XP is visible, then try `/link` again.'
  );
}

/**
 * Resolve HTB user, capture profile APIs, and upsert guild member row.
 * Playwright capture runs only here (via /link).
 */
export async function linkMember({
  guildId,
  client,
  discordUser,
  guildMember,
  serverDisplayName,
  serverNick,
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

  const experience = await resolveExperienceForLink({
    guildId,
    discordUserId: discordUser.id,
    htbUserId: resolved.id,
    accountId: resolved.accountId,
    token,
  });

  const now = new Date().toISOString();
  const discordTag = serverDisplayName ?? discordUser.displayName ?? discordUser.username;

  upsertMember({
    guild_id: guildId,
    discord_user_id: discordUser.id,
    discord_tag: discordTag,
    server_nick: serverNick ?? serverDisplayName,
    htb_username: resolved.name,
    htb_user_id: resolved.id,
    htb_account_id: experience.accountId ?? resolved.accountId,
    experience_url: experience.experienceUrl,
    last_xp: experience.totalExperiencePoints,
    last_synced_at: now,
  });

  if (experience.totalExperiencePoints != null) {
    recordMemberXp(
      guildId,
      discordUser.id,
      experience.totalExperiencePoints,
      new Date(now)
    );
  }

  return {
    htbUsername: resolved.name,
    htbUserId: resolved.id,
    experienceUrl: experience.experienceUrl,
    totalExperiencePoints: experience.totalExperiencePoints,
    reusedFromOtherGuild: experience.reusedFromOtherGuild,
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

  if (xp.totalExperiencePoints != null) {
    recordMemberXp(
      memberRow.guild_id,
      memberRow.discord_user_id,
      xp.totalExperiencePoints,
      new Date(now)
    );
  }

  return {
    htbUsername: memberRow.htb_username,
    totalExperiencePoints: xp.totalExperiencePoints,
    level: xp.level,
    levelTitle: xp.levelTitle,
  };
}
