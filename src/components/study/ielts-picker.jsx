'use client';
import { useEffect, useMemo, useState } from 'react';
import usePracticeData from '../../hooks/use-practice-data';
import { parseInstantVocabCsvRows, shuffleVocabReviewCards } from '../../services/csv-service';
import { Button, Dialog, Status } from '../ui/primitives';
export default function IeltsPicker({ open, onClose, mode, onLoad }) {
  const { data, error } = usePracticeData(open);
  const days = data?.[mode] || [];
  const entries = useMemo(
    () =>
      days.flatMap((day, dayIndex) =>
        day.csv
          .split(/\r?\n/)
          .slice(1)
          .filter(Boolean)
          .map((row, index) => ({
            id: `${dayIndex}:${index}`,
            date: day.date,
            topic: day.topic || '',
            level: day.levels?.[index],
            row,
            fields: parseInstantVocabCsvRows(row)[0],
          })),
      ),
    [data, mode],
  );
  const [date, setDate] = useState('');
  const [topic, setTopic] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [count, setCount] = useState(10);
  const [done, setDone] = useState(new Set());
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setTopic('');
    setDate(['writing', 'topic-vocab'].includes(mode) ? days[0]?.date || '' : '');
    setLoadError('');
    try {
      const n = Number(localStorage.getItem(`practice-random-count:${mode}`));
      if (Number.isSafeInteger(n) && n > 0) setCount(n);
      const ids = JSON.parse(sessionStorage.getItem(`practice-ielts-done:${mode}`) || '[]');
      if (Array.isArray(ids)) setDone(new Set(ids));
    } catch {}
  }, [open, mode, data]);
  const visible = entries.filter(
    (entry) => (!date || entry.date === date) && (!topic || entry.topic === topic),
  );
  const toggle = (id) =>
    setSelected((previous) => {
      const next = new Set(previous);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  function start() {
    const chosen = entries.filter((entry) => selected.has(entry.id));
    if (!chosen.length) return;
    try {
      onLoad([days[0].csv.split(/\r?\n/)[0], ...chosen.map((entry) => entry.row)].join('\n'));
      const nextDone = new Set([...done, ...selected]);
      setDone(nextDone);
      try {
        sessionStorage.setItem(`practice-ielts-done:${mode}`, JSON.stringify([...nextDone]));
      } catch {}
      onClose();
    } catch (e) {
      setLoadError(e.message);
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Chọn bài để học"
      wide
      footer={
        <>
          <span className="selection-count">{selected.size} mục đã chọn</span>
          <Button variant="primary" disabled={!selected.size} onClick={start}>
            Bắt đầu →
          </Button>
        </>
      }
    >
      <Status error>{error || loadError}</Status>
      {!data && !error && <Status>Đang tải bộ bài…</Status>}
      <div className="filter-grid">
        <label className="field">
          Ngày học
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            <option value="">Tất cả ngày</option>
            {[...new Set(days.map((day) => day.date))].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        {entries.some((entry) => entry.topic) && (
          <label className="field">
            Chủ đề
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">Tất cả chủ đề</option>
              {[...new Set(entries.map((entry) => entry.topic).filter(Boolean))].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <details className="more-actions">
        <summary>
          Chọn nhanh <span>＋</span>
        </summary>
        <div className="action-wrap">
          <label className="field compact-field">
            Số mục
            <input
              type="number"
              min="1"
              step="1"
              value={count}
              onChange={(e) => {
                const value = e.target.value;
                setCount(value);
                if (Number.isSafeInteger(Number(value)) && Number(value) > 0)
                  try {
                    localStorage.setItem(`practice-random-count:${mode}`, value);
                  } catch {}
              }}
            />
          </label>
          <Button
            disabled={!Number.isSafeInteger(Number(count)) || Number(count) < 1}
            onClick={() =>
              setSelected(
                (previous) =>
                  new Set(
                    [...previous]
                      .filter((id) => !visible.some((entry) => entry.id === id))
                      .concat(
                        shuffleVocabReviewCards(visible)
                          .slice(0, Number(count))
                          .map((entry) => entry.id),
                      ),
                  ),
              )
            }
          >
            Chọn ngẫu nhiên
          </Button>
          <Button
            onClick={() =>
              setSelected((previous) => new Set([...previous, ...visible.map((entry) => entry.id)]))
            }
          >
            Chọn tất cả đang hiện
          </Button>
          <Button onClick={() => setSelected(new Set())}>Bỏ chọn</Button>
        </div>
      </details>
      <p className="muted">{visible.length} mục đang hiển thị · mục đã học có dấu ✓</p>
      <div className="picker-list">
        {visible.map((entry) => (
          <label
            className={`picker-item ${selected.has(entry.id) ? 'is-selected' : ''}`}
            key={entry.id}
          >
            <input
              type="checkbox"
              checked={selected.has(entry.id)}
              onChange={() => toggle(entry.id)}
            />
            <span>
              <strong>{entry.fields?.[0]}</strong>
              <span className="picker-meaning">{entry.fields?.[2]}</span>
              <small>
                {done.has(entry.id) ? '✓ Đã học · ' : ''}
                {entry.topic || entry.date}
                {entry.level ? ` · ${entry.level}` : ''}
              </small>
            </span>
          </label>
        ))}
        {data && !visible.length && <Status>Không có mục phù hợp với bộ lọc.</Status>}
      </div>
    </Dialog>
  );
}
