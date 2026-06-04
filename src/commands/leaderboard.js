import { EmbedBuilder } from 'discord.js';
import {
  buildGuildRanking,
  formatLeaderboardLines,
} from '../leaderboard/build-ranking.js';
import { getPeriodBounds, getPeriodTitle } from '../htb/periods.js';

export async function handleLeaderboard(interaction) {
  const period = interaction.options.getString('period') ?? 'all';
  await interaction.deferReply();

  const ranking = await buildGuildRanking(interaction.guildId, period);

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
