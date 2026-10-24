'use client';
import useStudyLibrary from '../../hooks/use-study-library';
import SavedLessons from './saved-lessons';
import { Status as LibraryStatus } from '../ui/primitives';
import { useEffect, useState } from 'react';
import { parseInstantVocabCsv, shuffleVocabReviewCards } from '../../services/csv-service';
import useSpeech from '../../hooks/use-speech';
import {
  AudioStatus,
  Button,
  CsvImport,
  EmptyState,
  MoreActions,
  RubyText,
} from '../ui/primitives';
import IeltsPicker from './ielts-picker';
const HEADER = 'vocabulary,hiragana,meaning_vi,example_ja,example_vi';
export default function InstantVocab({ settings, updateSettings, active, setFocus }) {
  const library = useStudyLibrary('instant');
  const [items, setItems] = useState([]);
  const [csv, setCsv] = useState(false);
  const [picker, setPicker] = useState(false);
  const [order, setOrder] = useState('sequential');
  const speech = useSpeech(settings);
  useEffect(() => {
    if (!active) speech.stop();
  }, [active, speech.stop]);
  async function load(text, english = false, record = null) {
    let parsed = record?.parsed || parseInstantVocabCsv(text);
    if (!parsed.length) throw new Error('CSV chưa có mục để học.');
    if (record) library.restore(record);
    else parsed = (await library.save(text, english ? 'en' : settings.language)).parsed;
    speech.stop();
    setItems(parsed);
    if (record) updateSettings({ language: record.language });
    else if (english) updateSettings({ language: 'en' });
    setFocus(true);
  }
  const segments = (index) => [
    { index, text: items[index].meaningVi, language: 'vi', count: settings.vietnameseRepeats },
    {
      index,
      text:
        settings.language === 'en'
          ? items[index].vocabulary
          : items[index].hiragana || items[index].vocabulary,
      language: settings.language,
      count: settings.repeats,
    },
  ];
  return (
    <div className="study-panel">
      <SavedLessons
        tool={'instant'}
        revision={library.lesson?.id}
        onLoad={(record) => load(record.source, record.language === 'en', record)}
      />
      <LibraryStatus error>{library.error}</LibraryStatus>
      <div className="source-actions">
        <Button variant="primary" onClick={() => setPicker(true)}>
          ▤ Chọn bài IELTS
        </Button>
        <Button onClick={() => setCsv(true)}>＋ Nhập CSV</Button>
      </div>
      {!items.length ? (
        <EmptyState />
      ) : (
        <>
          <div className="audio-deck">
            <div className="audio-deck-main">
              <span className="badge">
                {speech.busy ? `${speech.index + 1} / ${items.length}` : `${items.length} mục`}
              </span>
              <Button
                variant="primary"
                onClick={() => {
                  const indexes = items.map((_, index) => index);
                  speech.play(
                    (order === 'random' ? shuffleVocabReviewCards(indexes) : indexes).flatMap(
                      segments,
                    ),
                  );
                }}
                disabled={speech.busy}
              >
                ▶ Phát tất cả
              </Button>
              <Button onClick={speech.stop} disabled={!speech.busy}>
                ■ Dừng
              </Button>
            </div>
            <AudioStatus speech={speech} />
            <MoreActions title="Thứ tự & dữ liệu">
              <label className="field">
                Thứ tự phát
                <select value={order} onChange={(e) => setOrder(e.target.value)}>
                  <option value="sequential">Tuần tự</option>
                  <option value="random">Ngẫu nhiên</option>
                </select>
              </label>
              <Button
                variant="danger"
                onClick={() => {
                  speech.stop();
                  setItems([]);
                }}
              >
                Xóa dữ liệu
              </Button>
            </MoreActions>
          </div>
          <div className="vocab-list">
            {items.map((item, index) => (
              <article
                className={`study-card vocab-item ${speech.busy && speech.index === index ? 'is-playing' : ''}`}
                key={index}
              >
                <div className="card-top">
                  <span className="eyebrow">
                    {String(index + 1).padStart(2, '0')}
                    {speech.busy && speech.index === index ? ' · ♫ Đang phát' : ''}
                  </span>
                  <Button
                    aria-label={`Phát ${item.vocabulary}`}
                    onClick={() => speech.play(segments(index).slice(1))}
                  >
                    ♫ Nghe
                  </Button>
                </div>
                <h2 className="vocab-term">
                  <RubyText text={item.vocabulary} />
                </h2>
                {item.hiragana && (
                  <p className="reading">
                    <RubyText text={item.hiragana} />
                  </p>
                )}
                {speech.phase === 'error' && speech.index === index && (
                  <p className="row-audio-error">⚠ Audio chưa phát được. Nhấn Nghe để thử lại.</p>
                )}
                <p className="vocab-meaning">{item.meaningVi}</p>
                {item.exampleJa && (
                  <div className="example">
                    <p>
                      <RubyText text={item.exampleJa} />
                    </p>
                    <p className="muted">{item.exampleVi}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      <CsvImport
        open={csv}
        onClose={() => setCsv(false)}
        title="Nhập từ vựng CSV"
        header={HEADER}
        onLoad={load}
      />
      <IeltsPicker
        open={picker}
        onClose={() => setPicker(false)}
        mode="instant-vocab"
        onLoad={(text) => load(text, true)}
      />
    </div>
  );
}
