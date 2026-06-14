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
 * First defined candidate, normalized to an absolute URL. Candidates should be
 * passed in preference order (best/square logo first). SVGs are allowed — the
 * embed image layer rasterizes them to PNG before sending to Discord.
 * @param {Array<string|null|undefined>} candidates
 */
function pickFirst(candidates) {
 const normalized = candidates.map(normalizeAvatarUrl).filter(Boolean);
 return normalized[0] ?? null;
}

/**
 * Fetch a thumbnail for content types whose activity item has no usable avatar
 * (notably Pro Labs). Results are cached to avoid hammering the API.
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
 url = pickFirst([body?.info?.avatar]);
 break;
 }
 case 'prolab': {
 const body = await fetchJson(`/prolab/${event.parentId}/info`, token);
 const data = body?.data ?? {};
 // Prefer the square logo over the wide cover banner.
 url = pickFirst([data.avatar_url, data.avatar_48_url, data.cover_image_url]);
 break;
 }
 case 'fortress': {
 const body = await fetchJson(`/fortress/${event.parentId}`, token);
 const data = body?.data ?? body ?? {};
 url = pickFirst([data.logo, data.cover_image_url, data.image]);
 break;
 }
 case 'sherlock': {
 const body = await fetchJson(`/sherlocks/${event.id}/info`, token);
 const data = body?.data ?? {};
 url = pickFirst([data.avatar, data.avatar_url]);
 break;
 }
 case 'challenge':
 default:
 url = null;
 break;
 }
 } catch {
 url = null;
 }

 cache.set(cacheKey, { url, at: Date.now() });
 return url;
}

/**
 * Resolve the best embed image URL for an own event. May return an SVG URL —
 * callers should pass the result through `buildEmbedImage` which rasterizes SVG
 * to PNG for Discord.
 *
 * @param {import('./activity.js').ActivityEvent} event
 * @param {string} token
 * @returns {Promise<string|null>}
 */
export async function resolveThumbnail(event, token) {
 // Feed avatar covers machines/sherlocks (PNG) and challenges/fortresses (SVG logo).
 const feedAvatar = normalizeAvatarUrl(event.avatar);
 if (feedAvatar) return feedAvatar;

 // Pro Labs (and any item lacking a feed avatar) fall back to a detail endpoint.
 return fetchThumbnailFallback(event, token);
}
