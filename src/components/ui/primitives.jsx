'use client';
import { useEffect, useId, useRef, useState } from 'react';
export function Button({ variant = 'secondary', className = '', children, ...props }) {
  return (
    <button type="button" className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Dialog({ open, onClose, title, children, footer, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <header className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <Button onClick={onClose} aria-label="Đóng">
          ×
        </Button>
      </header>
      <div className="dialog-content">{children}</div>
      {footer && <footer className="dialog-footer">{footer}</footer>}
    </dialog>
  );
}
export function Status({ children, error = false }) {
  return children ? (
    <p className={`status ${error ? 'status-error' : ''}`} role={error ? 'alert' : 'status'}>
      {children}
    </p>
  ) : null;
}
export function EmptyState({ title = 'Một bộ bài, một bước tiến.', children }) {
  return (
    <div className="empty-state">
      <span className="empty-mark" aria-hidden="true">
        ✳
      </span>
      <h2>{title}</h2>
      <p>{children || 'Chọn bài có sẵn hoặc nhập CSV của bạn để bắt đầu học.'}</p>
    </div>
  );
}
export function Progress({ index, total, suffix }) {
  return (
    <div className="progress-row">
      <span className="badge">{total ? `${index + 1} / ${total}` : 'Chưa có bài'}</span>
      {suffix && <span className="muted">{suffix}</span>}
      <progress max={total || 1} value={total ? index + 1 : 0} aria-label="Tiến độ học" />
    </div>
  );
}
export function RubyText({ text = '' }) {
  const parts = String(text).split(
    /([おご御]?[一-龯々〆ヶ][一-龯ぁ-んァ-ヶー々〆ヶ]*?（[ぁ-んァ-ヶー]+）)/g,
  );
  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^(.*?)（(.*?)）$/);
        return match ? (
          <ruby key={index}>
            {match[1]}
            <rp>（</rp>
            <rt>{match[2]}</rt>
            <rp>）</rp>
          </ruby>
        ) : (
          part
        );
      })}
    </>
  );
}
export function CsvImport({ open, onClose, title, header, onLoad, example }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant="primary"
            onClick={() => {
              try {
                onLoad(text);
                setError('');
                onClose();
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Nạp dữ liệu
          </Button>
        </>
      }
    >
      <p className="muted">Dán CSV có dòng tiêu đề sau:</p>
      <code className="csv-header">{header}</code>
      <label className="field">
        Nội dung CSV
        <textarea
          rows={10}
          value={text}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          placeholder={header}
        />
      </label>
      {example && <Button onClick={() => setText(example)}>Chèn mẫu</Button>}
      <Status error>{error}</Status>
    </Dialog>
  );
}
export function MoreActions({ children, title = 'Tùy chọn' }) {
  return (
    <details className="more-actions">
      <summary>
        {title} <span aria-hidden="true">＋</span>
      </summary>
      <div className="action-wrap">{children}</div>
    </details>
  );
}
export function AudioStatus({ speech }) {
  return (
    <Status error={speech.phase === 'error'}>
      {speech.phase === 'loading'
        ? 'Đang tạo audio…'
        : speech.phase === 'playing'
          ? '♫ Đang phát'
          : speech.error}
    </Status>
  );
}
