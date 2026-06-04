import { SlashCommandBuilder } from 'discord.js';

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link a Discord member to their Hack The Box username')
    .addUserOption((opt) =>
      opt.setName('member').setDescription('Discord member').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('htb_username')
        .setDescription('Hack The Box username')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Remove a member HTB link')
    .addUserOption((opt) =>
      opt.setName('member').setDescription('Discord member').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('sync')
    .setDescription('Re-sync HTB profile data for linked members')
    .addUserOption((opt) =>
      opt.setName('member').setDescription('Discord member (omit to sync all)')
    ),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show HTB XP leaderboard for linked members in this server'),
].map((c) => c.toJSON());
