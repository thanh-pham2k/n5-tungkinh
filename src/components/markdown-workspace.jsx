'use client';
import { useEffect, useRef, useState } from 'react';
import useStudyLibrary from '../hooks/use-study-library';
import useAuth from '../hooks/use-auth';
import LoginView from './auth/login-view';
import SavedLessons from './study/saved-lessons';
import {
  listStudyLogs,
  readStudyLog,
  readCatalog,
  studyRequest,
  createLesson,
} from '../services/study-library-client';
import { Button, Status } from './ui/primitives';
import { formatReviewTime } from '../services/review-time';
export default function MarkdownWorkspace() {
  const { user, loading: authLoading, logout, setUser } = useAuth();
  const [error, setError] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [course, setCourse] = useState([]);
  const [courseList, setCourseList] = useState(false);
  const [courseStart, setCourseStart] = useState(1);
  const [reviewTimes, setReviewTimes] = useState({});
  const [clock, setClock] = useState(0);
  const library = useStudyLibrary('markdown');
  const libraryRef = useRef(library);
  const courseSourceRef = useRef(null);
  libraryRef.current = library;

  useEffect(() => {
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && focusMode) {
        if (course.length) window.location.href = '?course=list';
        else setFocusMode(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusMode, course.length]);
  useEffect(() => {
    if (!user) return;
    let disposed = false,
      cleanup,
      activeCourse = null,
      courseAnchor = null;
    Promise.all([
      import('marked'),
      import('dompurify'),
      import('mermaid'),
      import('../services/lesson-parser.cjs'),
      import('./markdown-controller'),
    ])
      .then(([marked, purify, mermaid, parser, controller]) => {
        if (disposed) return;
        cleanup = controller.initializeMarkdown({
          marked: marked.marked,
          DOMPurify: purify.default,
          mermaid: mermaid.default,
          LessonParser: parser.default || parser,
          saveSource: (source) => {
            if (source !== courseSourceRef.current) courseSourceRef.current = null;
            return libraryRef.current.save(source, 'en');
          },
          loadExample: () => readCatalog('markdown-example'),
          saveProgress: (patch) =>
            courseSourceRef.current === null
              ? libraryRef.current.updateProgress(patch)
              : Promise.resolve(),
          onDeckComplete: () => {
            if (!activeCourse || courseSourceRef.current !== activeCourse.source) return;
            const nextDay = (activeCourse.day % activeCourse.count) + 1;
            if (!courseAnchor) return;
            const reviewedAt = new Date().toISOString();
            const reviewTimes = {
              ...(courseAnchor.progress.courseReviewTimes || {}),
              [activeCourse.day]: reviewedAt,
            };
            const progress = {
              ...courseAnchor.progress,
              courseNextDay: nextDay,
              courseReviewTimes: reviewTimes,
            };
            studyRequest(`/study-contents/${courseAnchor.id}/progress`, {
              method: 'PUT',
              body: JSON.stringify({ version: courseAnchor.version, progress }),
            })
              .then(({ data }) => {
                courseAnchor = { ...courseAnchor, progress: data.progress, version: data.version };
                if (!disposed) {
                  setCourseStart(nextDay);
                  setReviewTimes(data.progress.courseReviewTimes || {});
                  setClock(Date.now());
                }
              })
              .catch((error) => {
                if (!disposed) setError(error.message);
              });
          },
        });
        const loadingEl = document.getElementById('markdown-loading');
        if (loadingEl) loadingEl.hidden = true;
        // Accept a single import only from the window that opened this workspace.
        const params = new URLSearchParams(window.location.hash.slice(1));
        const nonce = params.get('psa-import');
        const parentOrigin = params.get('origin');
        const directSource = params.get('psa-content');
        if (directSource?.trim()) {
          const source = document.getElementById('lesson-source');
          if (source) {
            courseSourceRef.current = null;
            source.value = directSource;
            setFocusMode(true);
            source.dispatchEvent(new Event('input', { bubbles: true }));
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }
        if (nonce && parentOrigin && window.opener) {
          const opener = window.opener;
          const replyOrigin = parentOrigin === 'null' ? '*' : parentOrigin;
          const receiveImport = (event) => {
            if (event.source !== opener || event.origin !== parentOrigin ||
                event.data?.type !== 'psa-markdown-import' || event.data?.nonce !== nonce ||
                typeof event.data.source !== 'string' || !event.data.source.trim()) return;
            window.removeEventListener('message', receiveImport);
            const source = document.getElementById('lesson-source');
            if (!source) return;
            courseSourceRef.current = null;
            source.value = event.data.source;
            source.dispatchEvent(new Event('input', { bubbles: true }));
            opener.postMessage({ type: 'kotoba-import-received', nonce }, replyOrigin);
            history.replaceState(null, '', window.location.pathname + window.location.search);
          };
          window.addEventListener('message', receiveImport);
          const previousCleanup = cleanup;
          cleanup = () => { window.removeEventListener('message', receiveImport); previousCleanup?.(); };
          opener.postMessage({ type: 'kotoba-import-ready', nonce }, replyOrigin);
        }

        // One-time upgrade of the old local draft. Never delete it before DB acknowledgement.
        let legacy;
        try {
          legacy = JSON.parse(localStorage.getItem('markdown-lesson-v1') || 'null')?.source;
        } catch {}
        const upgraded =
          typeof legacy === 'string' && legacy.trim()
            ? libraryRef.current.save(legacy, 'en').then(() => {
                localStorage.removeItem('markdown-lesson-v1');
              })
            : Promise.resolve();
        const requestedDay = new URLSearchParams(window.location.search).get('course');
        if (requestedDay) {
          readCatalog('work-english-30')
            .then(async (items) => {
              if (disposed) return;
              const item =
                requestedDay === 'list'
                  ? items[0]
                  : items.find((entry) => String(entry.day) === requestedDay);
              if (!item) throw new Error('Không tìm thấy bài học này.');
              const record = await libraryRef.current.save(item.source, 'en');
              if (item.day === 1) courseAnchor = record;
              else {
                let cursor;
                do {
                  const query = new URLSearchParams({
                    tool: 'markdown',
                    limit: '100',
                    ...(cursor ? { cursor } : {}),
                  });
                  const listing = await studyRequest(`/study-contents?${query}`);
                  for (const summary of listing.data.filter((entry) =>
                    entry.title.startsWith('# Ngày 1:'),
                  )) {
                    const candidate = (await studyRequest(`/study-contents/${summary.id}`)).data;
                    if (candidate.source === items[0].source) {
                      courseAnchor = candidate;
                      break;
                    }
                  }
                  cursor = courseAnchor ? null : listing.meta.page.nextCursor;
                } while (cursor);
                if (!courseAnchor)
                  courseAnchor = await createLesson({
                    tool: 'markdown',
                    source: items[0].source,
                    language: 'en',
                    requestId: crypto.randomUUID(),
                  });
              }
              if (!disposed) {
                setCourse(items);
                courseSourceRef.current = item.source;
                activeCourse = { day: item.day, count: items.length, source: item.source };
                setCourseList(requestedDay === 'list');
                setFocusMode(requestedDay !== 'list');
                setReviewTimes(courseAnchor.progress?.courseReviewTimes || {});
                const nextDay = courseAnchor.progress?.courseNextDay;
                setCourseStart(
                  Number.isInteger(nextDay) && nextDay >= 1 && nextDay <= items.length
                    ? nextDay
                    : item.day,
                );
                document.dispatchEvent(
                  new CustomEvent('study-markdown-load', { detail: { ...record, progress: {} } }),
                );
              }
            })
            .catch((error) => {
              if (!disposed) {
                setError(error.message);
              }
            });
        }
        upgraded
          .then(() => (requestedDay ? { data: [] } : listStudyLogs('markdown')))
          .then(async ({ data }) => {
            if (!data.length || disposed) return;
            const record = await readStudyLog(data[0].id);
            if (disposed || document.getElementById('lesson-source')?.value.trim()) return;
            libraryRef.current.restore(record);
            document.dispatchEvent(new CustomEvent('study-markdown-load', { detail: record }));
          })
          .catch((error) => {
            if (!disposed) setError(error.message);
          });
      })
      .catch(() => {
        if (!disposed) {
          const loadingEl = document.getElementById('markdown-loading');
          if (loadingEl) loadingEl.hidden = true;
          setError('Không tải được workspace. Hãy kiểm tra kết nối và tải lại trang.');
        }
      });
    return () => {
      disposed = true;
      cleanup?.();
      document.body.classList.remove('dark', 'resizing');
    };
  }, [user]);

  if (authLoading) {
    return (
      <div className="login-screen">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <Status>Đang kiểm tra phiên đăng nhập…</Status>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoginSuccess={setUser} />;
  }

  return (
    <div
      className={`markdown-page ${focusMode ? 'reading-focus' : ''} ${courseList ? 'course-list-open' : ''}`}
    >
      {courseList && (
        <main className="course-list" aria-labelledby="course-list-title">
          <a className="button" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`}>
            ← Công cụ học
          </a>
          <h1 id="course-list-title">Tiếng Anh công việc · 30 ngày</h1>
          <p>Chọn bài để đọc và luyện tập.</p>
          <ol>
            {[...course.slice(courseStart - 1), ...course.slice(0, courseStart - 1)].map((item) => (
              <li key={item.day}>
                <a href={`?course=${item.day}`}>
                  <strong>
                    Ngày {item.day}: {item.title}
                  </strong>
                  <span>{formatReviewTime(reviewTimes[item.day], clock)}</span>
                </a>
              </li>
            ))}
          </ol>
        </main>
      )}
      {focusMode && (
        <button
          type="button"
          className="exit-focus-btn button"
          onClick={() => {
            if (course.length) window.location.href = '?course=list';
            else setFocusMode(false);
          }}
          title="Thoát chế độ đọc tập trung (Esc)"
          aria-label="Thoát chế độ đọc tập trung"
        >
          {course.length ? '← Danh sách bài học' : '✕ Thoát đọc tập trung'}
        </button>
      )}
      <header className="preview-toolbar">
        <a
          className="button"
          href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`}
          aria-label="Về công cụ học"
        >
          ←
        </a>
        <strong>
          Markdown <span>& Quiz</span>
        </strong>
        <span className="user-chip" title={`Tài khoản: ${user.name}`}>
          <span aria-hidden="true">👤</span> {user.name}
        </span>
        <Button className="button-logout" onClick={logout} aria-label="Đăng xuất">
          Đăng xuất
        </Button>
        <Button
          id="lesson-focus"
          onClick={() => setFocusMode(true)}
          title="Ẩn header và editor để tập trung đọc bài (Esc để thoát)"
        >
          📖 Đọc tập trung
        </Button>
        <SavedLessons
          tool="markdown"
          onLoad={(record) => {
            courseSourceRef.current = course.some((item) => item.source === record.source)
              ? record.source
              : null;
            library.restore(record);
            document.dispatchEvent(
              new CustomEvent('study-markdown-load', {
                detail: courseSourceRef.current === null ? record : { ...record, progress: {} },
              }),
            );
          }}
        />
        {course.length > 0 && (
          <label className="check-field">
            Bài học
            <select
              aria-label="Chọn ngày học"
              value={
                new URLSearchParams(
                  typeof window === 'undefined' ? '' : window.location.search,
                ).get('course') || ''
              }
              onChange={(event) => {
                window.location.href = `?course=${event.target.value}`;
              }}
            >
              {[...course.slice(courseStart - 1), ...course.slice(0, courseStart - 1)].map(
                (item) => (
                  <option key={item.day} value={item.day}>
                    Ngày {item.day}: {item.title} · {formatReviewTime(reviewTimes[item.day], clock)}
                  </option>
                ),
              )}
            </select>
          </label>
        )}
        {course.length > 0 && (
          <a className="button" href="?course=list">
            Danh sách bài học
          </a>
        )}
        <Button id="lesson-edit">Nhập Markdown</Button>
        <Button
          id="lesson-menu-toggle"
          aria-label="Công cụ Markdown"
          aria-expanded="false"
          aria-controls="lesson-toolbar-actions"
        >
          ⋯
        </Button>
        <div id="lesson-toolbar-actions">
          <Button id="lesson-open">Mở file</Button>
          <input
            id="lesson-file"
            type="file"
            accept=".md,.markdown,.txt,text/plain,text/markdown"
            hidden
          />
          <Button id="lesson-copy">Copy Markdown</Button>
          <Button id="lesson-pdf">Xuất PDF</Button>
          <Button id="lesson-reset">Reset</Button>
          <Button id="lesson-example">Bài mẫu</Button>
          <label className="check-field">
            <input id="lesson-sync" type="checkbox" defaultChecked />
            Sync scroll
          </label>
          <label className="check-field">
            <input id="lesson-dark" type="checkbox" />
            Dark mode
          </label>
        </div>
        <span id="lesson-status" role="status" />
      </header>
      <Status error>{error || library.error}</Status>
      <div id="markdown-loading">
        <Status>Đang mở workspace…</Status>
      </div>
      <Status error>{error}</Status>
      <main className="preview-workspace">
        <section className="source-pane" aria-label="Markdown editor">
          <div className="pane-heading">MARKDOWN</div>
          <textarea
            id="lesson-source"
            spellCheck={false}
            aria-label="Nội dung Markdown"
            placeholder="Dán Markdown tại đây…"
          />
        </section>
        <div
          id="preview-divider"
          role="separator"
          aria-label="Độ rộng editor"
          aria-orientation="vertical"
          aria-valuemin={15}
          aria-valuemax={85}
          aria-valuenow={50}
          tabIndex={0}
        />
        <section className="preview-pane" aria-label="Live preview">
          <div className="pane-heading">PREVIEW</div>
          <div id="lesson-preview-scroll">
            <article id="lesson-output" aria-label="Bài học" />
          </div>
        </section>
      </main>
      <dialog id="lesson-editor-dialog" className="dialog" aria-labelledby="lesson-editor-title">
        <form method="dialog" className="mobile-editor-form">
          <div className="dialog-header">
            <h2 id="lesson-editor-title">Nhập Markdown</h2>
          </div>
          <div className="dialog-content">
            <label className="field">
              Nội dung bài học
              <textarea
                id="lesson-mobile-source"
                spellCheck={false}
                placeholder="Dán Markdown, Mermaid và quiz tại đây…"
              />
            </label>
          </div>
          <div className="dialog-footer">
            <Button id="lesson-editor-clear">Xóa nội dung</Button>
            <button className="button" value="cancel" type="submit">
              Hủy
            </button>
            <button className="button button-primary" value="apply" type="submit">
              Xem preview
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
