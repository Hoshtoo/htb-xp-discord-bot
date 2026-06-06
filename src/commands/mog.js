import { getMember } from '../db.js';
import { ensureGuild } from '../discord/ensure-guild.js';
import { fetchMogProfile } from '../htb/mog-profile.js';
import {
  assertMogEligible,
  buildMogEmbed,
  getAllTimeRankMapByDiscordId,
} from '../mog/build-mog-comparison.js';

async function replyMog(interaction, content, options = {}) {
  await interaction.editReply({ content, ...options });
}

export async function handleMog(interaction, token) {
  const guildId = interaction.guildId;
  const challengerId = interaction.user.id;
  const targetUser = interaction.options.getUser('member', true);
  const targetId = targetUser.id;

  if (!guildId) {
    await replyMog(interaction, 'This command must be used in a server.');
    return;
  }

  if (targetUser.bot) {
    await replyMog(interaction, 'You cannot mog a Discord bot — choose a linked member with an HTB account.');
    return;
  }

  const challengerMember = getMember(guildId, challengerId);
  const targetMember = getMember(guildId, targetId);

  if (!challengerMember?.htb_user_id || !challengerMember.experience_url) {
    await replyMog(interaction, 'You are not linked in this server. Use `/link` first.');
    return;
  }

  if (!targetMember?.htb_user_id || !targetMember.experience_url) {
    await replyMog(
      interaction,
      `**${targetUser.displayName ?? targetUser.username}** is not linked in this server. Use \`/link\` for them first.`
    );
    return;
  }

  const guild = await ensureGuild(interaction.client, guildId);
  const rankMap = await getAllTimeRankMapByDiscordId(guildId, interaction.client, guild);

  let ranks;
  try {
    ranks = assertMogEligible(challengerId, targetId, rankMap);
  } catch (err) {
    await replyMog(interaction, err.message);
    return;
  }

  let challengerStats;
  let targetStats;
  try {
    [challengerStats, targetStats] = await Promise.all([
      fetchMogProfile({
        htbUserId: challengerMember.htb_user_id,
        experienceUrl: challengerMember.experience_url,
        token,
      }),
      fetchMogProfile({
        htbUserId: targetMember.htb_user_id,
        experienceUrl: targetMember.experience_url,
        token,
      }),
    ]);
  } catch (err) {
    await replyMog(interaction, err.message || 'Failed to fetch HTB profile stats for mog comparison.');
    return;
  }

  const result = buildMogEmbed({
    challenger: ranks.challenger,
    target: ranks.target,
    challengerStats,
    targetStats,
  });

  if (result.error) {
    await replyMog(interaction, result.error);
    return;
  }

  await interaction.editReply({
    content: result.succeeded ? `<@${targetId}>` : undefined,
    embeds: result.embeds,
    allowedMentions: result.succeeded ? { users: [targetId] } : { parse: [] },
  });
}
