'use client';
import useStudyLibrary from '../../hooks/use-study-library';
import SavedLessons from './saved-lessons';
import { Status as LibraryStatus } from '../ui/primitives';
import { useEffect, useState } from 'react';
import { parseVocabReviewCsv, shuffleVocabReviewCards } from '../../services/csv-service';
import useSpeech from '../../hooks/use-speech';
import {
  AudioStatus,
  Button,
  CsvImport,
  Dialog,
  EmptyState,
  MoreActions,
  Progress,
  RubyText,
} from '../ui/primitives';
import IeltsPicker from './ielts-picker';
export default function VocabReview({ settings, updateSettings, active, setFocus }) {
  const library = useStudyLibrary('cards');
  const [cards, setCards] = useState([]),
    [queue, setQueue] = useState([]),
    [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [later, setLater] = useState(new Set()),
    [mode, setMode] = useState('all');
  const [csv, setCsv] = useState(false),
    [picker, setPicker] = useState(false),
    [zoom, setZoom] = useState(false),
    [reading, setReading] = useState(true),
    [autoplay, setAutoplay] = useState(true);
  const speech = useSpeech(settings);
  const card = queue[index];
  function play(item = card) {
    if (!item) return;
    speech.play([
      {
        text: settings.language === 'en' ? item.vocabulary : item.hiragana || item.vocabulary,
        count: settings.repeats,
      },
    ]);
  }
  useEffect(() => {
    if (!active || !autoplay) {
      speech.stop();
      return;
    }
    if (card && !flipped) play();
  }, [active, card, flipped, autoplay, settings.language]);
  async function load(text, english = false, record = null) {
    let next = (record?.parsed || parseVocabReviewCsv(text)).map((item, id) => ({ ...item, id }));
    if (!next.length) throw new Error('CSV chưa có thẻ để học.');
    if (record) library.restore(record);
    else
      next = (await library.save(text, english ? 'en' : settings.language)).parsed.map(
        (item, id) => ({ ...item, id }),
      );
    setCards(next);
    setQueue(next);
    setIndex(0);
    setFlipped(false);
    setLater(new Set());
    setMode('all');
    speech.stop();
    if (record) updateSettings({ language: record.language });
    else if (english) updateSettings({ language: 'en' });
    setFocus(true);
  }
  const restart = (next, nextMode = 'all') => {
    speech.stop();
    setQueue(next);
    setIndex(0);
    setFlipped(false);
    setMode(nextMode);
  };
  const next = () => {
    if (!flipped) {
      setFlipped(true);
      return;
    }
    if (index < queue.length - 1) {
      setIndex(index + 1);
      setFlipped(false);
    }
  };
  const face = card && (
    <>
      <div className="card-top">
        <span className="eyebrow">{flipped ? 'Đáp án' : 'Nhớ nghĩa trước khi lật'}</span>
        <Button onClick={() => play()} aria-label="Nghe từ">
          ♫
        </Button>
      </div>
      <h2 className="flash-word">
        <RubyText text={card.vocabulary} />
      </h2>
      {reading && card.hiragana && (
        <p className="reading">
          <RubyText text={card.hiragana} />
        </p>
      )}
      {flipped && (
        <div className="flash-answer">
          <h3>{card.meaning_vi}</h3>
          <p>
            <RubyText text={card.example_ja} />
          </p>
          <p className="muted">{card.example_vi}</p>
          {card.example_ja && (
            <Button
              onClick={() =>
                speech.play([
                  { text: card.example_ja.replace(/（[^）]+）/g, ''), count: settings.repeats },
                ])
              }
            >
              ♫ Nghe ví dụ
            </Button>
          )}
        </div>
      )}
    </>
  );
  return (
    <div className="study-panel">
      <SavedLessons
        tool={'cards'}
        revision={library.lesson?.id}
        onLoad={(record) => load(record.source, record.language === 'en', record)}
      />
      <LibraryStatus error>{library.error}</LibraryStatus>
      <div className="source-actions">
        <Button variant="primary" onClick={() => setPicker(true)}>
          ▤ Từ vựng IELTS
        </Button>
        <Button onClick={() => setCsv(true)}>＋ Nhập CSV</Button>
      </div>
      {!card ? (
        <EmptyState />
      ) : (
        <>
          <Progress
            index={index}
            total={queue.length}
            suffix={mode === 'later' ? 'Ôn thẻ Later' : 'Flashcard'}
          />
          <MoreActions>
            <Button onClick={() => restart(shuffleVocabReviewCards(cards))}>Xáo thẻ</Button>
            <Button
              disabled={!later.size}
              onClick={() =>
                restart(
                  cards.filter((item) => later.has(item.id)),
                  'later',
                )
              }
            >
              Later · {later.size}
            </Button>
            <Button onClick={() => restart(cards)}>Học lại từ đầu</Button>
            <Button onClick={() => setZoom(true)}>Phóng to</Button>
            <label className="check-field">
              <input
                type="checkbox"
                checked={reading}
                onChange={(e) => setReading(e.target.checked)}
              />
              Hiện Hiragana
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(e) => setAutoplay(e.target.checked)}
              />
              Tự phát audio
            </label>
            <Button
              variant="danger"
              onClick={() => {
                speech.stop();
                setCards([]);
                setQueue([]);
                setLater(new Set());
              }}
            >
              Xóa dữ liệu
            </Button>
          </MoreActions>
          <article className="study-card flashcard">{face}</article>
          <AudioStatus speech={speech} />
          <div className="study-actions">
            <Button
              disabled={index === 0}
              onClick={() => {
                setIndex(index - 1);
                setFlipped(false);
              }}
            >
              ← Trước
            </Button>
            {flipped && (
              <Button
                disabled={later.has(card.id)}
                onClick={() => setLater((previous) => new Set([...previous, card.id]))}
              >
                {later.has(card.id) ? '★ Đã lưu' : '☆ Later'}
              </Button>
            )}
            <Button
              variant="primary"
              onClick={next}
              disabled={flipped && index === queue.length - 1}
            >
              {!flipped ? 'Xem đáp án' : index === queue.length - 1 ? 'Đã hết bộ ✓' : 'Thẻ tiếp →'}
            </Button>
          </div>
          {flipped && index === queue.length - 1 && (
            <div className="completion">
              <strong>Đã đến cuối bộ thẻ.</strong>
              <Button onClick={() => restart(shuffleVocabReviewCards(cards))}>Luyện lại</Button>
            </div>
          )}
        </>
      )}
      <CsvImport
        open={csv}
        onClose={() => setCsv(false)}
        title="Nhập flashcard CSV"
        header="vocabulary,hiragana,meaning_vi,example_ja,example_vi"
        onLoad={load}
      />
      <IeltsPicker
        open={picker}
        onClose={() => setPicker(false)}
        mode="topic-vocab"
        onLoad={(text) => load(text, true)}
      />
      <Dialog
        open={zoom}
        onClose={() => setZoom(false)}
        title="Flashcard"
        footer={
          <Button variant="primary" onClick={next} disabled={flipped && index === queue.length - 1}>
            {flipped ? 'Thẻ tiếp →' : 'Xem đáp án'}
          </Button>
        }
      >
        <div className="flashcard">{face}</div>
      </Dialog>
    </div>
  );
}
