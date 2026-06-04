import { MessageFlags } from 'discord.js';
import { deleteMember, getMember } from '../db.js';

export async function handleUnlink(interaction) {
  const member = interaction.options.getUser('member', true);
  const existing = getMember(interaction.guildId, member.id);

  if (!existing) {
    await interaction.reply({
      content: `**${member.displayName ?? member.username}** is not linked.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  deleteMember(interaction.guildId, member.id);
  await interaction.reply({
    content: `Unlinked **${member.displayName ?? member.username}** (was HTB **${existing.htb_username}**).`,
  });
}
