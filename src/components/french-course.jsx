'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button, Dialog, Status } from './ui/primitives';
import MarkdownWorkspace from './markdown-workspace';
import LoginView from './auth/login-view';
import useAuth from '../hooks/use-auth';
import { readCatalog, studyRequest } from '../services/study-library-client';
import { formatReviewTime } from '../services/review-time';

async function computeSha256(text) {
  if (typeof crypto !== 'undefined' && crypto?.subtle) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return null;
}

export default function FrenchCourse({ onLogout, embedded = false }) {
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
      const catalog = await readCatalog('french');
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

  const phases = [
    { phase: 1, title: 'Phần 1: Đặt câu hỏi, Động từ & Mạo từ' },
    { phase: 2, title: 'Phần 2: Danh từ, Đại từ nghi vấn & Phản thân' },
    { phase: 3, title: 'Phần 3: Đại từ, Giới từ & Mệnh đề quan hệ' },
    { phase: 4, title: 'Phần 4: Đánh giá tổng hợp' },
  ];

  return (
    <main className="foundation-page">
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
          <a className="button" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/toeic-600/`}>
            📚 600 từ vựng TOEIC ↗
          </a>
          <Button variant="secondary" onClick={onLogout || logout}>
            Đăng xuất
          </Button>
        </div>
      )}

      <p className="eyebrow">FRANÇAIS A1–A2 · DÀNH RIÊNG CHO YENTR</p>
      <h1>Tiếng Pháp A1–A2</h1>
      <p style={{ marginBottom: '24px', color: 'var(--ink-muted)' }}>
        10 chủ đề ngữ pháp cốt lõi theo Le Nouveau Taxi !, 3 bài ôn tập định kỳ và 1 bài kiểm tra
        cuối khóa kèm quiz tương tác.
      </p>

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
        phases.map(({ phase, title }) => {
          const phaseLessons = lessons.filter((item) => item.phase === phase);
          if (!phaseLessons.length) return null;

          const ordered = [...phaseLessons].sort((a, b) =>
            !a.completedAt
              ? b.completedAt
                ? -1
                : 0
              : !b.completedAt
                ? 1
                : a.completedAt.localeCompare(b.completedAt),
          );

          const completedCount = phaseLessons.filter((l) => l.completedAt).length;

          return (
            <details className="foundation-phase" key={phase} open={true}>
              <summary className="foundation-phase-toggle">
                <span>
                  {title} ({completedCount}/{phaseLessons.length})
                </span>
                <span className="foundation-phase-icon" aria-hidden="true" />
              </summary>
              {ordered.map((item) => (
                <button
                  key={item.id}
                  className="foundation-lesson"
                  type="button"
                  onClick={() => setSelected(item)}
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

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || 'Bài học'}
        wide
      >
        {selected && (
          <MarkdownWorkspace
            foundation={selected}
            onFoundationComplete={(completedAt) => {
              setClock(Date.now());
              setLessons((current) =>
                current.map((item) => (item.id === selected.id ? { ...item, completedAt } : item)),
              );
            }}
          />
        )}
      </Dialog>
    </main>
  );
}
