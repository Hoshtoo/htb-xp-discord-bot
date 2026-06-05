import { linkMember } from '../htb/sync-member.js';
import { getServerDisplayName } from '../discord/server-display-name.js';
import { resolveLinkDisplayName } from '../discord/resolve-link-name.js';
import { HtbResolveError } from '../htb/resolve.js';

export async function handleLink(interaction, token) {
  const guildMember = interaction.options.getMember('member');
  const member = guildMember?.user ?? interaction.options.getUser('member', true);
  const htbUsername = interaction.options.getString('htb_username', true);

  const resolved = interaction.options.resolved;

  let nameInfo = getServerDisplayName({
    guildMember,
    discordUser: member,
    resolved,
  });

  nameInfo = await resolveLinkDisplayName(
    interaction.client,
    interaction.guildId,
    member,
    guildMember,
    nameInfo
  );

  try {
    const result = await linkMember({
      guildId: interaction.guildId,
      client: interaction.client,
      discordUser: member,
      guildMember,
      serverDisplayName: nameInfo.label,
      serverNick: nameInfo.nick,
      htbUsername,
      token,
    });

    const xpLine =
      result.totalExperiencePoints != null
        ? `\n**XP:** ${result.totalExperiencePoints.toLocaleString()}`
        : '';

    await interaction.editReply({
      content: `Linked **${nameInfo.label}** → HTB **${result.htbUsername}** (ID ${result.htbUserId}).${xpLine}`,
    });
  } catch (err) {
    const message =
      err instanceof HtbResolveError
        ? err.message
        : err.message || 'Failed to link member.';
    await interaction.editReply({ content: message });
  }
}
