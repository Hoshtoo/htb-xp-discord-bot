import { buildOwnEmbed } from '../discord/own-embed.js';
import { buildAllShowcaseLeaderboards } from './leaderboard-from-db.js';
import { renderEmbedPreview } from './render-embed.js';
import {
 resolveShowcaseThumbnailUrls,
 buildShowcaseDisplayUrls,
 buildShowcaseEmbedImages,
} from './resolve-thumbnails.js';
import {
 SAMPLE_MEMBERS,
 SAMPLE_NOTIFICATION_EVENTS,
 SAMPLE_NOTIFICATION_OWNERS,
 memberAvatarUrl,
} from './fixtures.js';

const RASTER_RE = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;

/**
 * Build notification embed previews for every content type.
 * @param {object} [options]
 * @param {string|null} [options.htbToken] When set, resolves thumbnails via HTB API
 */
export async function buildNotificationPreviews(options = {}) {
 const htbToken = options.htbToken ?? process.env.HTB_TOKEN ?? null;
 const thumbnailUrls = await resolveShowcaseThumbnailUrls(htbToken);
 const displayUrls = await buildShowcaseDisplayUrls(thumbnailUrls);
 const embedImages = await buildShowcaseEmbedImages(thumbnailUrls);

 return SAMPLE_NOTIFICATION_OWNERS.map(({ memberIndex, eventIndex }) => {
  const member = SAMPLE_MEMBERS[memberIndex];
  const event = SAMPLE_NOTIFICATION_EVENTS[eventIndex];
  const rawUrl = thumbnailUrls.get(eventIndex) ?? null;
  const displayUrl = displayUrls.get(eventIndex) ?? null;
  const discordImage = embedImages.get(eventIndex) ?? { url: null, files: [] };
  const rasterThumb = rawUrl && RASTER_RE.test(rawUrl) ? rawUrl : null;

  const embed = buildOwnEmbed({
   event,
   displayName: member.server_nick,
   htbUsername: member.htb_username,
   thumbnailUrl: rasterThumb,
   memberAvatarUrl: memberAvatarUrl(member),
  });

  const discordEmbedJson = embed.toJSON();
  if (discordImage.url) {
   discordEmbedJson.thumbnail = { url: discordImage.url };
  } else if (!rasterThumb) {
   delete discordEmbedJson.thumbnail;
  }

  const htmlEmbedJson = { ...discordEmbedJson };
  if (displayUrl) {
   htmlEmbedJson.thumbnail = { url: displayUrl };
  }

  return {
   member,
   event,
   embedJson: discordEmbedJson,
   discordFiles: discordImage.files,
   html: renderEmbedPreview(htmlEmbedJson),
  };
 });
}

/**
 * @param {string} guildId
 * @param {Date} [now]
 */
export function buildLeaderboardPreviews(guildId, now = new Date()) {
 return buildAllShowcaseLeaderboards(guildId, now).map((board) => ({
  period: board.period,
  title: board.title,
  lines: board.lines,
  footer: board.footer,
  html: renderEmbedPreview({
   title: board.title,
   description: board.lines.join('\n'),
   color: 0x9fef00,
   footer: { text: board.footer },
  }),
 }));
}

/**
 * @param {object} seedSummary output from seedShowcaseDatabase()
 * @param {string} dbPath
 * @param {Date} [now]
 * @param {object} [options]
 * @param {string|null} [options.htbToken]
 */
