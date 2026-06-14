import { SlashCommandBuilder, ChannelType } from 'discord.js';

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
 .setDescription('Show HTB XP leaderboard for linked members in this server')
 .addStringOption((opt) =>
 opt
 .setName('period')
 .setDescription('Leaderboard time range')
 .addChoices(
 { name: 'All time', value: 'all' },
 { name: 'This week', value: 'weekly' },
 { name: 'This month', value: 'monthly' }
 )
 )
 .addIntegerOption((opt) =>
 opt
 .setName('limit')
 .setDescription('How many members to show (default 10, max 100)')
 .setMinValue(1)
 .setMaxValue(100)
 )
 .addStringOption((opt) =>
 opt
 .setName('show')
 .setDescription('Show every linked member with rank')
 .addChoices({ name: 'Everyone linked', value: 'all' })
 ),
 new SlashCommandBuilder()
 .setName('mog')
 .setDescription('Head-to-head HTB stat flex vs another linked member (mog anyone above; up to 5 ranks below)')
 .addUserOption((opt) =>
 opt.setName('member').setDescription('Member to mog').setRequired(true)
 ),
 new SlashCommandBuilder()
 .setName('notify')
 .setDescription('Configure HTB own/completion notifications for this server')
 .addSubcommand((sub) =>
 sub
 .setName('channel')
 .setDescription('Set the channel for HTB own notifications (and enable them)')
 .addChannelOption((opt) =>
 opt
 .setName('channel')
 .setDescription('Text channel to post notifications in')
 .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
 .setRequired(true)
 )
 )
 .addSubcommand((sub) =>
 sub.setName('enable').setDescription('Enable HTB own notifications')
 )
 .addSubcommand((sub) =>
 sub.setName('disable').setDescription('Disable HTB own notifications')
 )
 .addSubcommand((sub) =>
 sub.setName('status').setDescription('Show notification settings and your opt status')
 )
 .addSubcommand((sub) =>
 sub.setName('optout').setDescription('Stop your own HTB owns from being announced')
 )
 .addSubcommand((sub) =>
 sub.setName('optin').setDescription('Resume announcing your HTB owns')
 )
 .addSubcommand((sub) =>
 sub.setName('test').setDescription('Post a sample notification to the configured channel')
 ),
].map((c) => c.toJSON());
