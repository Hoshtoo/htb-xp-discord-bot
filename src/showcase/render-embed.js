/**
 * Render a Discord embed JSON object as an HTML preview card.
 * @param {import('discord.js').APIEmbed} embed
 */
export function renderEmbedPreview(embed) {
 const color = embed.color != null ? `#${embed.color.toString(16).padStart(6, '0')}` : '#9fef00';
 const title = embed.title ? escapeHtml(embed.title) : '';
 const url = embed.url ? escapeHtml(embed.url) : null;
 const authorName = embed.author?.name ? escapeHtml(embed.author.name) : '';
 const authorIcon = embed.author?.icon_url ? escapeHtml(embed.author.icon_url) : null;
 const thumb = embed.thumbnail?.url ? escapeHtml(embed.thumbnail.url) : null;
 const timestamp = embed.timestamp
  ? new Date(embed.timestamp).toLocaleString()
  : '';
 const description = embed.description
  ? `<div class="embed-description">${escapeHtml(embed.description)}</div>`
  : '';
 const footer = embed.footer?.text
  ? `<div class="embed-footer">${escapeHtml(embed.footer.text)}</div>`
  : '';

 const fields = (embed.fields ?? [])
  .map(
   (field) => `
    <div class="embed-field${field.inline ? ' inline' : ''}">
      <div class="embed-field-name">${escapeHtml(field.name)}</div>
      <div class="embed-field-value">${escapeHtml(field.value)}</div>
    </div>`
  )
  .join('');

 const titleHtml = title
  ? url
    ? `<a class="embed-title" href="${url}" target="_blank" rel="noopener">${title}</a>`
    : `<div class="embed-title">${title}</div>`
  : '';

 return `
  <article class="discord-embed" style="border-left-color: ${color}">
    <div class="embed-grid">
      <div class="embed-main">
        ${
         authorName
          ? `<div class="embed-author">${authorIcon ? `<img src="${authorIcon}" alt="" class="embed-author-icon" />` : ''}<span>${authorName}</span></div>`
          : ''
        }
        ${titleHtml}
        ${description}
        ${fields ? `<div class="embed-fields">${fields}</div>` : ''}
        ${footer}
        ${timestamp ? `<div class="embed-timestamp">${escapeHtml(timestamp)}</div>` : ''}
      </div>
      ${thumb ? `<img class="embed-thumb" src="${thumb}" alt="" loading="lazy" />` : ''}
    </div>
  </article>`;
}

/**
 * @param {import('discord.js').APIEmbed} embed
 */
export function renderLeaderboardEmbedPreview({ title, lines, footer }) {
 const description = lines.join('\n');
 return renderEmbedPreview({
  title,
  description,
  color: 0x9fef00,
  footer: footer ? { text: footer } : undefined,
 });
}

function escapeHtml(value) {
 return String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
}
