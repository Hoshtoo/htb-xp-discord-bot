import { EmbedBuilder } from 'discord.js';
import {
  buildGuildRanking,
  formatLeaderboardLines,
} from '../leaderboard/build-ranking.js';
import { ensureGuild } from '../discord/ensure-guild.js';
import { getPeriodBounds, getPeriodTitle } from '../htb/periods.js';

export async function handleLeaderboard(interaction) {
  const period = interaction.options.getString('period') ?? 'all';
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.editReply({
      content: 'This command must be used in a server.',
    });
    return;
  }

  const guild = await ensureGuild(interaction.client, guildId);

  const ranking = await buildGuildRanking(
    guildId,
    interaction.client,
    period,
    guild
  );

  if (ranking.empty) {
    await interaction.editReply({
      content: 'No linked members yet. Use `/link` to add HTB accounts.',
    });
    return;
  }

  const lines = formatLeaderboardLines(ranking.page, ranking.xpSuffix);
  const bounds = ranking.bounds ?? getPeriodBounds(period);

  const footerParts = [`Top ${ranking.page.length} of ${ranking.total} linked`];
  if (period !== 'all' && bounds.label) {
    footerParts.push(bounds.label);
  }
  footerParts.push(new Date().toLocaleString());

  const embed = new EmbedBuilder()
    .setTitle(getPeriodTitle(period))
    .setDescription(lines.join('\n') || 'No data.')
    .setFooter({ text: footerParts.join(' · ') })
    .setColor(0x9fef00);

  await interaction.editReply({ embeds: [embed] });
}
