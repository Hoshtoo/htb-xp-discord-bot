import { buildEventKey } from '../htb/activity.js';

/** Fake guild + channel IDs for offline demos (not real Discord snowflakes). */
export const SHOWCASE_GUILD_ID = '999000001234567890';
export const SHOWCASE_CHANNEL_ID = '999000001234567891';

/** Default SQLite path for the generated sample database. */
export const DEFAULT_SHOWCASE_DB_PATH = './data/showcase.db';

/** Default HTML output for the visual showcase. */
export const DEFAULT_SHOWCASE_HTML_PATH = './showcase/output/index.html';

/**
 * Linked members seeded into the sample database.
 * @type {Array<{
 *   discord_user_id: string,
 *   discord_tag: string,
 *   server_nick: string,
 *   htb_username: string,
 *   htb_user_id: string,
 *   last_xp: number,
 *   level?: number,
 *   levelTitle?: string,
 *   notify_opt_out?: boolean,
 *   avatarSeed: string,
 * }>}
 */
export const SAMPLE_MEMBERS = [
  {
    discord_user_id: '1000000000000000001',
    discord_tag: 'alice',
    server_nick: 'Alice',
    htb_username: 'alice_htb',
    htb_user_id: '100001',
    last_xp: 48_920,
    level: 43,
    levelTitle: 'Guru',
    avatarSeed: 'alice',
  },
  {
    discord_user_id: '1000000000000000002',
    discord_tag: 'bob',
    server_nick: 'Bob',
    htb_username: 'bob_pwns',
    htb_user_id: '100002',
    last_xp: 41_150,
    level: 40,
    levelTitle: 'Guru',
    notify_opt_out: true,
    avatarSeed: 'bob',
  },
  {
    discord_user_id: '1000000000000000003',
    discord_tag: 'carol',
    server_nick: 'Carol',
    htb_username: 'carol_root',
    htb_user_id: '100003',
    last_xp: 36_800,
    level: 38,
    levelTitle: 'Master',
    avatarSeed: 'carol',
  },
  {
    discord_user_id: '1000000000000000004',
    discord_tag: 'dave',
    server_nick: 'Dave',
    htb_username: 'dave_shell',
    htb_user_id: '100004',
    last_xp: 29_440,
    level: 35,
    levelTitle: 'Master',
    avatarSeed: 'dave',
  },
  {
    discord_user_id: '1000000000000000005',
    discord_tag: 'erin',
    server_nick: 'Erin',
    htb_username: 'erin_enum',
    htb_user_id: '100005',
    last_xp: 22_100,
    level: 31,
    levelTitle: 'Expert',
    avatarSeed: 'erin',
  },
  {
    discord_user_id: '1000000000000000006',
    discord_tag: 'frank',
    server_nick: 'Frank',
    htb_username: 'frank_recon',
    htb_user_id: '100006',
    last_xp: 15_750,
    level: 27,
    levelTitle: 'Expert',
    avatarSeed: 'frank',
  },
];

/** XP earned this week/month per member (added on top of period-start baseline). */
export const SAMPLE_PERIOD_GAINS = {
  '1000000000000000001': { weekly: 1_240, monthly: 3_680 },
  '1000000000000000002': { weekly: 890, monthly: 2_100 },
  '1000000000000000003': { weekly: 1_560, monthly: 4_220 },
  '1000000000000000004': { weekly: 420, monthly: 1_050 },
  '1000000000000000005': { weekly: 2_010, monthly: 5_400 },
  '1000000000000000006': { weekly: 680, monthly: 1_920 },
};

const avatarUrl = (seed) =>
  `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(seed)}&size=128`;

/**
 * Sample own/completion events — one per content type for embed previews.
 * IDs and avatar URLs match real HTB content (resolved via API / activity feed).
 * @type {import('../htb/activity.js').ActivityEvent[]}
 */
