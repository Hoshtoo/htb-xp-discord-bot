const API_V5_BASE = 'https://labs.hackthebox.com/api/v5';
const FETCH_TIMEOUT_MS = 20_000;

/**
 * A normalized own/activity event from the HTB v5 user activity feed.
 * @typedef {Object} ActivityEvent
 * @property {string} type        - root | user | challenge | sherlock | prolab | fortress
 * @property {number} id          - HTB object id (machine/challenge/sherlock id, or flag id for prolab/fortress)
 * @property {string} name        - Display name (machine/challenge name, or flag name for prolab/fortress)
 * @property {number} points      - XP/points awarded
 * @property {string} ownDate     - ISO timestamp of the own
 * @property {boolean} blood       - Whether this was a first blood (machines/challenges)
 * @property {string|null} avatar - Absolute image URL when provided by the feed
 * @property {string|null} categoryName - Challenge category (challenges only)
 * @property {string|null} parentName   - Pro lab / fortress name (prolab & fortress only)
 * @property {string|null} parentId     - Pro lab / fortress id (prolab & fortress only)
 * @property {string|null} parentIdentifier - Pro lab identifier, e.g. DANTE (prolab only)
 * @property {string} eventKey    - Stable per-event dedupe key
 */

/**
 * Stable key identifying a single own event for dedupe purposes.
 * @param {object} item
 */
export function buildEventKey(item) {
 return `${item.type}:${item.id}:${item.ownDate}`;
}

/**
 * @param {object} item raw feed item
 * @returns {ActivityEvent}
 */
function normalizeItem(item) {
 return {
 type: item.type,
 id: item.id,
 name: item.name,
 points: item.points ?? 0,
 ownDate: item.ownDate,
 blood: Boolean(item.blood),
 avatar: item.avatar ?? null,
 categoryName: item.categoryName ?? null,
 parentName: item.prolabName ?? item.fortressName ?? null,
 parentId: item.prolabId ?? item.fortressId ?? null,
 parentIdentifier: item.prolabIdentifier ?? null,
 eventKey: buildEventKey(item),
 };
}

/**
 * Fetch the most recent activity for an HTB user across every content type
 * (machine user/root owns, challenges, sherlocks, pro lab flags, fortress flags).
 *
 * @param {string|number} htbUserId
 * @param {string} token HTB app token (bearer)
 * @param {{ perPage?: number, page?: number }} [options]
 * @returns {Promise<ActivityEvent[]>} newest-first list of normalized events
 */
export async function fetchUserActivity(htbUserId, token, options = {}) {
 const perPage = options.perPage ?? 30;
 const page = options.page ?? 1;
 const url = `${API_V5_BASE}/user/profile/activity/${encodeURIComponent(
 htbUserId
 )}?page=${page}&per_page=${perPage}`;

 const res = await fetch(url, {
 headers: {
 Authorization: `Bearer ${token}`,
 Accept: 'application/json',
 },
 signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
 });

 if (!res.ok) {
 throw new Error(`HTB activity API failed (HTTP ${res.status}) for user ${htbUserId}`);
 }

 const body = await res.json();
 const items = Array.isArray(body?.data) ? body.data : [];

 return items
 .filter((item) => item && item.type && item.id != null && item.ownDate)
 .map(normalizeItem);
}
