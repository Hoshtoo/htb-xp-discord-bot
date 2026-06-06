import { listAllLinkedMembers, updateMemberXp } from '../db.js';
import { fetchAllExperience } from './experience.js';
import { recordMemberXp } from './record-xp.js';

/**
 * Sync XP for every linked member across all guilds (no browser).
 * @returns {Promise<{ total: number, ok: number, fail: number, errors: Array<{ guildId: string, discordUserId: string, error: string }> }>}
 */
export async function syncAllLinkedMembers() {
  const members = listAllLinkedMembers();
  if (members.length === 0) {
    return { total: 0, ok: 0, fail: 0, errors: [] };
  }

  const results = await fetchAllExperience(
    members.map((member) => ({ member, experienceUrl: member.experience_url }))
  );

  const now = new Date();
  const nowIso = now.toISOString();
  let ok = 0;
  let fail = 0;
  const errors = [];

  for (const result of results) {
    if (!result?.member) continue;

    if (!result.ok || result.totalExperiencePoints == null) {
      fail++;
      errors.push({
        guildId: result.member.guild_id,
        discordUserId: result.member.discord_user_id,
        error: result.error || 'sync failed',
      });
      continue;
    }

    updateMemberXp(
      result.member.guild_id,
      result.member.discord_user_id,
      result.totalExperiencePoints,
      nowIso
    );
    recordMemberXp(
      result.member.guild_id,
      result.member.discord_user_id,
      result.totalExperiencePoints,
      now
    );
    ok++;
  }

  return { total: members.length, ok, fail, errors };
}
