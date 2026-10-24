'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Status } from '../ui/primitives';
const HEADER =
  'group_id,group_title,lesson,question_no,question_jp,meaning_vi,option_a,option_b,option_c,option_d';
export default function HotReview({ settings, active, setFocus }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const settingsRef = useRef(settings);
  settingsRef.current = { ...settings, active };
  useEffect(() => {
    document.dispatchEvent(new Event('study-audio-settings'));
  }, [settings, active]);
  useEffect(() => {
    let disposed = false,
      cleanup;
    import('./hot-review-controller')
      .then(({ initializeHotReview }) => {
        if (disposed) return;
        cleanup = initializeHotReview(() => settingsRef.current);
        setLoaded(true);
      })
      .catch(() => {
        if (!disposed)
          setError('Không tải được Hot Review. Hãy kiểm tra kết nối và tải lại trang.');
      });
    const ready = () => setFocus(true);
    document.addEventListener('exercise-ready', ready);
    return () => {
      disposed = true;
      cleanup?.();
      document.removeEventListener('exercise-ready', ready);
    };
  }, [setFocus]);
  return (
    <div className="study-panel hot-review">
      {!loaded && !error && <Status>Đang mở Hot Review…</Status>}
      <Status error>{error}</Status>
      <div id="hot-review-quiz">
        <div id="hot-review-content" />
      </div>
      <dialog
        className="dialog hot-dialog"
        id="hot-review-dialog"
        aria-labelledby="hot-review-dialog-title"
      >
        <div className="dialog-header">
          <h2 id="hot-review-dialog-title">Nhập dữ liệu Hot Review</h2>
        </div>
        <div className="dialog-content">
          <p className="muted">Dán câu hỏi CSV theo định dạng:</p>
          <code className="csv-header">{HEADER}</code>
          <label className="field">
            Nội dung CSV
            <textarea id="hot-review-input" rows={12} spellCheck={false} placeholder={HEADER} />
          </label>
          <p className="status-error" id="hot-review-error" role="alert" />
        </div>
        <div className="dialog-footer">
          <Button id="hot-review-cancel">Hủy</Button>
          <Button id="hot-review-clear" variant="danger">
            Xóa dữ liệu
          </Button>
          <Button id="hot-review-create" variant="primary">
            Tạo bài
          </Button>
        </div>
      </dialog>
      <dialog
        className="dialog hot-dialog"
        id="answer-import-dialog"
        aria-labelledby="answer-import-dialog-title"
      >
        <div className="dialog-header">
          <h2 id="answer-import-dialog-title">Nhập đáp án & giải thích</h2>
        </div>
        <div className="dialog-content">
          <p className="muted">
            Đáp án được ghép theo thứ tự câu sau khi sắp số câu; giữ định dạng CSV cũ.
          </p>
          <label className="field">
            CSV đáp án
            <textarea
              id="answer-import-input"
              rows={12}
              spellCheck={false}
              placeholder="id,selected_answer,correct_answer,answer_detail_vi,option_a_vi,option_b_vi,option_c_vi,option_d_vi,vocab_kanji,grammar,show_answer"
            />
          </label>
          <p className="status-error" id="answer-import-error" role="alert" />
        </div>
        <div className="dialog-footer">
          <Button id="answer-import-cancel">Đóng</Button>
          <Button id="answer-import-clear" variant="danger">
            Xóa đáp án
          </Button>
          <Button id="answer-import-apply" variant="primary">
            Áp dụng
          </Button>
        </div>
      </dialog>
    </div>
  );
}
