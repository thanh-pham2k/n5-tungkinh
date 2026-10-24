'use client';
import useStudyLibrary from '../../hooks/use-study-library';
import SavedLessons from './saved-lessons';
import { Status as LibraryStatus } from '../ui/primitives';
import { useState } from 'react';
import { parseWritingReviewCsv } from '../../services/csv-service';
import { Button, CsvImport, EmptyState, MoreActions, Progress, Status } from '../ui/primitives';
export default function WritingReview({ setFocus }) {
  const library = useStudyLibrary('writing');
  const [items, setItems] = useState([]),
    [index, setIndex] = useState(0),
    [answers, setAnswers] = useState({}),
    [sample, setSample] = useState(false),
    [feedback, setFeedback] = useState(''),
    [csv, setCsv] = useState(false),
    [source, setSource] = useState('');
  const item = items[index],
    answer = answers[index] || '';
  async function load(text, english = true, record = null) {
    let next = record?.parsed || parseWritingReviewCsv(text);
    if (!next.length) throw new Error('CSV chưa có đề để viết.');
    if (record) library.restore(record);
    else next = (await library.save(text, 'en')).parsed;
    setItems(next);
    setSource(text);
    setIndex(0);
    setAnswers(record?.progress?.answers || {});
    setSample(false);
    setFeedback('');
    setFocus(true);
  }
  function go(offset) {
    setIndex(index + offset);
    setSample(false);
    setFeedback('');
  }
  return (
    <div className="study-panel">
      <SavedLessons
        tool={'writing'}
        revision={library.lesson?.id}
        onLoad={(record) => load(record.source, record.language === 'en', record)}
      />
      <LibraryStatus error>{library.error}</LibraryStatus>
      <div className="source-actions">
        <Button variant="primary" onClick={() => setCsv(true)}>
          ＋ Nhập đề CSV
        </Button>
      </div>
      {!item ? (
        <EmptyState title="Viết từ một ngữ cảnh cụ thể.">
          Nhập đề có ngữ cảnh, yêu cầu và bài mẫu. Viết câu trả lời rồi tự đối chiếu.
        </EmptyState>
      ) : (
        <>
          <Progress index={index} total={items.length} suffix="Luyện viết" />
          <MoreActions>
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(source);
                  setFeedback('Đã copy CSV nguồn.');
                } catch {
                  setFeedback('Không copy được. Hãy kiểm tra quyền clipboard.');
                }
              }}
            >
              Copy CSV
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setItems([]);
                setAnswers({});
              }}
            >
              Xóa dữ liệu
            </Button>
          </MoreActions>
          <details className="writing-prompt study-card" open>
            <summary>Đề bài & ngữ cảnh</summary>
            {item.context && <p className="muted">{item.context}</p>}
            <h2>{item.prompt}</h2>
            {item.input && <p className="pre-wrap">{item.input}</p>}
          </details>
          <label className="field answer-field">
            Câu trả lời của bạn
            <textarea
              rows={7}
              spellCheck
              value={answer}
              onChange={(e) => {
                setAnswers({ ...answers, [index]: e.target.value });
                setFeedback('');
              }}
              placeholder="Bắt đầu viết tại đây…"
            />
          </label>
          <Status error={feedback.includes('nhập') || feedback.includes('Không')}>
            {feedback}
          </Status>
          {sample && (
            <div className="answer-sample">
              <span className="eyebrow">Bài mẫu để tự đối chiếu</span>
              <p className="pre-wrap">{item.sample_answer}</p>
            </div>
          )}
          <div className="study-actions">
            <Button disabled={!index} onClick={() => go(-1)}>
              ← Trước
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!answer.trim()) {
                  setFeedback('Vui lòng nhập câu trả lời.');
                  return;
                }
                try {
                  await library.updateProgress({ answers });
                  setFeedback('Đã lưu câu trả lời trên Turso. Mở bài mẫu để tự so sánh.');
                } catch (error) {
                  setFeedback(error.message);
                }
              }}
            >
              Ghi nhận bài viết
            </Button>
          </div>
          <div className="secondary-actions">
            <Button variant="text" onClick={() => setSample(!sample)}>
              {sample ? 'Ẩn bài mẫu' : 'Xem bài mẫu'}
            </Button>
            <Button variant="text" disabled={index >= items.length - 1} onClick={() => go(1)}>
              Câu tiếp →
            </Button>
          </div>
          <p className="helper">Tự đối chiếu bài mẫu; công cụ không chấm điểm hoặc band IELTS.</p>
        </>
      )}
      <CsvImport
        open={csv}
        onClose={() => setCsv(false)}
        title="Nhập đề Writing"
        header="context,prompt,input,sample_answer"
        onLoad={load}
      />
    </div>
  );
}
