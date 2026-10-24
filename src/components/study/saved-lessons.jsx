'use client';
import { useState } from 'react';
import { Button, Status } from '../ui/primitives';
import { listLessons, readLesson } from '../../services/study-library-client';
export default function SavedLessons({ tool, onLoad, revision = '' }) {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState([]),
    [cursor, setCursor] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function loadPage(next) {
    setBusy(true);
    setError('');
    try {
      const result = await listLessons(tool, next);
      setItems((old) => (next ? [...old, ...result.data] : result.data));
      setCursor(result.page.nextCursor);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function select(id) {
    setBusy(true);
    setError('');
    try {
      await onLoad(await readLesson(id));
      setOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="saved-lessons" data-revision={revision}>
      <Button
        aria-expanded={open}
        disabled={busy}
        onClick={() => {
          setOpen(!open);
          if (!open) loadPage();
        }}
      >
        ▤ Bài đã lưu
      </Button>
      {open && (
        <section className="saved-lessons-list" aria-label="Bài đã lưu trên Turso">
          <p className="helper">Nội dung tải từ Turso. Chọn một bài để ôn tập lại.</p>
          <Status error>{error}</Status>
          {busy && <Status>Đang tải bài…</Status>}
          {!busy && !error && !items.length && <Status>Chưa có bài đã lưu trong mục này.</Status>}
          {items.map((item) => (
            <Button key={item.id} disabled={busy} onClick={() => select(item.id)}>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.itemCount} mục · {item.studyCount} lượt học ·{' '}
                  {new Date(item.lastStudiedAt).toLocaleString('vi-VN')}
                </small>
              </span>
              <span aria-hidden="true">↗</span>
            </Button>
          ))}
          {cursor && (
            <Button disabled={busy} onClick={() => loadPage(cursor)}>
              Tải thêm bài
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
