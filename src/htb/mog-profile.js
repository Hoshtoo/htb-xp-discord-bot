import { fetchExperiencePublic } from './experience.js';

const API_BASE = 'https://labs.hackthebox.com/api/v4';
const FETCH_TIMEOUT_MS = 20_000;

/**
 * @param {string} path
 * @param {string} token
 */
async function fetchHtbJson(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`HTB API failed (HTTP ${res.status}) for ${path}`);
  }

  return res.json();
}

/**
 * @param {Array<{ name?: string, owned_machines?: number }>} [items]
 */
function parseMachineDifficulties(items) {
  const out = { easy: 0, medium: 0, hard: 0, insane: 0 };
  for (const item of items ?? []) {
    const key = String(item.name ?? '').toLowerCase();
    if (key === 'easy') out.easy = item.owned_machines ?? 0;
    else if (key === 'medium') out.medium = item.owned_machines ?? 0;
    else if (key === 'hard') out.hard = item.owned_machines ?? 0;
    else if (key === 'insane') out.insane = item.owned_machines ?? 0;
  }
  return out;
}

/**
 * @param {Array<{ mini?: boolean, completion_percentage?: number }>} [labs]
 * @param {boolean} mini
 */
function summarizeProLabs(labs, mini) {
  const filtered = (labs ?? []).filter((lab) => Boolean(lab.mini) === mini);
  if (filtered.length === 0) {
    return { solved: 0, progressPct: 0 };
  }

  const solved = filtered.filter((lab) => (lab.completion_percentage ?? 0) >= 100).length;
  const progressPct = Math.round(
    filtered.reduce((sum, lab) => sum + (lab.completion_percentage ?? 0), 0) / filtered.length
  );

  return { solved, progressPct };
}

/**
 * @param {object} machinesBody
 * @param {object} [basicBody]
 */
function normalizeMachines(machinesBody, basicBody) {
  const profile = machinesBody?.profile ?? {};
  const difficulties = parseMachineDifficulties(profile.machine_difficulties);

  return {
    machinesTotal:
      profile.machine_owns?.solved ??
      basicBody?.profile?.system_owns ??
      0,
    machinesByDifficulty: difficulties,
  };
}

/**
 * @param {string} htbUserId
 * @param {string} token
 * @param {string} [experienceUrl]
 */
export async function fetchMogProfile({ htbUserId, experienceUrl, token }) {
  const [xpResult, machinesBody, challengesBody, sherlocksBody, prolabBody, basicBody] =
    await Promise.all([
      experienceUrl
        ? fetchExperiencePublic(experienceUrl).catch(() => ({ totalExperiencePoints: null }))
        : Promise.resolve({ totalExperiencePoints: null }),
      fetchHtbJson(`/user/profile/progress/machines/${htbUserId}`, token),
      fetchHtbJson(`/user/profile/progress/challenges/${htbUserId}`, token),
      fetchHtbJson(`/user/profile/progress/sherlocks/${htbUserId}`, token),
      fetchHtbJson(`/user/profile/progress/prolab/${htbUserId}`, token),
      fetchHtbJson(`/user/profile/basic/${htbUserId}`, token).catch(() => null),
    ]);

  const machines = normalizeMachines(machinesBody, basicBody);
  const proLabs = summarizeProLabs(prolabBody?.profile?.prolabs, false);
  const miniProLabs = summarizeProLabs(prolabBody?.profile?.prolabs, true);

  return {
    xp: xpResult.totalExperiencePoints ?? 0,
    machinesTotal: machines.machinesTotal,
    machinesByDifficulty: machines.machinesByDifficulty,
    challengesTotal: challengesBody?.profile?.challenge_owns?.solved ?? 0,
    sherlocksTotal: sherlocksBody?.profile?.challenge_owns?.solved ?? 0,
    proLabsSolved: proLabs.solved,
    miniProLabsSolved: miniProLabs.solved,
    proLabsProgressPct: proLabs.progressPct,
    miniProLabsProgressPct: miniProLabs.progressPct,
  };
}
