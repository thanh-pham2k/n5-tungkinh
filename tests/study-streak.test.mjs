import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStudyStreak, updateCompletionHistory } from '../src/services/study-streak.js';

function localIso(year, month, day, hour = 10) {
  return new Date(year, month - 1, day, hour, 0, 0).toISOString();
}

test('computeStudyStreak returns zeros when no lessons are completed', () => {
  const now = new Date(2026, 10, 15, 14, 0, 0).getTime();
  assert.deepEqual(computeStudyStreak([{ id: '1', completedAt: null }], now), {
    currentStreak: 0,
    bestStreak: 0,
    studiedToday: false,
    totalDays: 0,
  });
});

test('computeStudyStreak counts consecutive days ending today or yesterday and preserves best streak', () => {
  const now = new Date(2026, 10, 15, 20, 0, 0).getTime();
  const lessons = [
    {
      id: 'l1',
      completedAt: localIso(2026, 11, 15, 19),
      completionHistory: [
        localIso(2026, 11, 10, 9),
        localIso(2026, 11, 11, 9),
        localIso(2026, 11, 12, 9),
        localIso(2026, 11, 15, 19),
      ],
    },
    {
      id: 'l2',
      completedAt: localIso(2026, 11, 14, 21),
    },
  ];
  assert.deepEqual(computeStudyStreak(lessons, now), {
    currentStreak: 2,
    bestStreak: 3,
    studiedToday: true,
    totalDays: 5,
  });

  const yesterdayOnly = [
    { id: 'l1', completedAt: localIso(2026, 11, 14, 18) },
    { id: 'l2', completedAt: localIso(2026, 11, 13, 18) },
  ];
  assert.deepEqual(computeStudyStreak(yesterdayOnly, now), {
    currentStreak: 2,
    bestStreak: 2,
    studiedToday: false,
    totalDays: 2,
  });
});

test('updateCompletionHistory deduplicates by day and removes unmarked day', () => {
  const day1Morning = localIso(2026, 11, 14, 8);
  const day1Evening = localIso(2026, 11, 14, 20);
  const day2 = localIso(2026, 11, 15, 9);

  const afterDay1 = updateCompletionHistory([], day1Evening, day1Morning);
  assert.equal(afterDay1.length, 1);
  assert.equal(afterDay1[0], day1Evening);

  const afterDay2 = updateCompletionHistory(afterDay1, day2, day1Evening);
  assert.equal(afterDay2.length, 2);

  const afterUnmark = updateCompletionHistory(afterDay2, null, day2);
  assert.deepEqual(afterUnmark, [day1Evening]);
});
