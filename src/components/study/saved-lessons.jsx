'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Status } from '../ui/primitives';
import { listStudyLogs, readStudyLog, removeStudyLog } from '../../services/study-library-client';
export default function SavedLessons({ tool, onLoad, revision = '' }) {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState([]),
    [cursor, setCursor] = useState(null),
    [busy, setBusy] = useState(false),
    [confirmingId, setConfirmingId] = useState(null),
    [error, setError] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKey(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);
  async function loadPage(next) {
    setBusy(true);
    setError('');
    try {
      const result = await listStudyLogs(tool, next);
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
      await onLoad(await readStudyLog(id));
      setOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id) {
    setBusy(true);
    setError('');
    try {
      await removeStudyLog(id);
      setItems((old) => old.filter((item) => item.id !== id));
      setConfirmingId(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="saved-lessons" data-revision={revision} ref={rootRef}>
      <Button
        aria-expanded={open}
        disabled={busy}
        onClick={() => {
          setOpen(!open);
          if (!open) loadPage();
        }}
      >
        ▤ Lịch sử nhập
      </Button>
      {open && (
        <section className="saved-lessons-list" aria-label="Lịch sử nhập bài">
          <p className="helper">Chọn một mục để tải nguồn và parse lại.</p>
          <Status error>{error}</Status>
          {busy && <Status>Đang tải bài…</Status>}
          {!busy && !error && !items.length && <Status>Chưa có log trong mục này.</Status>}
          {items.map((item) => (
            <article className="saved-lesson" key={item.id}>
              <div className="saved-lesson-actions">
                <Button disabled={busy} onClick={() => select(item.id)}>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.itemCount} mục · Nhập lúc{' '}
                      {new Date(item.createdAt).toLocaleString('vi-VN')}
                    </small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </Button>
                <Button
                  variant="danger"
                  disabled={busy}
                  aria-label={`Xóa log ${item.title}`}
                  onClick={() => {
                    setError('');
                    setConfirmingId(confirmingId === item.id ? null : item.id);
                  }}
                >
                  Xóa
                </Button>
              </div>
              {confirmingId === item.id && (
                <div
                  className="saved-lesson-confirm"
                  role="group"
                  aria-label={`Xác nhận xóa ${item.title}`}
                >
                  <p>
                    Xóa mục log này khỏi lịch sử nhập? Bài đang mở và tiến độ học sẽ được giữ lại.
                  </p>
                  <div className="action-wrap">
                    <Button disabled={busy} onClick={() => setConfirmingId(null)}>
                      Hủy
                    </Button>
                    <Button variant="danger" disabled={busy} onClick={() => remove(item.id)}>
                      {busy ? 'Đang xóa…' : 'Xóa log'}
                    </Button>
                  </div>
                </div>
              )}
            </article>
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
