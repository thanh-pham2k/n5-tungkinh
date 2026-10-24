'use client';
import { useEffect, useRef, useState } from 'react';
import useStudyLibrary from '../hooks/use-study-library';
import SavedLessons from './study/saved-lessons';
import { listStudyLogs, readStudyLog, readCatalog } from '../services/study-library-client';
import { Button, Status } from './ui/primitives';
export default function MarkdownWorkspace() {
  const [error, setError] = useState('');
  const library = useStudyLibrary('markdown');
  const libraryRef = useRef(library);
  libraryRef.current = library;
  useEffect(() => {
    let disposed = false,
      cleanup;
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
          saveSource: (source) => libraryRef.current.save(source, 'en'),
          loadExample: () => readCatalog('markdown-example'),
          saveProgress: (patch) => libraryRef.current.updateProgress(patch),
        });
        document.getElementById('markdown-loading').hidden = true;
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
        upgraded
          .then(() => listStudyLogs('markdown'))
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
          document.getElementById('markdown-loading').hidden = true;
          setError('Không tải được workspace. Hãy kiểm tra kết nối và tải lại trang.');
        }
      });
    return () => {
      disposed = true;
      cleanup?.();
      document.body.classList.remove('dark', 'resizing');
    };
  }, []);
  return (
    <div className="markdown-page">
      <SavedLessons
        tool="markdown"
        onLoad={(record) => {
          library.restore(record);
          document.dispatchEvent(new CustomEvent('study-markdown-load', { detail: record }));
        }}
      />
      <Status error>{error || library.error}</Status>
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
