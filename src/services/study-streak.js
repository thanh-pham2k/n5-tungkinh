function toLocalDate(value) {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function toLocalDateKey(value) {
  const date = toLocalDate(value);
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDateKey(dateKey, deltaDays) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day + deltaDays);
  return toLocalDateKey(date);
}

/**
 * Updates stored completion history timestamps when a lesson is marked or unmarked.
 */
export function updateCompletionHistory(history, completedAt, previousCompletedAt) {
  const base = Array.isArray(history)
    ? history.filter((item) => typeof item === 'string' && toLocalDateKey(item))
    : [];
  const prevKey = toLocalDateKey(previousCompletedAt);
  if (!completedAt) {
    if (!prevKey) return base;
    return base.filter((item) => toLocalDateKey(item) !== prevKey);
  }
  const nextKey = toLocalDateKey(completedAt);
  const byDay = new Map();
  if (prevKey) byDay.set(prevKey, previousCompletedAt);
  for (const item of base) {
    const key = toLocalDateKey(item);
    if (key) byDay.set(key, item);
  }
  if (nextKey) byDay.set(nextKey, completedAt);
  return Array.from(byDay.values());
}

/**
 * Collects sorted unique local YYYY-MM-DD keys from lesson completion data.
 */
export function collectCompletionDateKeys(lessons) {
  const keys = new Set();
  for (const lesson of lessons || []) {
    if (lesson?.completedAt) {
      const key = toLocalDateKey(lesson.completedAt);
      if (key) keys.add(key);
    }
    if (Array.isArray(lesson?.completionHistory)) {
      for (const item of lesson.completionHistory) {
        const key = toLocalDateKey(item);
        if (key) keys.add(key);
      }
    }
  }
  return Array.from(keys).sort();
}

/**
 * Computes current streak, best streak, today's status, and total active days.
 */
export function computeStudyStreak(lessons, now = Date.now()) {
  const keys = collectCompletionDateKeys(lessons);
  if (!keys.length) {
    return { currentStreak: 0, bestStreak: 0, studiedToday: false, totalDays: 0 };
  }

  const dateSet = new Set(keys);
  const todayKey = toLocalDateKey(now);
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const studiedToday = dateSet.has(todayKey);

  let currentStreak = 0;
  let cursor = studiedToday ? todayKey : dateSet.has(yesterdayKey) ? yesterdayKey : null;
  while (cursor && dateSet.has(cursor)) {
    currentStreak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  let bestStreak = 0;
  let run = 0;
  let expectedNext = null;
  for (const key of keys) {
    if (key === expectedNext) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > bestStreak) bestStreak = run;
    expectedNext = shiftDateKey(key, 1);
  }

  return {
    currentStreak,
    bestStreak,
    studiedToday,
    totalDays: keys.length,
  };
}
