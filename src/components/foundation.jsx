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

async function computeSha256(text) {
  if (typeof crypto !== 'undefined' && crypto?.subtle) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return null;
}

export default function Foundation({ eviu = false }) {
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
      const catalog = normalizeCatalog(await readCatalog(eviu ? 'eviu' : 'english-foundation'));
      const catalogWithHash = await Promise.all(
        catalog.map(async (item) => {
          const hash = await computeSha256(item.source.trim());
          const title = item.source.split('\n')[0].replace(/\s+/g, ' ').slice(0, 100);
          return { ...item, hash, prefix: title };
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
            (!eviu &&
              records.find(
                (record) => record.title && item.prefix && record.title.startsWith(item.prefix),
              ));
          const progress = match?.progress;
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
  }, [eviu]);
  useEffect(() => {
    if (user && (!eviu || user.username === 'thanhpv')) load();
  }, [user, load, eviu]);
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
  const latest = lessons.reduce((current, item) => {
    const time = Date.parse(item.completedAt);
    return Number.isNaN(time) || (current && time <= Date.parse(current.completedAt))
      ? current
      : item;
  }, null);
  if (loading) return <Status>Đang kiểm tra phiên đăng nhập…</Status>;
  if (!user) return <LoginView onLoginSuccess={setUser} />;
  if (eviu && user.username !== 'thanhpv')
    return <Status error>Bạn không có quyền xem mục này.</Status>;
  return (
    <main className="foundation-page">
      <a className="button" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`}>
        ← Công cụ học
      </a>
      <p className="eyebrow">{eviu ? 'EVIU' : 'ENGLISH FOUNDATION'}</p>
      <h1>{eviu ? 'English Vocab In Use' : 'English Foundation'}</h1>
      <p>
        {eviu
          ? 'Học và ôn từ vựng theo lộ trình 41 unit.'
          : 'Học cách xây câu và sử dụng tiếng Anh trong đời sống.'}
      </p>
      {(eviu
        ? [{ phase: 1, title: 'EVIU', startModule: 1, names: ['41 unit'] }]
        : [
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
          ]
      ).map(({ phase, title, startModule, names }) => (
        <details className="foundation-phase" key={phase}>
          <summary className="foundation-phase-toggle">
            <span>
              <span>
                Phase {phase} — {title}
              </span>
              {(latest?.phase || 1) === phase && latest && (
                <span className="foundation-latest">Bài gần nhất</span>
              )}
            </span>
            <span className="foundation-phase-icon" aria-hidden="true" />
          </summary>
          {names.map((name, index) => {
            const module = index + startModule;
            return (
              <details className="foundation-module" key={module}>
                <summary className="foundation-module-toggle">
                  <span>
                    <span className="eyebrow">MODULE {module}</span>
                    <span className="foundation-module-name">{name}</span>
                    {latest && (latest.phase || 1) === phase && (latest.module || 1) === module && (
                      <span className="foundation-latest">Bài gần nhất</span>
                    )}
                  </span>
                  <span className="foundation-phase-icon" aria-hidden="true" />
                </summary>
                <div className="foundation-module-content">
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
                        className={`foundation-lesson ${latest?.id === item.id ? 'is-latest' : ''}`}
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
                            {latest?.id === item.id && (
                              <span className="foundation-latest">Bài gần nhất</span>
                            )}
                            {item.completedAt && !Number.isNaN(Date.parse(item.completedAt)) && (
                              <time
                                className="foundation-completed-time"
                                dateTime={item.completedAt}
                              >
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
                </div>
              </details>
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
