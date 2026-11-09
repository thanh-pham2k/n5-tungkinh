'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button, Status } from './ui/primitives';
import MarkdownWorkspace from './markdown-workspace';
import { readCatalog, studyRequest } from '../services/study-library-client';
import useAuth from '../hooks/use-auth';
import LoginView from './auth/login-view';
import { formatReviewTime } from '../services/review-time';

export default function ReadingPractice() {
  const { user, loading, setUser } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(0);
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const catalog = await readCatalog('reading-practice');
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
      const items = await Promise.all(
        catalog.map(async (item) => {
          const bytes = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(item.source.trim()),
          );
          const hash = Array.from(new Uint8Array(bytes), (b) =>
            b.toString(16).padStart(2, '0'),
          ).join('');
          const progress = records.find((record) => record.sourceHash === hash)?.progress;
          return { ...item, completedAt: progress?.foundationCompletedAt || null };
        }),
      );
      setLessons(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (user?.username === 'thanhpv') load();
  }, [user, load]);
  useEffect(() => {
    setClock(Date.now());
    const id = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  if (loading) return <Status>Đang kiểm tra phiên đăng nhập…</Status>;
  if (!user) return <LoginView onLoginSuccess={setUser} />;
  if (user.username !== 'thanhpv') return <Status error>Bạn không có quyền xem mục này.</Status>;
  return (
    <>
      {selected && (
        <div className="foundation-page course-reading">
          <Button
            onClick={() => {
              setSelected(null);
              window.scrollTo({ top: 0, behavior: 'instant' });
            }}
          >
            ← Danh sách bài học
          </Button>
          <h2 className="course-reading-title">{selected.title}</h2>
          <MarkdownWorkspace
            foundation={selected}
            repeatCompletion
            onFoundationComplete={(completedAt) => {
              setClock(Date.now());
              setLessons((current) =>
                current.map((item) => (item.id === selected.id ? { ...item, completedAt } : item)),
              );
            }}
          />
        </div>
      )}
      <div className="foundation-page" hidden={!!selected}>
        <p className="eyebrow">IELTS READING · BAND 5.0–6.0</p>
        <h1>Reading Practice</h1>
        <p>10 chủ đề, 50 bài đọc và 10 bài ôn tập theo tuần.</p>
        {busy && <Status>Đang tải bài học…</Status>}
        {error && (
          <>
            <Status error>{error}</Status>
            <Button onClick={load}>Thử lại</Button>
          </>
        )}
        {!busy &&
          !error &&
          Array.from({ length: 10 }, (_, index) => {
            const items = lessons.filter((item) => item.week === index + 1);
            return (
              <details className="foundation-phase" key={index}>
                <summary className="foundation-phase-toggle">
                  <span>{items[0]?.weekTitle}</span>
                  <span className="foundation-phase-icon" aria-hidden="true" />
                </summary>
                {items.map((item) => (
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
      </div>
    </>
  );
}
