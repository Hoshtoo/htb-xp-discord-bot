import { MessageFlags, PermissionFlagsBits, ChannelType } from 'discord.js';
import {
 getGuildSettings,
 setNotifyChannel,
 setNotifyEnabled,
 getMember,
 setMemberNotifyOptOut,
 listNotifiableMembers,
} from '../db.js';
import { buildOwnEmbed } from '../discord/own-embed.js';
import { fetchUserActivity } from '../htb/activity.js';
import { resolveThumbnail } from '../htb/thumbnails.js';

const ADMIN_SUBCOMMANDS = new Set(['channel', 'enable', 'disable', 'test']);

function ephemeral(interaction, content) {
 return interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

function hasManageGuild(interaction) {
 return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

export async function handleNotify(interaction, token) {
 const sub = interaction.options.getSubcommand();
 const guildId = interaction.guildId;

 if (ADMIN_SUBCOMMANDS.has(sub) && !hasManageGuild(interaction)) {
 await ephemeral(interaction, 'You need the **Manage Server** permission to use this.');
 return;
 }

 switch (sub) {
 case 'channel':
 return handleSetChannel(interaction, guildId);
 case 'enable':
 return handleEnable(interaction, guildId);
 case 'disable':
 return handleDisable(interaction, guildId);
 case 'status':
 return handleStatus(interaction, guildId);
 case 'optout':
 return handleOptOut(interaction, guildId, true);
 case 'optin':
 return handleOptOut(interaction, guildId, false);
 case 'test':
 return handleTest(interaction, guildId, token);
 default:
 return ephemeral(interaction, 'Unknown notify subcommand.');
 }
}

async function handleSetChannel(interaction, guildId) {
 const channel = interaction.options.getChannel('channel', true);
 const isText =
 channel.type === ChannelType.GuildText ||
 channel.type === ChannelType.GuildAnnouncement ||
 (typeof channel.isTextBased === 'function' && channel.isTextBased());

 if (!isText) {
 await ephemeral(interaction, 'Please choose a text channel.');
 return;
 }

 setNotifyChannel(guildId, channel.id);
 await interaction.reply({
 content: `HTB own notifications will be posted to <#${channel.id}> and are now **enabled**. All linked members are included by default — they can run \`/notify optout\` to stop their own.`,
 });
}

async function handleEnable(interaction, guildId) {
 const settings = getGuildSettings(guildId);
 if (!settings?.notify_channel_id) {
 await ephemeral(
 interaction,
 'No notification channel set yet. Use `/notify channel #channel` first.'
 );
 return;
 }
 setNotifyEnabled(guildId, true);
 await interaction.reply({
 content: `HTB own notifications **enabled** (posting to <#${settings.notify_channel_id}>).`,
 });
}

async function handleDisable(interaction, guildId) {
 setNotifyEnabled(guildId, false);
 await interaction.reply({ content: 'HTB own notifications **disabled** for this server.' });
}

async function handleStatus(interaction, guildId) {
 const settings = getGuildSettings(guildId);
 const member = getMember(guildId, interaction.user.id);
 const notifiable = listNotifiableMembers(guildId).length;

 const lines = [
 `**Notifications:** ${settings?.notify_enabled ? 'enabled' : 'disabled'}`,
 `**Channel:** ${settings?.notify_channel_id ? `<#${settings.notify_channel_id}>` : '*not set*'}`,
 `**Members being watched:** ${notifiable}`,
 ];

 if (member) {
 lines.push(
 `**Your status:** ${member.notify_opt_out ? 'opted out' : 'included'} ` +
 `(use \`/notify ${member.notify_opt_out ? 'optin' : 'optout'}\` to change)`
 );
 } else {
 lines.push('**Your status:** not linked — use `/link` to be included.');
 }

 await ephemeral(interaction, lines.join('\n'));
}

async function handleOptOut(interaction, guildId, optOut) {
 const member = getMember(guildId, interaction.user.id);
 if (!member) {
 await ephemeral(
 interaction,
 'You are not linked in this server, so there is nothing to change. Use `/link` first.'
 );
 return;
 }

 setMemberNotifyOptOut(guildId, interaction.user.id, optOut);
 await ephemeral(
 interaction,
 optOut
 ? 'Done — your HTB owns will **no longer** be announced in this server.'
 : 'Done — your HTB owns **will** be announced in this server.'
 );
}

const TEST_TYPE_MATCH = {
 machine: ['root', 'user'],
 challenge: ['challenge'],
 sherlock: ['sherlock'],
 prolab: ['prolab'],
 fortress: ['fortress'],
};

/** Scan back through the activity feed to find the most recent event of a type. */
async function findRecentEventOfType(htbUserId, token, matchTypes, maxPages = 6) {
 for (let page = 1; page <= maxPages; page++) {
 const events = await fetchUserActivity(htbUserId, token, { page, perPage: 100 });
 if (events.length === 0) break;
 const match = events.find((e) => matchTypes.includes(e.type));
 if (match) return match;
 }
 return null;
}

async function handleTest(interaction, guildId, token) {
 // Scanning several pages can take a moment — defer so we don't hit the 3s cap.
 await interaction.deferReply({ flags: MessageFlags.Ephemeral });
 const reply = (content) => interaction.editReply({ content });

 const settings = getGuildSettings(guildId);
 if (!settings?.notify_channel_id) {
 await reply('Set a channel first with `/notify channel #channel`.');
 return;
 }

 let channel;
 try {
 channel = await interaction.client.channels.fetch(settings.notify_channel_id);
 } catch {
 channel = null;
 }
 if (!channel || typeof channel.send !== 'function') {
 await reply('The configured channel is missing or not sendable.');
 return;
 }

 const displayName = interaction.member?.displayName ?? interaction.user.username;
 const memberAvatarUrl = interaction.user.displayAvatarURL({ size: 128 });
 const member = getMember(guildId, interaction.user.id);
 const htbUsername = member?.htb_username ?? 'sample-user';
 const wantType = interaction.options.getString('type');

 let event = null;
 let thumbnailUrl = memberAvatarUrl;

 if (member?.htb_user_id && token) {
 try {
 if (wantType) {
 const matchTypes = TEST_TYPE_MATCH[wantType] ?? [wantType];
 event = await findRecentEventOfType(member.htb_user_id, token, matchTypes);
 if (!event) {
 await reply(`No recent **${wantType}** solve found in your HTB activity to preview.`);
 return;
 }
 } else {
 const events = await fetchUserActivity(member.htb_user_id, token);
 event = events[0] ?? null;
 }
 if (event) thumbnailUrl = await resolveThumbnail(event, token);
 } catch (err) {
 await reply(`Could not read your HTB activity: ${err.message}`);
 return;
 }
 } else if (wantType) {
 await reply('You must be linked (`/link`) and `HTB_TOKEN` must be set to preview a real solve.');
 return;
 }

 if (!event) {
 event = {
 type: 'root',
 id: 1,
 name: 'Imagery',
 points: 30,
 ownDate: new Date().toISOString(),
 blood: false,
 avatar: null,
 categoryName: null,
 parentName: null,
 parentId: null,
 parentIdentifier: null,
 eventKey: 'test',
 };
 }

 const embed = buildOwnEmbed({
 event,
 displayName,
 htbUsername,
 thumbnailUrl,
 memberAvatarUrl,
 });

 await channel.send({
 content: '*(test notification)*',
 embeds: [embed],
 });
 await reply(`Sent a test notification to <#${settings.notify_channel_id}>.`);
}
