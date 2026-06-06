const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * @param {'all' | 'weekly' | 'monthly'} period
 * @param {Date} [now]
 */
export function getPeriodBounds(period, now = new Date()) {
  if (period === 'all') {
    return { start: null, end: now, label: 'All time' };
  }

  if (period === 'weekly') {
    const start = startOfIsoWeekUtc(now);
    const end = endOfIsoWeekUtc(start);
    return {
      start,
      end: now,
      label: formatWeekLabel(start, end),
    };
  }

  if (period === 'monthly') {
    const start = startOfMonthUtc(now);
    const end = endOfMonthUtc(start);
    return {
      start,
      end: now,
      label: formatMonthLabel(start, end),
    };
  }

  throw new Error(`Unknown period: ${period}`);
}

function startOfIsoWeekUtc(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfIsoWeekUtc(weekStart) {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + 6);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function startOfMonthUtc(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfMonthUtc(monthStart) {
  return new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  );
}

function formatUtcDate(d) {
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function formatWeekLabel(start, end) {
  return `${formatUtcDate(start)} – ${formatUtcDate(end)} UTC`;
}

function formatMonthLabel(start, end) {
  return `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()} UTC`;
}

export function getPeriodTitle(period) {
  switch (period) {
    case 'weekly':
      return 'HTB XP Leaderboard — This Week';
    case 'monthly':
      return 'HTB XP Leaderboard — This Month';
    default:
      return 'HTB XP Leaderboard';
  }
}

export function getPeriodXpSuffix(period) {
  switch (period) {
    case 'weekly':
      return ' XP this week';
    case 'monthly':
      return ' XP this month';
    default:
      return ' XP';
  }
}

/** ISO week key for scheduler idempotency (Monday date, UTC). */
export function getWeekPeriodKey(date = new Date()) {
  return startOfIsoWeekUtc(date).toISOString().slice(0, 10);
}

/** Calendar month key for scheduler idempotency (YYYY-MM, UTC). */
export function getMonthPeriodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getWeekPeriodStart(date = new Date()) {
  return startOfIsoWeekUtc(date);
}

export function getMonthPeriodStart(date = new Date()) {
  return startOfMonthUtc(date);
}
