const CONCURRENCY = 5;
const EXPERIENCE_V1_RE = /\/api\/experience\/v1\//i;
const EXPERIENCE_ACCOUNT_PATH_RE = /^\/api\/experience\/v1\/account\/[0-9a-f-]{36}$/i;

/** @param {string} url */
export function isExperienceAccountUrl(url) {
  try {
    return EXPERIENCE_ACCOUNT_PATH_RE.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/**
 * Public Experience v1 endpoint — no Authorization header required.
 * @param {string} experienceUrl
 */
export async function fetchExperiencePublic(experienceUrl) {
  if (!EXPERIENCE_V1_RE.test(experienceUrl)) {
    throw new Error('URL is not an Experience v1 API endpoint');
  }
  if (!isExperienceAccountUrl(experienceUrl)) {
    throw new Error(
      'URL is not a valid Experience account endpoint (expected .../account/{uuid}, not xp-earned subpaths)'
    );
  }

  const res = await fetch(experienceUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    throw new Error(`Experience API failed (HTTP ${res.status})`);
  }

  const body = await res.json();
  return {
    totalExperiencePoints: body.totalExperiencePoints ?? null,
    level: body.level ?? null,
    levelTitle: body.levelTitle ?? null,
  };
}

/**
 * @param {Array<{ member: object, experienceUrl: string }>} items
 */
export async function fetchAllExperience(items) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      const { member, experienceUrl } = items[i];
      try {
        const xp = await fetchExperiencePublic(experienceUrl);
        results[i] = { member, ok: true, ...xp };
      } catch (err) {
        results[i] = {
          member,
          ok: false,
          error: err.message,
          totalExperiencePoints: null,
        };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}
