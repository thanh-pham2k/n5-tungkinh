'use client';
import { useEffect, useState } from 'react';
import {
  AudioStatus,
  Button,
  Dialog,
  EmptyState,
  MoreActions,
  RubyText,
  Status,
} from '../ui/primitives';
import useSpeech from '../../hooks/use-speech';
import useStudyLibrary from '../../hooks/use-study-library';
import SavedLessons from './saved-lessons';
import {
  CHOICE_NUMBERS,
  MULTIPLE_CHOICE_HEADER,
  parseMultipleChoice,
} from '../../services/multiple-choice-service';

const MODES = Object.freeze({ ALL: 'all', LATER: 'later', RETRY: 'retry' });
export default function MultipleChoice({ settings, active, setFocus }) {
  const library = useStudyLibrary('multiple-choice');
  const [questions, setQuestions] = useState([]);
  const [source, setSource] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [answers, setAnswers] = useState({});
  const [later, setLater] = useState(new Set());
  const [mode, setMode] = useState(MODES.ALL);
  const [retryIds, setRetryIds] = useState(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(1);
  const speech = useSpeech(settings);
  useEffect(() => {
    if (!library.lesson) return;
    const progress = { answers, later: [...later] };
    if (
      JSON.stringify(progress) ===
      JSON.stringify({
        answers: library.lesson.progress.answers || {},
        later: library.lesson.progress.later || [],
      })
    )
      return;
    const timer = setTimeout(() => library.updateProgress(progress).catch(() => {}), 300);
    return () => clearTimeout(timer);
  }, [answers, later, library.lesson?.id]);
  useEffect(() => {
    speech.stop();
  }, [active, page, mode, speech.stop]);
  const filtered = questions.filter(
    (q) => mode === MODES.ALL || (mode === MODES.LATER ? later.has(q.id) : retryIds.has(q.id)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const checked = questions.filter((q) => answers[q.id]?.checked);
  const wrong = checked.filter((q) => answers[q.id].selected !== q.correctAnswer);
  async function load(record = null) {
    try {
      let next = record?.parsed || parseMultipleChoice(source);
      if (record) library.restore(record);
      else next = (await library.save(source, settings.language)).parsed;
      if (record) setSource(record.source);
      speech.stop();
      setQuestions(next);
      const restored = record?.progress || {};
      const validAnswers = Object.fromEntries(
        next
          .filter((q) => CHOICE_NUMBERS.includes(restored.answers?.[q.id]?.selected))
          .map((q) => [
            q.id,
            {
              selected: restored.answers[q.id].selected,
              checked: restored.answers[q.id].checked === true,
            },
          ]),
      );
      setAnswers(validAnswers);
      setLater(
        new Set(
          Array.isArray(restored.later)
            ? restored.later.filter((id) => next.some((q) => q.id === id))
            : [],
        ),
      );
      setMode(MODES.ALL);
      setPage(0);
      setError('');
      setNotice('');
      setOpen(false);
      setFocus(true);
    } catch (e) {
      setError(e.message);
    }
  }
  function toggleLater(id) {
    const next = new Set(later);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setLater(next);
  }
  function switchMode(next) {
    setMode(next);
    setPage(0);
  }
  function retryWrong() {
    setRetryIds(new Set(wrong.map((q) => q.id)));
    setAnswers((old) =>
      Object.fromEntries(Object.entries(old).filter(([id]) => !wrong.some((q) => q.id === id))),
    );
    switchMode(MODES.RETRY);
  }
  async function copyResults() {
    try {
      await navigator.clipboard.writeText(
        checked
          .map((q) => {
            const selected = answers[q.id].selected;
            return `${q.number}. ${q.question}\nTôi chọn: ${selected}. ${q.options[Number(selected) - 1]}\nĐáp án đúng: ${q.correctAnswer}. ${q.options[Number(q.correctAnswer) - 1]}\n${q.explanation}`;
          })
          .join('\n\n'),
      );
      setNotice('Đã sao chép kết quả.');
    } catch {
      setNotice(
        'Không sao chép được. Hãy cho phép truy cập clipboard hoặc sao chép nội dung trực tiếp.',
      );
    }
  }
  return (
    <div className="study-panel multiple-choice">
      <SavedLessons tool="multiple-choice" onLoad={load} />
      <Status error>{library.error}</Status>
      <div className="source-actions">
        <Button
          onClick={() => {
            setError('');
            setOpen(true);
          }}
        >
          Nhập dữ liệu
        </Button>
        {!!questions.length && <span className="muted">{questions.length} câu hỏi</span>}
      </div>
      {!questions.length ? (
        <EmptyState title="Chọn đáp án. Hiểu cách dùng.">
          Nhập bộ câu hỏi phân cách bằng dấu |, có sẵn đáp án và giải thích.
        </EmptyState>
      ) : (
        <>
          <div className="mc-progress" role="status">
            Đã kiểm tra {checked.length}/{questions.length} · Đúng {checked.length - wrong.length} ·
            Sai {wrong.length}
          </div>
          <progress
            max={questions.length}
            value={checked.length}
            aria-label="Tiến độ Multiple Choice"
          />
          <MoreActions title="Tùy chọn ôn tập">
            <Button aria-pressed={mode === MODES.ALL} onClick={() => switchMode(MODES.ALL)}>
              Tất cả câu hỏi
            </Button>
            <Button aria-pressed={mode === MODES.LATER} onClick={() => switchMode(MODES.LATER)}>
              Ôn sau ({questions.filter((q) => later.has(q.id)).length})
            </Button>
            <Button disabled={!wrong.length} onClick={retryWrong}>
              Làm lại câu sai ({wrong.length})
            </Button>
            <Button disabled={!checked.length} onClick={copyResults}>
              Sao chép kết quả
            </Button>
            <Button
              onClick={() => {
                speech.stop();
                setAnswers({});
                switchMode(MODES.ALL);
              }}
            >
              Làm lại từ đầu
            </Button>
            <label className="field">
              Số câu mỗi trang
              <input
                type="number"
                min="1"
                max="50"
                value={pageSize}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  if (Number.isInteger(size) && size >= 1 && size <= 50) {
                    setPageSize(size);
                    setPage(0);
                    speech.stop();
                  }
                }}
              />
            </label>
            <Button
              variant="danger"
              onClick={() => {
                speech.stop();
                setQuestions([]);
                setAnswers({});
                setSource('');
                setNotice('');
                switchMode(MODES.ALL);
              }}
            >
              Xóa bộ đang học
            </Button>
          </MoreActions>
          {mode === MODES.RETRY && <Status>Đang luyện lại {filtered.length} câu sai.</Status>}
          {!filtered.length && (
            <Status>
              Chưa có câu nào trong danh sách ôn sau. Chọn “Tất cả câu hỏi” để tiếp tục.
            </Status>
          )}
          <div className="mc-questions">
            {visible.map((q) => {
              const answer = answers[q.id] || {};
              const correct = answer.selected === q.correctAnswer;
              return (
                <article
                  key={q.id}
                  className="mc-question"
                  aria-labelledby={`mc-question-${q.number}`}
                >
                  <div className="mc-question-top">
                    <span className="eyebrow">Câu {q.number}</span>
                    <Button
                      aria-label={later.has(q.id) ? 'Bỏ ôn sau' : 'Đánh dấu ôn sau'}
                      aria-pressed={later.has(q.id)}
                      onClick={() => toggleLater(q.id)}
                    >
                      {later.has(q.id) ? '★ Đã lưu' : '☆ Ôn sau'}
                    </Button>
                  </div>
                  {q.context && <blockquote className="mc-context">{q.context}</blockquote>}
                  <h2 id={`mc-question-${q.number}`} className="mc-question-text">
                    <RubyText text={q.question} />
                  </h2>
                  <fieldset className="mc-options" disabled={answer.checked}>
                    <legend>Chọn đáp án cho câu {q.number}</legend>
                    {q.options.map((option, index) => {
                      const number = CHOICE_NUMBERS[index];
                      const feedback = answer.checked
                        ? number === q.correctAnswer
                          ? 'is-correct'
                          : number === answer.selected
                            ? 'is-wrong'
                            : ''
                        : '';
                      return (
                        <label className={`mc-option ${feedback}`} key={number}>
                          <input
                            type="radio"
                            name={`mc-${q.number}`}
                            value={number}
                            checked={answer.selected === number}
                            onChange={() =>
                              setAnswers((old) => ({
                                ...old,
                                [q.id]: { selected: number, checked: false },
                              }))
                            }
                          />
                          <span className="mc-option-text">
                            <strong>{number}.</strong> <RubyText text={option} />
                            {answer.checked && number === q.correctAnswer && (
                              <small> ✓ Đáp án đúng</small>
                            )}
                            {answer.checked && number === answer.selected && !correct && (
                              <small> ✕ Bạn đã chọn</small>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                  {!answer.checked ? (
                    <Button
                      variant="primary"
                      disabled={!answer.selected}
                      onClick={() =>
                        setAnswers((old) => ({ ...old, [q.id]: { ...old[q.id], checked: true } }))
                      }
                    >
                      Kiểm tra câu {q.number}
                    </Button>
                  ) : (
                    <div
                      className={`mc-feedback ${correct ? 'is-correct' : 'is-wrong'}`}
                      role="status"
                    >
                      <p>
                        <strong>
                          {correct
                            ? 'Chính xác!'
                            : `Chưa đúng. Đáp án đúng: ${q.correctAnswer}. ${q.options[Number(q.correctAnswer) - 1]}`}
                        </strong>
                      </p>
                      {q.explanation && <p>{q.explanation}</p>}
                      {(q.example || q.exampleMeaning) && (
                        <div className="mc-example">
                          <span className="eyebrow">Ví dụ</span>
                          {q.example && (
                            <p>
                              <RubyText text={q.example} />
                            </p>
                          )}
                          {q.exampleMeaning && <p className="muted">{q.exampleMeaning}</p>}
                        </div>
                      )}
                    </div>
                  )}
                  <MoreActions title="Nghe câu hỏi">
                    <Button onClick={() => speech.play([{ text: q.question, count: 1 }])}>
                      Phát câu {q.number}
                    </Button>
                    {speech.busy && <Button onClick={speech.stop}>Dừng audio</Button>}
                  </MoreActions>
                </article>
              );
            })}
          </div>
          {!!filtered.length && (
            <div className="study-actions mc-navigation">
              <Button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
                ← Trước
              </Button>
              <span>
                Trang {currentPage + 1}/{pages}
              </span>
              <Button disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>
                Tiếp →
              </Button>
            </div>
          )}
        </>
      )}
      <AudioStatus speech={speech} />
      <Status>{notice}</Status>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nhập Multiple Choice"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Hủy</Button>
            <Button variant="primary" disabled={library.saving} onClick={() => load()}>
              Nạp dữ liệu
            </Button>
          </>
        }
      >
        <p>
          Dán dữ liệu phân cách bằng dấu |. Đáp án đúng dùng số 1–4. Các cột sau correct_answer có
          thể để trống hoặc bỏ khỏi header.
        </p>
        <code className="csv-header mc-import-header">{MULTIPLE_CHOICE_HEADER}</code>
        <p className="muted">
          Ô chứa | hoặc xuống dòng cần bọc bằng dấu nháy kép; viết hai dấu nháy kép liên tiếp để ghi
          dấu nháy trong ô.
        </p>
        <label className="field">
          Nội dung Multiple Choice
          <textarea
            rows={12}
            spellCheck={false}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={MULTIPLE_CHOICE_HEADER}
          />
        </label>
        <Status error>{error}</Status>
      </Dialog>
    </div>
  );
}
