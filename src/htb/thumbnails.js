const API_V4_BASE = 'https://labs.hackthebox.com/api/v4';
const STORAGE_BASE = 'https://labs.hackthebox.com';
const FETCH_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

/** @type {Map<string, { url: string | null, at: number }>} */
const cache = new Map();

/**
 * Turn a possibly-relative HTB image path into an absolute URL.
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function normalizeAvatarUrl(url) {
 if (!url || typeof url !== 'string') return null;
 const trimmed = url.trim();
 if (!trimmed) return null;
 if (/^https?:\/\//i.test(trimmed)) return trimmed;
 if (trimmed.startsWith('/')) return `${STORAGE_BASE}${trimmed}`;
 return `${STORAGE_BASE}/${trimmed}`;
}

/**
 * Discord embeds render PNG/JPG/GIF/WebP but NOT SVG. Prefer raster images.
 * @param {string|null} url
 */
function isRenderable(url) {
 if (!url) return false;
 return !/\.svg(\?.*)?$/i.test(url);
}

async function fetchJson(path, token) {
 const res = await fetch(`${API_V4_BASE}${path}`, {
 headers: {
 Authorization: `Bearer ${token}`,
 Accept: 'application/json',
 },
 signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
 });
 if (!res.ok) throw new Error(`HTB API ${path} -> HTTP ${res.status}`);
 return res.json();
}

/**
 * Pick the first renderable (non-SVG) candidate, else the first defined one.
 * @param {Array<string|null|undefined>} candidates
 */
function pickBest(candidates) {
 const normalized = candidates.map(normalizeAvatarUrl).filter(Boolean);
 // Only return raster images — Discord embeds can't render SVG.
 return normalized.find(isRenderable) ?? null;
}

/**
 * Fetch a raster thumbnail for a given content type from v4 detail endpoints.
 * Results (including misses) are cached to avoid hammering the API.
 * @param {import('./activity.js').ActivityEvent} event
 * @param {string} token
 * @returns {Promise<string|null>}
 */
async function fetchThumbnailFallback(event, token) {
 const cacheKey =
 event.type === 'prolab' || event.type === 'fortress'
 ? `${event.type}:${event.parentId}`
 : `${event.type}:${event.id}`;

 const cached = cache.get(cacheKey);
 if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.url;

 let url = null;
 try {
 switch (event.type) {
 case 'root':
 case 'user': {
 const body = await fetchJson(`/machine/profile/${event.id}`, token);
 url = pickBest([body?.info?.avatar]);
 break;
 }
 case 'prolab': {
 const body = await fetchJson(`/prolab/${event.parentId}/info`, token);
 const data = body?.data ?? {};
 url = pickBest([data.cover_image_url, data.avatar_url, data.avatar_48_url]);
 break;
 }
 case 'fortress': {
 const body = await fetchJson(`/fortress/${event.parentId}`, token);
 const data = body?.data ?? body ?? {};
 url = pickBest([data.cover_image_url, data.image, data.logo]);
 break;
 }
 case 'sherlock': {
 const body = await fetchJson(`/sherlocks/${event.id}/info`, token);
 const data = body?.data ?? {};
 url = pickBest([data.avatar, data.avatar_url]);
 break;
 }
 case 'challenge':
 default:
 url = null;
 break;
 }
 } catch (err) {
 // Network/parse issues shouldn't break a notification — fall back to feed avatar.
 url = null;
 }

 cache.set(cacheKey, { url, at: Date.now() });
 return url;
}

/**
 * Resolve the best embed image URL for an own event.
 *
 * Strategy: use the feed-provided avatar when it's a renderable raster image;
 * otherwise try a v4 detail endpoint for a PNG/JPG; otherwise fall back to the
 * feed avatar even if it's an SVG (better than nothing).
 *
 * @param {import('./activity.js').ActivityEvent} event
 * @param {string} token
 * @returns {Promise<string|null>}
 */
export async function resolveThumbnail(event, token) {
 const feedAvatar = normalizeAvatarUrl(event.avatar);
 if (feedAvatar && isRenderable(feedAvatar)) return feedAvatar;

 const fallback = await fetchThumbnailFallback(event, token);
 if (fallback) return fallback;

 // Only an SVG (or nothing) is available — return null so we show no broken
 // image rather than an unrenderable SVG.
 return null;
}