export async function buildShowcasePage(seedSummary, dbPath, now = new Date(), options = {}) {
 const notifications = await buildNotificationPreviews(options);
 const leaderboards = buildLeaderboardPreviews(seedSummary.guildId, now);
 const settings = seedSummary.settings;

 return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HTB Discord Bot — Showcase</title>
  <style>
    :root {
      --bg: #1e1f22;
      --panel: #2b2d31;
      --text: #dbdee1;
      --muted: #949ba4;
      --accent: #9fef00;
      --link: #00a8fc;
      --embed-bg: #2b2d31;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    header, main { max-width: 960px; margin: 0 auto; padding: 24px; }
    header { border-bottom: 1px solid #3f4147; }
    h1 { margin: 0 0 8px; font-size: 1.75rem; }
    h2 { margin: 32px 0 12px; font-size: 1.25rem; color: var(--accent); }
    h3 { margin: 0 0 8px; font-size: 1rem; }
    p, li { color: var(--muted); }
    code {
      background: #111214;
      padding: 2px 6px;
      border-radius: 4px;
      color: #f2f3f5;
    }
    .meta {
      display: grid;
      gap: 8px;
      background: var(--panel);
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0 0;
    }
    .meta dt { color: var(--muted); font-size: 0.85rem; }
    .meta dd { margin: 0 0 8px; color: var(--text); }
    .channel {
      background: var(--panel);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .channel-name {
      color: var(--text);
      font-weight: 600;
      margin-bottom: 12px;
    }
    .notification-list { display: grid; gap: 16px; }
    .notification-item {
      background: var(--panel);
      border-radius: 8px;
      padding: 12px 16px 16px;
    }
    .notification-label {
      font-size: 0.85rem;
      color: var(--muted);
      margin-bottom: 8px;
    }
    .leaderboard-grid { display: grid; gap: 20px; }
    .discord-embed {
      background: var(--embed-bg);
      border-left: 4px solid var(--accent);
      border-radius: 4px;
      padding: 12px 16px 16px;
      max-width: 520px;
    }
    .embed-grid {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    .embed-main { flex: 1; min-width: 0; }
    .embed-author {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .embed-author-icon {
      width: 20px;
      height: 20px;
      border-radius: 50%;
    }
    .embed-title {
      display: block;
      font-weight: 600;
      color: #fff;
      text-decoration: none;
      margin-bottom: 8px;
    }
    a.embed-title:hover { text-decoration: underline; }
    .embed-description {
      white-space: pre-wrap;
      font-size: 0.95rem;
      margin-bottom: 8px;
    }
    .embed-fields {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      margin-top: 8px;
    }
    .embed-field { min-width: 120px; }
    .embed-field.inline { flex: 0 0 auto; }
    .embed-field-name {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--muted);
      margin-bottom: 2px;
    }
    .embed-field-value { font-size: 0.9rem; }
    .embed-thumb {
      width: 80px;
      height: 80px;
      border-radius: 4px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .embed-footer, .embed-timestamp {
      font-size: 0.75rem;
      color: var(--muted);
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <header>
    <h1>HTB Discord Bot Showcase</h1>
    <p>
      Offline preview generated by <code>npm run showcase</code>. Thumbnails are pulled from
      Hack The Box (fixture CDN URLs; optional <code>HTB_TOKEN</code> refreshes Pro Lab logos via API).
    </p>
    <dl class="meta">
      <dt>Sample database</dt>
      <dd><code>${escapeHtml(dbPath)}</code></dd>
      <dt>Guild ID</dt>
      <dd><code>${escapeHtml(seedSummary.guildId)}</code></dd>
      <dt>Notification channel</dt>
      <dd><code>#htb-pwns</code> (<code>${escapeHtml(settings?.notify_channel_id ?? '')}</code>)</dd>
      <dt>Notifications</dt>
      <dd>${settings?.notify_enabled ? 'enabled' : 'disabled'} · ${seedSummary.notifiableCount} of ${seedSummary.memberCount} linked members watched (Bob opted out)</dd>
      <dt>Generated</dt>
      <dd>${escapeHtml(now.toLocaleString())}</dd>
    </dl>
  </header>
  <main>
    <h2>Own / completion notifications</h2>
    <p>Every HTB activity type the watcher announces, using the same embed builder as production.</p>
    <div class="channel">
      <div class="channel-name">#htb-pwns</div>
      <div class="notification-list">
        ${notifications
         .map(
          ({ member, event, html }) => `
        <div class="notification-item">
          <div class="notification-label">${escapeHtml(member.server_nick)} · ${escapeHtml(event.type)}${event.blood ? ' · first blood' : ''}</div>
          ${html}
        </div>`
         )
         .join('')}
      </div>
    </div>

    <h2>Leaderboards</h2>
    <p>Rankings built from the seeded database via the same formatting helpers as <code>/leaderboard</code> (offline — uses stored XP snapshots).</p>
    <div class="leaderboard-grid">
      ${leaderboards
       .map(
        (board) => `
      <section>
        <h3>${escapeHtml(board.title)}</h3>
        ${board.html}
      </section>`
       )
       .join('')}
    </div>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
 return String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
}
