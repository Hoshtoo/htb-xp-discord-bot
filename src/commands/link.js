import { linkMember } from '../htb/sync-member.js';
import { HtbResolveError } from '../htb/resolve.js';

export async function handleLink(interaction, token) {
  const member = interaction.options.getUser('member', true);
  const htbUsername = interaction.options.getString('htb_username', true);

  await interaction.deferReply();

  try {
    const result = await linkMember({
      guildId: interaction.guildId,
      discordUser: member,
      htbUsername,
      token,
    });

    const xpLine =
      result.totalExperiencePoints != null
        ? `\n**XP:** ${result.totalExperiencePoints.toLocaleString()}`
        : '';

    await interaction.editReply({
      content: `Linked **${member.displayName ?? member.username}** → HTB **${result.htbUsername}** (ID ${result.htbUserId}).${xpLine}`,
    });
  } catch (err) {
    const message =
      err instanceof HtbResolveError
        ? err.message
        : err.message || 'Failed to link member.';
    await interaction.editReply({ content: message });
  }
}
