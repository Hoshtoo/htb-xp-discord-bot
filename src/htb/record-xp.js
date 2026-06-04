import { getLatestSnapshot, insertXpSnapshot } from '../db.js';

const DEDUPE_MS = 60 * 60 * 1000;

/**
 * Record an XP snapshot for period leaderboard history.
 * @param {string} guildId
 * @param {string} discordUserId
 * @param {number} totalXp
 * @param {Date} [capturedAt]
 */
export function recordMemberXp(guildId, discordUserId, totalXp, capturedAt = new Date()) {
  if (totalXp == null || Number.isNaN(totalXp)) return;

  const capturedIso = capturedAt.toISOString();
  const latest = getLatestSnapshot(guildId, discordUserId);

  if (latest) {
    const ageMs = capturedAt.getTime() - new Date(latest.captured_at).getTime();
    if (latest.total_xp === totalXp && ageMs < DEDUPE_MS) {
      return;
    }
  }

  insertXpSnapshot(guildId, discordUserId, totalXp, capturedIso);
}
