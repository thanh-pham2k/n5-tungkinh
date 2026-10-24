'use client';
import { useState } from 'react';
import usePracticeData from '../../hooks/use-practice-data';
import { Button, EmptyState, RubyText, Status } from '../ui/primitives';
export function SentenceStructures({ onPractice, active }) {
  const { data, error } = usePracticeData(active);
  const [index, setIndex] = useState(0);
  const topics = data?.structures || [],
    topic = topics[index];
  return (
    <div className="study-panel">
      <p className="intro">
        Mẫu câu dùng lại được. Đọc một mẫu, rồi luyện 5 câu của riêng chủ đề đó.
      </p>
      <Status error>{error}</Status>
      <label className="field">
        Chủ đề
        <select value={index} onChange={(e) => setIndex(Number(e.target.value))}>
          {topics.map((topic, index) => (
            <option key={index} value={index}>
              {topic.topic}
            </option>
          ))}
        </select>
      </label>
      {!data && !error && <Status>Đang tải cấu trúc câu…</Status>}
      <div className="reference-list">
        {topic?.items.map((item, index) => (
          <article className="study-card" key={`${topic.topic}:${index}`}>
            <span className="eyebrow">{item.purpose}</span>
            <h2 className="structure-pattern">{item.pattern}</h2>
            <p>{item.example}</p>
            <p className="muted">{item.meaning}</p>
            <Button
              variant="primary"
              disabled={item.exercises?.length !== 5}
              onClick={() => onPractice(item.exercises)}
            >
              Luyện 5 câu →
            </Button>
          </article>
        ))}
      </div>
      <details className="more-actions">
        <summary>Ký hiệu trong mẫu câu</summary>
        <p>
          S: chủ ngữ · V: động từ · clause: mệnh đề · noun: danh từ · V-ing: dạng -ing. Sau
          can/could/should/will dùng động từ nguyên mẫu.
        </p>
      </details>
    </div>
  );
}
export function SpeakingQuestions({ active }) {
  const { data, error } = usePracticeData(active);
  const [index, setIndex] = useState(0),
    [part, setPart] = useState('');
  const topics = data?.speaking || [],
    topic = topics[index],
    questions =
      topic?.questions.filter((question) => !part || String(question.part) === part) || [];
  return (
    <div className="study-panel">
      <p className="intro">
        Chọn một chủ đề và luyện nói thành tiếng. Bộ câu hỏi tự biên soạn để luyện tập.
      </p>
      <Status error>{error}</Status>
      <div className="filter-grid">
        <label className="field">
          Chủ đề · ngày học
          <select value={index} onChange={(e) => setIndex(Number(e.target.value))}>
            {topics.map((topic, index) => (
              <option value={index} key={index}>
                {topic.date} · {topic.topic}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Phần thi
          <select value={part} onChange={(e) => setPart(e.target.value)}>
            <option value="">Tất cả phần</option>
            <option value="1">Part 1 · Cá nhân</option>
            <option value="2">Part 2 · Cue card</option>
            <option value="3">Part 3 · Thảo luận</option>
          </select>
        </label>
      </div>
      {!data && !error ? (
        <Status>Đang tải câu hỏi…</Status>
      ) : (
        <p className="helper">
          {questions.length} mục · {topic?.topic}
        </p>
      )}
      <details className="more-actions">
        <summary>Cách luyện từng Part</summary>
        <p>
          Part 1: trả lời, nêu lý do và ví dụ. Part 2: chuẩn bị 1 phút, nói 1–2 phút theo gợi ý.
          Part 3: nêu quan điểm và giải thích ở mức xã hội.
        </p>
      </details>
      <div className="reference-list">
        {questions.map((question) => (
          <article className="study-card speaking-card" key={question.id}>
            <span className="badge">Part {question.part}</span>
            <h2>{question.text}</h2>
            {question.points && (
              <div className="cue-points">
                <strong>You should say:</strong>
                <ul>
                  {question.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
      {data && !questions.length && (
        <EmptyState title="Chưa có câu hỏi phù hợp.">
          Thử chọn phần thi hoặc chủ đề khác.
        </EmptyState>
      )}
    </div>
  );
}
