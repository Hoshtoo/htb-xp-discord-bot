import { getSchedulerRun, pruneSnapshots, setSchedulerRun } from '../db.js';
import {
  getMonthPeriodKey,
  getMonthPeriodStart,
  getWeekPeriodKey,
  getWeekPeriodStart,
} from '../htb/periods.js';
import { syncAllLinkedMembers } from '../htb/sync-all-linked.js';

const CHECK_INTERVAL_MS = 60_000;
const JOBS = {
  weekly: 'weekly-baseline',
  monthly: 'monthly-baseline',
};

let intervalId = null;
let running = false;

function hasPeriodStarted(now, periodStart) {
  return now.getTime() >= periodStart.getTime();
}

function shouldRunJob(job, periodKey, periodStart, now) {
  if (!hasPeriodStarted(now, periodStart)) return false;

  const lastRun = getSchedulerRun(job);
  return lastRun?.period_key !== periodKey;
}

async function runBaselineSync(label) {
  const result = await syncAllLinkedMembers();
  console.log(
    `[scheduler] ${label}: synced ${result.ok}/${result.total} linked member(s)` +
      (result.fail ? ` (${result.fail} failed)` : '')
  );

  if (result.errors.length) {
    for (const err of result.errors.slice(0, 5)) {
      console.warn(
        `[scheduler] ${label} failed for guild ${err.guildId} user ${err.discordUserId}: ${err.error}`
      );
    }
    if (result.errors.length > 5) {
      console.warn(`[scheduler] ${label}: ${result.errors.length - 5} more failure(s) omitted`);
    }
  }

  return result;
}

async function runDueSyncs(now = new Date()) {
  if (running) return;
  running = true;

  try {
    const weekKey = getWeekPeriodKey(now);
    const monthKey = getMonthPeriodKey(now);

    if (shouldRunJob(JOBS.weekly, weekKey, getWeekPeriodStart(now), now)) {
      await runBaselineSync(`Weekly baseline (${weekKey})`);
      setSchedulerRun(JOBS.weekly, weekKey, now);
    }

    if (shouldRunJob(JOBS.monthly, monthKey, getMonthPeriodStart(now), now)) {
      await runBaselineSync(`Monthly baseline (${monthKey})`);
      setSchedulerRun(JOBS.monthly, monthKey, now);
      pruneSnapshots();
    }
  } finally {
    running = false;
  }
}

export function startPeriodBaselineScheduler() {
  if (intervalId != null) return;

  console.log(
    '[scheduler] Period baseline sync enabled (weekly: Monday 00:00 UTC, monthly: 1st 00:00 UTC)'
  );

  runDueSyncs().catch((err) => {
    console.error('[scheduler] Period baseline sync failed:', err);
  });

  intervalId = setInterval(() => {
    runDueSyncs().catch((err) => {
      console.error('[scheduler] Period baseline sync failed:', err);
    });
  }, CHECK_INTERVAL_MS);

  if (typeof intervalId.unref === 'function') {
    intervalId.unref();
  }
}
