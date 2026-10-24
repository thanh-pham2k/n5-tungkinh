'use client';
import useStudyLibrary from '../../hooks/use-study-library';
import SavedLessons from './saved-lessons';
import { Status as LibraryStatus } from '../ui/primitives';
import { useEffect, useRef, useState } from 'react';
import {
  parseWordOrderCsv,
  shuffleTokensGuaranteed,
  shuffleVocabReviewCards,
} from '../../services/csv-service';
import { isOrderCorrect, isTypingCorrect } from '../../services/answer-service';
import useSpeech from '../../hooks/use-speech';
import {
  AudioStatus,
  Button,
  CsvImport,
  EmptyState,
  MoreActions,
  Progress,
  RubyText,
  Status,
} from '../ui/primitives';
import IeltsPicker from './ielts-picker';
const HEADER = 'vocabulary,hiragana,meaning_vi,example_ja,example_vi,word_order';

export default function WordOrder({
  typing,
  settings,
  updateSettings,
  active,
  setFocus,
  exerciseSet,
}) {
  const library = useStudyLibrary(typing ? 'typing' : 'order');
  const [items, setItems] = useState([]),
    [index, setIndex] = useState(0),
    [bank, setBank] = useState([]),
    [selected, setSelected] = useState([]),
    [answer, setAnswer] = useState(''),
    [result, setResult] = useState(''),
    [sample, setSample] = useState(false);
  const [csv, setCsv] = useState(false),
    [picker, setPicker] = useState(''),
    [hintCollapsed, setHintCollapsed] = useState(false);
  const input = useRef(null);
  const speech = useSpeech(settings);
  const item = items[index];
  const tokens = item?.tokens.map((text, id) => ({ text, id })) || [];
  function reset(nextItem = item) {
    speech.stop();
    setSelected([]);
    setBank(shuffleTokensGuaranteed(nextItem?.tokens.map((text, id) => ({ text, id })) || []));
    setAnswer('');
    setResult('');
    setSample(false);
    setHintCollapsed(false);
  }
  async function load(text, english = false, record = null) {
    let next = record?.parsed || parseWordOrderCsv(text);
    if (!next.length) throw new Error('CSV chưa có câu để học.');
    if (record) library.restore(record);
    else next = (await library.save(text, english ? 'en' : settings.language)).parsed;
    setItems(next);
    setIndex(0);
    reset(next[0]);
    if (record) updateSettings({ language: record.language });
    else if (english) updateSettings({ language: 'en' });
    setFocus(true);
  }
  useEffect(() => {
    if (exerciseSet) {
      library.restore(exerciseSet);
      setItems(exerciseSet.parsed);
      setIndex(0);
      reset(exerciseSet.parsed[0]);
    }
  }, [exerciseSet]);
  useEffect(() => {
    reset();
  }, [typing]);
  useEffect(() => {
    if (!active) speech.stop();
  }, [active, speech.stop]);
  function listen() {
    if (item) speech.play([{ text: item.targetSentence.replace(/（[^）]+）/g, ''), count: 1 }]);
  }
  function check() {
    if (!item) return;
    const correct = typing
      ? isTypingCorrect(answer, item.targetSentence)
      : isOrderCorrect(selected, tokens);
    setResult(correct ? 'correct' : 'incorrect');
    if (correct) {
      setSample(true);
      listen();
    }
  }
  function go(offset) {
    const next = index + offset;
    if (next >= 0 && next < items.length) {
      setIndex(next);
      reset(items[next]);
    }
  }
  function showAnswer() {
    setSample(true);
    setResult('sample');
    if (typing) setAnswer(item.targetSentence.replace(/（[^）]+）/g, ''));
    else {
      setSelected(tokens);
      setBank([]);
    }
  }
  useEffect(() => {
    if (!active) return;
    const keydown = (event) => {
      if (
        event.isComposing ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        document.querySelector('dialog[open]') ||
        event.target.closest('input,textarea,select,button,summary,a,[contenteditable]')
      )
        return;
      if (['ArrowLeft', 'ArrowRight', 'Enter', ' ', 'j', 'l'].includes(event.key))
        event.preventDefault();
      if (['ArrowLeft', 'j'].includes(event.key)) go(-1);
      else if (['ArrowRight', 'l'].includes(event.key)) go(1);
      else if (['Enter', ' '].includes(event.key)) {
        if (result) go(1);
        else check();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  return (
    <div className="study-panel">
      <SavedLessons
        tool={typing ? 'typing' : 'order'}
        revision={library.lesson?.id}
        onLoad={(record) => load(record.source, record.language === 'en', record)}
      />
      <LibraryStatus error>{library.error}</LibraryStatus>
      <div className="source-actions">
        <Button variant="primary" onClick={() => setPicker('word-order')}>
          ▤ Chọn bài IELTS
        </Button>
        <Button onClick={() => setCsv(true)}>＋ Nhập CSV</Button>
      </div>
      {!item ? (
        <EmptyState
          title={typing ? 'Gõ một câu. Nhớ thêm một chút.' : 'Từng mảnh nhỏ, một câu hoàn chỉnh.'}
        />
      ) : (
        <>
          <Progress
            index={index}
            total={items.length}
            suffix={
              item.structureLevel
                ? `Mức ${item.structureLevel}/5`
                : typing
                  ? 'Luyện gõ câu'
                  : 'Luyện ghép câu'
            }
          />
          <MoreActions>
            <Button onClick={() => setPicker('writing')}>Chọn bài Writing</Button>
            <Button
              onClick={() => {
                const next = shuffleVocabReviewCards(items);
                setItems(next);
                setIndex(0);
                reset(next[0]);
              }}
            >
              Xáo bộ bài
            </Button>
            <Button onClick={() => reset()}>Làm lại câu</Button>
            <Button
              onClick={() => {
                setIndex(0);
                reset(items[0]);
              }}
            >
              Luyện lại từ đầu
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                reset();
                setItems([]);
              }}
            >
              Xóa dữ liệu
            </Button>
          </MoreActions>
          <article
            className={`study-card question-card ${hintCollapsed ? 'question-collapsed' : ''}`}
          >
            <div className="card-top">
              <span className="eyebrow">Gợi ý nghĩa</span>
              <Button onClick={listen} aria-label="Nghe câu">
                ♫ Nghe
              </Button>
            </div>
            <p className="question-text">{item.prompt}</p>
            {typing && (
              <Button variant="text" onClick={() => setHintCollapsed(!hintCollapsed)}>
                {hintCollapsed ? 'Mở gợi ý' : 'Thu gọn gợi ý'}
              </Button>
            )}
          </article>
          {typing ? (
            <>
              <details className="more-actions" open={!hintCollapsed}>
                <summary>Các từ / cụm từ gợi ý</summary>
                <div className="word-bank">
                  {bank.length
                    ? bank.map((token) => (
                        <span className="hint-chip" key={token.id}>
                          {token.text}
                        </span>
                      ))
                    : tokens.map((token) => (
                        <span className="hint-chip" key={token.id}>
                          {token.text}
                        </span>
                      ))}
                </div>
              </details>
              <label className="field answer-field">
                Câu trả lời của bạn
                <textarea
                  ref={input}
                  value={answer}
                  rows={4}
                  spellCheck={false}
                  autoCapitalize="off"
                  onFocus={() => setHintCollapsed(true)}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    setResult('');
                    setSample(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      if (result === 'correct') go(1);
                      else check();
                    }
                  }}
                  placeholder="Gõ câu hoàn chỉnh…"
                />
              </label>
              <p className="helper">Bỏ qua hoa/thường và dấu câu khi kiểm tra.</p>
            </>
          ) : (
            <>
              <div
                className={`answer-slots ${result === 'correct' ? 'is-correct' : result === 'incorrect' ? 'is-incorrect' : ''}`}
                aria-label="Câu của bạn"
              >
                <span className="eyebrow">Câu của bạn · chạm để hoàn tác</span>
                <div className="word-bank">
                  {!selected.length && (
                    <p className="muted">Chọn các từ bên dưới theo thứ tự đúng.</p>
                  )}
                  {selected.map((token) => (
                    <Button
                      className="word-chip selected-chip"
                      key={token.id}
                      onClick={() => {
                        setSelected(selected.filter((t) => t.id !== token.id));
                        setBank([...bank, token]);
                        setResult('');
                        setSample(false);
                      }}
                    >
                      {token.text}
                      <span aria-hidden="true"> ×</span>
                    </Button>
                  ))}
                </div>
              </div>
              <div className="word-pool">
                <span className="eyebrow">Kho từ · {bank.length} mảnh còn lại</span>
                <div className="word-bank">
                  {bank.map((token) => (
                    <Button
                      className="word-chip"
                      key={token.id}
                      onClick={() => {
                        setSelected([...selected, token]);
                        setBank(bank.filter((t) => t.id !== token.id));
                        setResult('');
                        setSample(false);
                      }}
                    >
                      {token.text}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
          {result && (
            <Status error={result === 'incorrect'}>
              {result === 'correct'
                ? '✓ Chính xác! Bạn đã hoàn thành câu.'
                : result === 'sample'
                  ? 'Đang xem đáp án mẫu. Bạn có thể làm lại câu.'
                  : 'Chưa chính xác. Hãy chỉnh câu hoặc xem đáp án.'}
            </Status>
          )}
          {sample && (
            <div className="answer-sample">
              <span className="eyebrow">Câu hoàn chỉnh</span>
              <p>
                <RubyText text={item.targetSentence} />
              </p>
              <p className="muted">{item.exampleVi || item.meaningVi}</p>
            </div>
          )}
          <AudioStatus speech={speech} />
          <div className="study-actions">
            <Button disabled={index === 0} onClick={() => go(-1)}>
              ← Trước
            </Button>
            {result === 'correct' || result === 'sample' ? (
              <Button
                variant="primary"
                onClick={() => {
                  if (index === items.length - 1) {
                    setIndex(0);
                    reset(items[0]);
                  } else go(1);
                }}
              >
                {index === items.length - 1 ? 'Luyện lại bộ ↻' : 'Câu tiếp →'}
              </Button>
            ) : (
              <Button variant="primary" onClick={check}>
                {result === 'incorrect' ? 'Kiểm tra lại' : 'Kiểm tra'}
              </Button>
            )}
          </div>
          <div className="secondary-actions">
            <Button variant="text" onClick={showAnswer}>
              Xem đáp án
            </Button>
            <Button variant="text" disabled={index === items.length - 1} onClick={() => go(1)}>
              Bỏ qua câu →
            </Button>
          </div>
        </>
      )}
      <CsvImport
        open={csv}
        onClose={() => setCsv(false)}
        title={`Nhập CSV · ${typing ? 'Typing' : 'Word Order'}`}
        header={HEADER}
        exampleKey="word-order-example"
        onLoad={load}
      />
      <IeltsPicker
        open={Boolean(picker)}
        onClose={() => setPicker('')}
        mode={picker || 'word-order'}
        onLoad={(text) => load(text, true)}
      />
    </div>
  );
}
