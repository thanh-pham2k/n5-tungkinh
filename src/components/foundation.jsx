'use client';
import { useCallback, useEffect, useState } from 'react';
import { Dialog, Status } from './ui/primitives';
import MarkdownWorkspace from './markdown-workspace';
import LoginView from './auth/login-view';
import useAuth from '../hooks/use-auth';
import { readCatalog, studyRequest } from '../services/study-library-client';
import { formatReviewTime } from '../services/review-time';

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
  const [clock, setClock] = useState(0);
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
        catalog.map((item) => {
          const progress = records.find((record) => record.source === item.source.trim())?.progress;
          return {
            ...item,
            completedAt: progress?.foundationCompletedAt || null,
            completionCount:
              progress?.foundationCompletionCount ?? (progress?.foundationCompletedAt ? 1 : 0),
          };
        }),
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
  useEffect(() => {
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
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
      <h1>English Foundation</h1>
      <p>Học cách xây câu và sử dụng tiếng Anh trong đời sống.</p>
      {[
        {
          phase: 1,
          title: 'Build Sentences',
          startModule: 1,
          names: ['Basic Sentence Structure', 'Nouns & Pronouns', 'Be', 'Present Simple'],
        },
        {
          phase: 2,
          title: 'Talk About Life',
          startModule: 5,
          names: [
            'Questions',
            'Present Continuous',
            'Ability & Preference',
            'Past Simple',
            'Future',
            'Modal Basics',
          ],
        },
        {
          phase: 3,
          title: 'Expand Ideas',
          startModule: 11,
          names: [
            'Adjectives & Adverbs',
            'Prepositions',
            'Countable / Uncountable',
            'Comparisons',
            'Linking Ideas',
            'Present Perfect',
            'Basic Complex Sentences',
          ],
        },
        {
          phase: 4,
          title: 'Use English',
          startModule: 18,
          names: [
            'Vocabulary System',
            'Pronunciation Foundation',
            'Listening Foundation',
            'Reading Foundation',
            'Writing Foundation',
            'Speaking Foundation',
            'Foundation Review',
          ],
        },
      ].map(({ phase, title, startModule, names }) => (
        <details className="foundation-phase" key={phase}>
          <summary className="foundation-phase-toggle">
            <span>
              Phase {phase} — {title}
            </span>
            <span className="foundation-phase-icon" aria-hidden="true" />
          </summary>
          {names.map((name, index) => {
            const module = index + startModule;
            return (
              <section className="foundation-module" key={module}>
                <p className="eyebrow">MODULE {module}</p>
                <h3>{name}</h3>
                {busy && <Status>Đang tải bài học…</Status>}
                <Status error>{error}</Status>
                {error && (
                  <button className="button" onClick={load}>
                    Thử lại
                  </button>
                )}
                {ordered
                  .filter((item) => (item.phase || 1) === phase && (item.module || 1) === module)
                  .map((item) => (
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
                          {item.completedAt && !Number.isNaN(Date.parse(item.completedAt)) && (
                            <time className="foundation-completed-time" dateTime={item.completedAt}>
                              {formatReviewTime(item.completedAt, clock)}
                            </time>
                          )}
                          {item.completedAt && <span>Đã làm {item.completionCount} lần</span>}
                        </span>
                      </span>
                      <span className="foundation-lesson-arrow" aria-hidden="true">
                        ↗
                      </span>
                    </button>
                  ))}
              </section>
            );
          })}
        </details>
      ))}
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || 'Bài học'}
        wide
      >
        {selected && (
          <MarkdownWorkspace
            foundation={selected}
            repeatCompletion
            onFoundationComplete={(completedAt, completionCount) => {
              setClock(Date.now());
              setLessons((current) =>
                current.map((item) =>
                  item.id === selected.id ? { ...item, completedAt, completionCount } : item,
                ),
              );
            }}
          />
        )}
      </Dialog>
    </main>
  );
}
