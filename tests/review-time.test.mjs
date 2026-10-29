import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReviewTime } from '../src/services/review-time.js';
test('formats completed review time at minute, hour and day boundaries', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  const ago = (minutes) => new Date(now - minutes * 60000).toISOString();
  assert.equal(formatReviewTime(undefined, now), 'Chưa có thời gian ôn');
  assert.equal(formatReviewTime('invalid', now), 'Chưa có thời gian ôn');
  assert.equal(formatReviewTime(ago(0), now), 'Vừa ôn xong');
  assert.equal(formatReviewTime(ago(10), now), 'Ôn 10 phút trước');
  assert.equal(formatReviewTime(ago(30), now), 'Ôn 30 phút trước');
  assert.equal(formatReviewTime(ago(60), now), 'Ôn 1 giờ trước');
  assert.equal(formatReviewTime(ago(1440), now), 'Ôn 1 ngày trước');
});
