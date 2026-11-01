'use client';
import { useCallback, useEffect, useState } from 'react';
import { Dialog, Status } from './ui/primitives';
import MarkdownWorkspace from './markdown-workspace';
import LoginView from './auth/login-view';
import useAuth from '../hooks/use-auth';
import { readCatalog, studyRequest } from '../services/study-library-client';

function normalizeCatalog(catalog) {
  if (typeof catalog === 'string') {
    return [
      { id: 'lesson-01', title: 'The Complete Sentence', label: 'Lesson 1', source: catalog },
    ];
  }
  if (
    !Array.isArray(catalog) ||
    catalog.some((item) => !item.id || !item.title || !item.label || !item.source)
  ) {
    throw new Error('Danh mục English Foundation không hợp lệ.');
  }
  return catalog;
}

export default function Foundation() {
  const { user, loading, setUser } = useAuth();
  const [selected, setSelected] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const catalog = normalizeCatalog(await readCatalog('english-foundation'));
      const titles = catalog.map((item) =>
        item.source.split('\n')[0].replace(/\s+/g, ' ').slice(0, 100),
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
        const matching = listing.data.filter((item) =>
          titles.some((title) => item.title.startsWith(title)),
        );
        records.push(
          ...(await Promise.all(
            matching.map(async (item) => (await studyRequest(`/study-contents/${item.id}`)).data),
          )),
        );
        cursor = listing.meta.page.nextCursor;
      } while (cursor);
      setLessons(
        catalog.map((item) => ({
          ...item,
          completedAt:
            records.find((record) => record.source === item.source)?.progress
              .foundationCompletedAt || null,
        })),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (user) load();
  }, [user, load]);
  const ordered = [...lessons].sort((a, b) => {
    if (!a.completedAt) return b.completedAt ? -1 : 0;
    if (!b.completedAt) return 1;
    return a.completedAt.localeCompare(b.completedAt);
  });
  if (loading) return <Status>Đang kiểm tra phiên đăng nhập…</Status>;
  if (!user) return <LoginView onLoginSuccess={setUser} />;
  return (
    <main className="foundation-page">
      <a className="button" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`}>
        ← Công cụ học
      </a>
      <p className="eyebrow">ENGLISH FOUNDATION</p>
      <h1>Build Sentences</h1>
      <p>Phase 1 · Học cách xây dựng câu tiếng Anh cơ bản.</p>
      <section className="foundation-module">
        <p className="eyebrow">MODULE 1</p>
        <h2>Basic Sentence Structure</h2>
        {busy && <Status>Đang tải bài học…</Status>}
        <Status error>{error}</Status>
        {error && (
          <button className="button" onClick={load}>
            Thử lại
          </button>
        )}
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
                title={item.completedAt ? 'Đã hoàn thành' : 'Chưa hoàn thành'}
              >
                {item.completedAt && <span aria-hidden="true">✓</span>}
              </span>
              <span>
                <strong>{item.label}</strong>
                <br />
                {item.title}
              </span>
            </span>
            <span className="foundation-lesson-arrow" aria-hidden="true">
              ↗
            </span>
          </button>
        ))}
      </section>
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || 'Bài học'}
        wide
      >
        {selected && <MarkdownWorkspace foundation={selected} onFoundationComplete={load} />}
      </Dialog>
    </main>
  );
}
