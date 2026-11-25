'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button, Status } from './ui/primitives';
import MarkdownWorkspace from './markdown-workspace';
import LoginView from './auth/login-view';
import useAuth from '../hooks/use-auth';
import { readCatalog, studyRequest } from '../services/study-library-client';
import { formatReviewTime } from '../services/review-time';
import StreakBanner from './study/streak-banner';

async function computeSha256(text) {
  if (typeof crypto !== 'undefined' && crypto?.subtle) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return null;
}

const UNITS = [
  { unit: 1, title: 'Unité 1 : Un air de famille' },
  { unit: 2, title: 'Unité 2 : Qui êtes-vous ?' },
  { unit: 3, title: 'Unité 3 : Villes et voyages' },
  { unit: 4, title: 'Unité 4 : Santé et mode de vie' },
  { unit: 5, title: 'Unité 5 : Travail et études' },
  { unit: 6, title: 'Unité 6 : Temps libre' },
];

export default function FrenchTaxiCourse({ onLogout, embedded = false }) {
  const { user, loading, setUser, logout } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(0);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const catalog = await readCatalog('french-taxi');
      const catalogWithHash = await Promise.all(
        catalog.map(async (item) => {
          const hash = await computeSha256(item.source.trim());
          const firstLine = item.source.split('\n')[0].replace(/\s+/g, ' ').slice(0, 100);
          return { ...item, hash, prefix: firstLine };
        }),
      );

      let cursor;
      const records = [];
      do {
        const query = new URLSearchParams({
          tool: 'markdown',
          limit: '100',
          ...(cursor ? { cursor } : {}),
        });
        const listing = await studyRequest(`/study-contents?${query}`);
        records.push(...listing.data);
        cursor = listing.meta.page.nextCursor;
      } while (cursor);

      setLessons(
        catalogWithHash.map((item) => {
          const match =
            (item.hash ? records.find((record) => record.sourceHash === item.hash) : null) ||
            records.find(
              (record) => record.title && item.prefix && record.title.startsWith(item.prefix),
            );
          const progress = match?.progress;
          return {
            ...item,
            completedAt: progress?.foundationCompletedAt || null,
            completionHistory: progress?.foundationCompletionHistory || [],
            completionCount:
              progress?.foundationCompletionCount ?? (progress?.foundationCompletedAt ? 1 : 0),
          };
        }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (user?.username === 'yentr') load();
  }, [user, load]);

  useEffect(() => {
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (loading) return <Status>Đang kiểm tra phiên đăng nhập…</Status>;
  if (!user) return <LoginView onLoginSuccess={setUser} />;
  if (user.username !== 'yentr')
    return (
      <main className="foundation-page">
        <Status error>Bạn không có quyền xem mục này.</Status>
        <a className="button" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`}>
          ← Về trang chủ
        </a>
      </main>
    );

  return (
    <>
      {selected && (
        <main className="foundation-page course-reading">
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Button
              onClick={() => {
                setSelected(null);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
            >
              ← Danh sách bài học
            </Button>
          </div>
          <h2 className="course-reading-title">{selected.title}</h2>
          <MarkdownWorkspace
            foundation={selected}
            onFoundationComplete={(completedAt, _completionCount, completionHistory) => {
              setClock(Date.now());
              setLessons((current) =>
                current.map((item) =>
                  item.id === selected.id ? { ...item, completedAt, completionHistory } : item,
                ),
              );
            }}
          />
        </main>
      )}

      <main className="foundation-page" hidden={!!selected}>
        {!embedded && (
          <div
            className="course-nav-bar"
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '16px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <a className="button" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/french/`}>
              🇫🇷 Tiếng Pháp A1–A2 ↗
            </a>
            <Button variant="secondary" onClick={onLogout || logout}>
              Đăng xuất
            </Button>
          </div>
        )}

        <p className="eyebrow">LE NOUVEAU TAXI ! 1 · DÀNH RIÊNG CHO YENTR</p>
        <h1>Le Nouveau Taxi 1 · 24 bài</h1>
        <p style={{ marginBottom: '24px', color: 'var(--ink-muted)' }}>
          6 Unité, 24 bài học tiếng Pháp theo giáo trình kèm lý thuyết, từ vựng và quiz tương tác.
        </p>
        {!busy && !error && <StreakBanner lessons={lessons} clock={clock} />}

        {busy && <Status>Đang tải danh sách bài học…</Status>}
        {error && (
          <>
            <Status error>{error}</Status>
            <button className="button" onClick={load}>
              Thử lại
            </button>
          </>
        )}

        {!busy &&
          !error &&
          UNITS.map(({ unit, title }) => {
            const unitLessons = lessons.filter((item) => item.unit === unit);
            if (!unitLessons.length) return null;

            const ordered = [...unitLessons].sort((a, b) =>
              !a.completedAt
                ? b.completedAt
                  ? -1
                  : 0
                : !b.completedAt
                  ? 1
                  : a.completedAt.localeCompare(b.completedAt),
            );

            const completedCount = unitLessons.filter((l) => l.completedAt).length;

            return (
              <details className="foundation-phase" key={unit} open={unit === 1 ? true : undefined}>
                <summary className="foundation-phase-toggle">
                  <span>
                    {title} ({completedCount}/{unitLessons.length})
                  </span>
                  <span className="foundation-phase-icon" aria-hidden="true" />
                </summary>
                {ordered.map((item) => (
                  <button
                    key={item.id}
                    className="foundation-lesson"
                    type="button"
                    onClick={() => {
                      setSelected(item);
                      window.scrollTo({ top: 0, behavior: 'instant' });
                    }}
                  >
                    <span className="foundation-lesson-main">
                      <span
                        className={`foundation-status ${item.completedAt ? 'is-complete' : ''}`}
                        role="img"
                        aria-label={item.completedAt ? 'Đã hoàn thành' : 'Chưa hoàn thành'}
                      >
                        {item.completedAt && <span aria-hidden="true">✓</span>}
                      </span>
                      <span>
                        <strong>{item.label}</strong>
                        <br />
                        {item.title}
                        {item.completedAt && (
                          <time className="foundation-completed-time" dateTime={item.completedAt}>
                            {formatReviewTime(item.completedAt, clock)}
                          </time>
                        )}
                      </span>
                    </span>
                    <span className="foundation-lesson-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </button>
                ))}
              </details>
            );
          })}
      </main>
    </>
  );
}
