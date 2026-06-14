import { EmbedBuilder } from 'discord.js';

const HTB_GREEN = 0x9fef00;
const BLOOD_RED = 0xe23c3c;
const APP_BASE = 'https://app.hackthebox.com';

const TYPE_META = {
 root: { emoji: '\u{1F451}', label: 'Machine', noun: 'root' }, // 👑
 user: { emoji: '\u{1F464}', label: 'Machine', noun: 'user' }, // 👤
 challenge: { emoji: '\u{1F9E9}', label: 'Challenge', noun: 'challenge' }, // 🧩
 sherlock: { emoji: '\u{1F50E}', label: 'Sherlock', noun: 'sherlock' }, // 🔎
 prolab: { emoji: '\u{1F3F0}', label: 'Pro Lab', noun: 'flag' }, // 🏰
 fortress: { emoji: '\u{1F6E1}', label: 'Fortress', noun: 'flag' }, // 🛡
};

/**
 * Link to the relevant HTB object page.
 * @param {import('../htb/activity.js').ActivityEvent} event
 */
function buildUrl(event) {
 switch (event.type) {
 case 'root':
 case 'user':
 return `${APP_BASE}/machines/${event.id}`;
 case 'challenge':
 return `${APP_BASE}/challenges/${event.id}`;
 case 'sherlock':
 return `${APP_BASE}/sherlocks/${event.id}`;
 case 'prolab':
 return event.parentId ? `${APP_BASE}/prolabs/${event.parentId}` : null;
 case 'fortress':
 return event.parentId ? `${APP_BASE}/fortresses/${event.parentId}` : null;
 default:
 return null;
 }
}

/**
 * Human title line, e.g. "ejee got root on Imagery".
 * @param {import('../htb/activity.js').ActivityEvent} event
 * @param {string} displayName
 */
function buildTitle(event, displayName) {
 const who = displayName;
 switch (event.type) {
 case 'root':
 return `${who} got root on ${event.name}`;
 case 'user':
 return `${who} got user on ${event.name}`;
 case 'challenge':
 return `${who} solved the challenge ${event.name}`;
 case 'sherlock':
 return `${who} solved the Sherlock ${event.name}`;
 case 'prolab':
 return `${who} owned a flag in ${event.parentName ?? 'a Pro Lab'}`;
 case 'fortress':
 return `${who} owned a flag in ${event.parentName ?? 'a Fortress'}`;
 default:
 return `${who} completed ${event.name}`;
 }
}

/**
 * Build the Discord embed for a single own/activity event.
 *
 * @param {Object} args
 * @param {import('../htb/activity.js').ActivityEvent} args.event
 * @param {string} args.displayName   Discord display name (e.g. "ejee")
 * @param {string} args.htbUsername   HTB username
 * @param {string|null} [args.thumbnailUrl]    Resolved box/lab image URL
 * @param {string|null} [args.memberAvatarUrl] Discord member avatar for the embed author
 * @returns {EmbedBuilder}
 */
export function buildOwnEmbed({
 event,
 displayName,
 htbUsername,
 thumbnailUrl = null,
 memberAvatarUrl = null,
}) {
 const meta = TYPE_META[event.type] ?? {
 emoji: '\u2705',
 label: 'HTB',
 noun: 'item',
 };
 const url = buildUrl(event);
 const isBlood = event.blood && (event.type === 'root' || event.type === 'user' || event.type === 'challenge');

 const embed = new EmbedBuilder()
 .setColor(isBlood ? BLOOD_RED : HTB_GREEN)
 .setAuthor({
 name: `${htbUsername} on Hack The Box`,
 iconURL: memberAvatarUrl ?? undefined,
 })
 .setTitle(`${meta.emoji} ${buildTitle(event, displayName)}`)
 .setTimestamp(event.ownDate ? new Date(event.ownDate) : new Date());

 if (url) embed.setURL(url);

 const fields = [{ name: 'Type', value: meta.label, inline: true }];

 if (event.points) {
 fields.push({ name: 'Points', value: `+${event.points}`, inline: true });
 }

 if (event.type === 'challenge' && event.categoryName) {
 fields.push({ name: 'Category', value: event.categoryName, inline: true });
 }

 if ((event.type === 'prolab' || event.type === 'fortress') && event.name) {
 fields.push({ name: 'Flag', value: event.name, inline: true });
 }

 if (event.type === 'prolab' && event.parentIdentifier) {
 fields.push({ name: 'Pro Lab', value: event.parentIdentifier, inline: true });
 }

 if (isBlood) {
 fields.push({ name: '\u{1FA78} First Blood', value: 'Yes', inline: true });
 }

 embed.addFields(fields);

 // Wide cover art for labs/fortresses reads better as the big image;
 // square box/challenge/sherlock avatars look best as a thumbnail.
 if (thumbnailUrl) {
 if (event.type === 'prolab' || event.type === 'fortress') {
 embed.setImage(thumbnailUrl);
 } else {
 embed.setThumbnail(thumbnailUrl);
 }
 }

 return embed;
}
