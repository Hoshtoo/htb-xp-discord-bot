import { resolveThumbnail, normalizeAvatarUrl } from '../htb/thumbnails.js';
import { buildDisplayImageUrl, buildEmbedImage } from '../discord/embed-image.js';
import { SAMPLE_NOTIFICATION_EVENTS } from './fixtures.js';

/**
 * Resolve HTB thumbnail URLs for every showcase notification event.
 * Uses the same resolver as production when `HTB_TOKEN` is set; otherwise
 * falls back to feed-style `avatar` URLs baked into the fixtures.
 *
 * @param {string|null|undefined} token
 * @returns {Promise<Map<number, string|null>>} eventIndex → raw HTB image URL
 */
export async function resolveShowcaseThumbnailUrls(token) {
 const map = new Map();

 for (let i = 0; i < SAMPLE_NOTIFICATION_EVENTS.length; i++) {
  const event = SAMPLE_NOTIFICATION_EVENTS[i];
  let url = null;

  if (token) {
   try {
    url = await resolveThumbnail(event, token);
   } catch {
    url = null;
   }
  }

  if (!url && event.avatar) {
   url = normalizeAvatarUrl(event.avatar);
  }

  map.set(i, url);
 }

 return map;
}

/**
 * @param {Map<number, string|null>} thumbnailUrls
 */
export async function buildShowcaseEmbedImages(thumbnailUrls) {
 const images = new Map();

 for (const [index, rawUrl] of thumbnailUrls) {
  images.set(index, await buildEmbedImage(rawUrl));
 }

 return images;
}

/**
 * @param {Map<number, string|null>} thumbnailUrls
 */
export async function buildShowcaseDisplayUrls(thumbnailUrls) {
 const display = new Map();

 for (const [index, rawUrl] of thumbnailUrls) {
  display.set(index, await buildDisplayImageUrl(rawUrl));
 }

 return display;
}
