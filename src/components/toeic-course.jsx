'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button, Dialog, Status } from './ui/primitives';
import MarkdownWorkspace from './markdown-workspace';
import LoginView from './auth/login-view';
import useAuth from '../hooks/use-auth';
import { studyRequest } from '../services/study-library-client';
import { formatReviewTime } from '../services/review-time';

export default function ToeicCourse({ onLogout }) {
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
      const titles = [
        'Contracts — Hợp đồng',
        'Marketing — Tiếp thị',
        'Warranties — Bảo hành',
        'Business Planning — Kế hoạch kinh doanh',
        'Conferences — Hội nghị',
        'Computers — Máy tính',
        'Office Technology — Công nghệ văn phòng',
        'Office Procedures — Thủ tục văn phòng',
        'Electronics — Điện tử',
        'Correspondence — Thư tín',
      ];
      let cursor;
      const matches = [];
      do {
        const query = new URLSearchParams({
          tool: 'markdown',
          limit: '100',
          ...(cursor ? { cursor } : {}),
        });
        const listing = await studyRequest(`/study-contents?${query}`);
        matches.push(
          ...listing.data.filter((item) =>
            titles.some((title) => item.title.startsWith(`# ${title}`)),
          ),
        );
        cursor = listing.meta.page.nextCursor;
      } while (cursor);
      const records = await Promise.all(
        matches.map(async (item) => (await studyRequest(`/study-contents/${item.id}`)).data),
      );
      setLessons(
        titles.flatMap((title, index) => {
          const record = records.find(
            (item) =>
              item.source.split('\n')[0] === `# ${title}` &&
              !item.source.includes('**Các lỗi quan trọng đã chỉnh:**'),
          );
          return record
            ? [
                {
                  ...record,
                  title,
                  label: `Nhóm ${index + 1}`,
                  completedAt: record.progress?.foundationCompletedAt || null,
                },
              ]
            : [];
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
          ← Công cụ học
        </a>
      </main>
    );
  const ordered = [...lessons].sort((a, b) =>
    !a.completedAt
      ? b.completedAt
        ? -1
        : 0
      : !b.completedAt
        ? 1
        : a.completedAt.localeCompare(b.completedAt),
  );
  return (
    <main className="foundation-page">
      <Button variant="secondary" onClick={onLogout || logout}>
        Đăng xuất
      </Button>
      <p className="eyebrow">TOEIC</p>
      <h1>600 từ vựng TOEIC</h1>
      {busy && <Status>Đang tải bài học…</Status>}
      {error && (
        <>
          <Status error>{error}</Status>
          <button className="button" onClick={load}>
            Thử lại
          </button>
        </>
      )}
      {!busy && !error && !ordered.length && <Status>Chưa có bài học.</Status>}
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
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || 'Bài học'}
        wide
      >
        {selected && (
          <MarkdownWorkspace
            foundation={{ ...selected, vocabularyAudio: true }}
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
