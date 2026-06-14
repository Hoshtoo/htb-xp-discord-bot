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

const ADMIN_SUBCOMMANDS = new Set(['channel', 'enable', 'disable', 'test']);

function ephemeral(interaction, content) {
 return interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

function hasManageGuild(interaction) {
 return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

export async function handleNotify(interaction) {
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
 return handleTest(interaction, guildId);
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

async function handleTest(interaction, guildId) {
 const settings = getGuildSettings(guildId);
 if (!settings?.notify_channel_id) {
 await ephemeral(interaction, 'Set a channel first with `/notify channel #channel`.');
 return;
 }

 let channel;
 try {
 channel = await interaction.client.channels.fetch(settings.notify_channel_id);
 } catch {
 channel = null;
 }
 if (!channel || typeof channel.send !== 'function') {
 await ephemeral(interaction, 'The configured channel is missing or not sendable.');
 return;
 }

 const displayName =
 interaction.member?.displayName ?? interaction.user.username;

 const sampleEvent = {
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

 const embed = buildOwnEmbed({
 event: sampleEvent,
 displayName,
 htbUsername: 'sample-user',
 thumbnailUrl: 'https://labs.hackthebox.com/images/favicon.png',
 memberAvatarUrl: interaction.user.displayAvatarURL({ size: 128 }),
 });

 await channel.send({
 content: '*(test notification)*',
 embeds: [embed],
 });
 await ephemeral(interaction, `Sent a test notification to <#${settings.notify_channel_id}>.`);
}
