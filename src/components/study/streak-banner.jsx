'use client';
import { computeStudyStreak } from '../../services/study-streak';

/**
 * Displays the user's consecutive study streak and best record for a lesson module.
 */
export default function StreakBanner({ lessons, clock }) {
  const { currentStreak, bestStreak, studiedToday, totalDays } = computeStudyStreak(
    lessons,
    clock || Date.now(),
  );

  return (
    <section
      className={`streak-banner ${studiedToday ? 'is-active' : ''}`}
      aria-label="Chuỗi ngày học"
    >
      <div className="streak-main">
        <span className="streak-count">
          <span aria-hidden="true">🔥</span> Chuỗi học: <strong>{currentStreak} ngày</strong>
        </span>
        <span className="streak-status">
          {studiedToday
            ? 'Hôm nay đã hoàn thành'
            : currentStreak > 0
              ? 'Học 1 bài hôm nay để giữ chuỗi'
              : 'Hoàn thành 1 bài để bắt đầu chuỗi'}
        </span>
      </div>
      <div className="streak-meta">
        <span>Kỷ lục: {bestStreak} ngày</span>
        <span>Tổng: {totalDays} ngày</span>
      </div>
    </section>
  );
}