export const SAMPLE_NOTIFICATION_EVENTS = [
  {
    type: 'root',
    id: 432,
    name: 'Paper',
    points: 30,
    ownDate: '2026-06-14T18:42:00.000Z',
    blood: true,
    avatar:
      'https://htb-mp-prod-public-storage.s3.eu-central-1.amazonaws.com/avatars/eb4e685c033d8af0b8cc00446f295f9d.png',
    categoryName: null,
    parentName: null,
    parentId: null,
    parentIdentifier: null,
    eventKey: buildEventKey({ type: 'root', id: 432, ownDate: '2026-06-14T18:42:00.000Z' }),
  },
  {
    type: 'user',
    id: 6,
    name: 'Optimum',
    points: 20,
    ownDate: '2026-06-14T16:10:00.000Z',
    blood: false,
    avatar:
      'https://htb-mp-prod-public-storage.s3.eu-central-1.amazonaws.com/avatars/bb09ffeaffe2f5220a1d591bb7b4f95e.png',
    categoryName: null,
    parentName: null,
    parentId: null,
    parentIdentifier: null,
    eventKey: buildEventKey({ type: 'user', id: 6, ownDate: '2026-06-14T16:10:00.000Z' }),
  },
  {
    type: 'challenge',
    id: 344,
    name: 'MOVs Like Jagger',
    points: 15,
    ownDate: '2026-06-13T21:05:00.000Z',
    blood: false,
    avatar:
      'https://htb-mp-prod-public-storage.s3.eu-central-1.amazonaws.com/challenge_categories/c81e728d9d4c2f636f067f89cc14862c.svg',
    categoryName: 'Crypto',
    parentName: null,
    parentId: null,
    parentIdentifier: null,
    eventKey: buildEventKey({
      type: 'challenge',
      id: 344,
      ownDate: '2026-06-13T21:05:00.000Z',
    }),
  },
  {
    type: 'sherlock',
    id: 631,
    name: 'Brutus',
    points: 40,
    ownDate: '2026-06-13T14:30:00.000Z',
    blood: false,
    avatar:
      'https://cdn.services-k8s.prod.aws.htb.systems/content/sherlocks/avatar/9e4d9103-d723-4062-b57f-0a001833056e.png',
    categoryName: null,
    parentName: null,
    parentId: null,
    parentIdentifier: null,
    eventKey: buildEventKey({
      type: 'sherlock',
      id: 631,
      ownDate: '2026-06-13T14:30:00.000Z',
    }),
  },
  {
    type: 'prolab',
    id: 901,
    name: 'DANTE-01',
    points: 10,
    ownDate: '2026-06-12T09:15:00.000Z',
    blood: false,
    avatar: null,
    categoryName: null,
    parentName: 'Dante',
    parentId: 4,
    parentIdentifier: 'DANTE',
    eventKey: buildEventKey({
      type: 'prolab',
      id: 901,
      ownDate: '2026-06-12T09:15:00.000Z',
    }),
  },
  {
    type: 'fortress',
    id: 502,
    name: 'Context-01',
    points: 25,
    ownDate: '2026-06-11T20:00:00.000Z',
    blood: false,
    avatar:
      'https://htb-mp-prod-public-storage.s3.eu-central-1.amazonaws.com/fortresses/eccbc87e4b5ce2fe28308fd9f2a7baf3_logo.svg',
    categoryName: null,
    parentName: 'Context',
    parentId: 3,
    parentIdentifier: null,
    eventKey: buildEventKey({
      type: 'fortress',
      id: 502,
      ownDate: '2026-06-11T20:00:00.000Z',
    }),
  },
];

/** Map each notification fixture to the member who "earned" it in the demo. */
export const SAMPLE_NOTIFICATION_OWNERS = [
  { memberIndex: 0, eventIndex: 0 },
  { memberIndex: 2, eventIndex: 1 },
  { memberIndex: 4, eventIndex: 2 },
  { memberIndex: 3, eventIndex: 3 },
  { memberIndex: 0, eventIndex: 4 },
  { memberIndex: 5, eventIndex: 5 },
];

export function memberAvatarUrl(member) {
  return avatarUrl(member.avatarSeed);
}
