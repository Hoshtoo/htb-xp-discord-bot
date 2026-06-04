const PROFILE_BASIC_URL =
  'https://labs.hackthebox.com/api/v4/user/profile/basic';
const SEARCH_FETCH_URL = 'https://labs.hackthebox.com/api/v4/search/fetch';

export class HtbResolveError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'HtbResolveError';
    this.code = code;
  }
}

function isNumericId(value) {
  return /^\d+$/.test(String(value).trim());
}

/**
 * Resolve HTB display name to numeric user id via search API.
 * @param {string} username
 * @param {string} token
 */
async function resolveUsernameToId(username, token) {
  const trimmed = username.trim();
  const searchUrl = `${SEARCH_FETCH_URL}?query=${encodeURIComponent(`"${trimmed}"`)}`;

  const res = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new HtbResolveError(
      `HTB user search failed (HTTP ${res.status}).`,
      'HTTP_ERROR'
    );
  }

  const data = await res.json();
  const users = data?.users ?? [];
  const exact = users.find(
    (u) => String(u.value).toLowerCase() === trimmed.toLowerCase()
  );
  const match = exact ?? users[0];

  if (!match?.id) {
    throw new HtbResolveError(`HTB user "${trimmed}" not found.`, 'NOT_FOUND');
  }

  return String(match.id);
}

/**
 * @param {string} htbUsernameOrId
 * @param {string} token
 * @returns {Promise<{ id: string, name: string, accountId: string | null }>}
 */
export async function resolveHtbUser(htbUsernameOrId, token) {
  const input = String(htbUsernameOrId).trim();
  const userId = isNumericId(input) ? input : await resolveUsernameToId(input, token);

  const url = `${PROFILE_BASIC_URL}/${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (res.status === 404) {
    throw new HtbResolveError(`HTB user "${input}" not found.`, 'NOT_FOUND');
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const detail = errBody?.message?.user_id?.[0] ?? errBody?.message;
    throw new HtbResolveError(
      detail
        ? `HTB profile lookup failed: ${detail}`
        : `HTB profile lookup failed (HTTP ${res.status}).`,
      'HTTP_ERROR'
    );
  }

  const data = await res.json();
  const profile = data?.profile;
  if (!profile?.id) {
    throw new HtbResolveError(`HTB user "${input}" not found.`, 'NOT_FOUND');
  }

  return {
    id: String(profile.id),
    name: profile.name ?? input,
    accountId: profile.account_id ?? null,
  };
}

export function buildExperienceUrl(accountId) {
  return `https://labs.hackthebox.com/api/experience/v1/account/${accountId}`;
}
